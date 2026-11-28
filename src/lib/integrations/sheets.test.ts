import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { mismaTabla, propertyToSheetRow, SHEET_HEADER, syncAllPropertiesToSheet } from "./sheets";
import { PROPERTY_STATUS_LABELS } from "@/lib/domain";
import { seedProperties } from "@/lib/data/seed";

vi.mock("./google-auth", () => ({
  isGoogleServiceAccountConfigured: () => true,
  getGoogleAccessToken: async () => "token-de-prueba",
}));

describe("propertyToSheetRow", () => {
  const property = seedProperties[0];
  const row = propertyToSheetRow(property);

  it("genera una fila con tantas columnas como el encabezado", () => {
    expect(row).toHaveLength(SHEET_HEADER.length);
  });

  it("coloca el ID en la primera columna (clave de upsert)", () => {
    expect(row[0]).toBe(property.id);
    expect(SHEET_HEADER[0]).toBe("ID");
  });

  it("usa la etiqueta legible del estado y el precio numérico", () => {
    expect(row[SHEET_HEADER.indexOf("Estado")]).toBe(PROPERTY_STATUS_LABELS[property.estado]);
    expect(row[SHEET_HEADER.indexOf("Precio")]).toBe(property.precio);
  });

  it("incluye la URL pública del inmueble", () => {
    const url = String(row[SHEET_HEADER.indexOf("URL pública")]);
    expect(url).toContain(`/inmuebles/${property.slug}`);
  });
});

describe("mismaTabla", () => {
  it("ignora celdas y filas vacías al final y compara números como texto", () => {
    expect(mismaTabla([["a", 1, ""], []], [["a", "1"]])).toBe(true);
    expect(mismaTabla([["a", 1]], [["a", 2]])).toBe(false);
    expect(mismaTabla([["a"], ["b"]], [["a"]])).toBe(false);
  });
});

describe("syncAllPropertiesToSheet", () => {
  type Llamada = { metodo: string; url: string };
  let llamadas: Llamada[];
  let responder: (l: Llamada) => Response;

  beforeEach(() => {
    vi.stubEnv("GOOGLE_SHEETS_SPREADSHEET_ID", "hoja-de-prueba");
    llamadas = [];
    responder = () => new Response("{}", { status: 200 });
    vi.stubGlobal("fetch", async (url: string, init?: RequestInit) => {
      const l = { metodo: init?.method ?? "GET", url: decodeURIComponent(String(url)) };
      llamadas.push(l);
      return responder(l);
    });
    vi.spyOn(console, "error").mockImplementation(() => {});
  });

  afterEach(() => {
    vi.unstubAllEnvs();
    vi.unstubAllGlobals();
  });

  const inmuebles = seedProperties.slice(0, 2);
  const filasEsperadas = [[...SHEET_HEADER], ...inmuebles.map(propertyToSheetRow)];

  it("escribe primero el bloque nuevo y después limpia solo las filas sobrantes", async () => {
    expect(await syncAllPropertiesToSheet(inmuebles)).toBe("escrito");
    expect(llamadas.map((l) => l.metodo)).toEqual(["PUT", "POST"]);
    expect(llamadas[0].url).toContain(`/values/A1:AA${filasEsperadas.length}?`);
    expect(llamadas[1].url).toContain(`/values/A${filasEsperadas.length + 1}:AA100000:clear`);
  });

  it("si la escritura falla no limpia nada (la hoja nunca queda vacía)", async () => {
    responder = (l) => (l.metodo === "PUT" ? new Response("cuota", { status: 429 }) : new Response("{}"));
    expect(await syncAllPropertiesToSheet(inmuebles)).toBe("fallo");
    expect(llamadas.map((l) => l.metodo)).toEqual(["PUT"]);
  });

  it("comprueba la respuesta de la limpieza y con lanzarErrores la propaga", async () => {
    responder = (l) => (l.url.includes(":clear") ? new Response("no", { status: 500 }) : new Response("{}"));
    await expect(syncAllPropertiesToSheet(inmuebles, { lanzarErrores: true })).rejects.toThrow(/clear error: 500/);
  });

  it("con soloSiCambio no escribe si la hoja ya coincide", async () => {
    // La hoja devuelve números sin formato y omite celdas vacías al final.
    responder = () => new Response(JSON.stringify({ values: filasEsperadas }));
    expect(await syncAllPropertiesToSheet(inmuebles, { soloSiCambio: true })).toBe("sin-cambios");
    expect(llamadas).toHaveLength(1);
    expect(llamadas[0].metodo).toBe("GET");
    expect(llamadas[0].url).toContain("valueRenderOption=UNFORMATTED_VALUE");
  });

  it("con soloSiCambio escribe si la hoja difiere", async () => {
    responder = (l) =>
      l.metodo === "GET" ? new Response(JSON.stringify({ values: [[...SHEET_HEADER]] })) : new Response("{}");
    expect(await syncAllPropertiesToSheet(inmuebles, { soloSiCambio: true })).toBe("escrito");
    expect(llamadas.map((l) => l.metodo)).toEqual(["GET", "PUT", "POST"]);
  });

  it("sin configuración no llama a la API", async () => {
    vi.stubEnv("GOOGLE_SHEETS_SPREADSHEET_ID", "");
    expect(await syncAllPropertiesToSheet(inmuebles)).toBe("omitido");
    expect(llamadas).toHaveLength(0);
  });
});
