import { beforeEach, describe, expect, it, vi } from "vitest";
import type { PropertyInput } from "@/lib/domain";
import { SELECT_INMUEBLE, SELECT_INMUEBLE_PUBLICO, type PropertyRow } from "./supabase/filas";

/**
 * Pruebas del repositorio Supabase contra un cliente falso que registra cada llamada. No validan SQL
 * (eso lo hace la base), sino el ORDEN de las operaciones y que ningún error se ignore: es lo que
 * decide si un fallo deja un inmueble sin fotos.
 */

type Error_ = { code?: string; message: string };
interface Resultado {
  data?: unknown;
  error?: Error_ | null;
  count?: number;
}
interface Op {
  tabla: string;
  pasos: [string, unknown[]][];
}

const estado = vi.hoisted(() => ({ responder: (() => ({ data: null, error: null })) as (op: Op) => Resultado, registro: [] as Op[] }));

vi.mock("./supabase/client", () => {
  const db = {
    rpc: async (fn: string, args: unknown) => {
      const op: Op = { tabla: `rpc:${fn}`, pasos: [["args", [args]]] };
      estado.registro.push(op);
      return { error: null, ...estado.responder(op) };
    },
    from(tabla: string) {
      const op: Op = { tabla, pasos: [] };
      estado.registro.push(op);
      const proxy: object = new Proxy(
        {},
        {
          get(_obj, prop) {
            if (prop === "then") {
              const r = { error: null, ...estado.responder(op) };
              return (ok: (v: unknown) => unknown, ko: (e: unknown) => unknown) => Promise.resolve(r).then(ok, ko);
            }
            return (...args: unknown[]) => {
              op.pasos.push([String(prop), args]);
              return proxy;
            };
          },
        },
      );
      return proxy;
    },
  };
  return { getSupabaseAdmin: () => db, isSupabaseConfigured: () => true };
});

const { createSupabaseRepository, esFuncionInexistente } = await import("./supabase-repository");

const ID = "11111111-1111-1111-1111-111111111111";

function fila(extra: Partial<PropertyRow> = {}): PropertyRow {
  return {
    id: ID,
    codigo: "CIC-0001",
    slug: "apto-chapinero",
    titulo: "Apto Chapinero",
    tipo: "apartamento",
    estado: "disponible",
    precio: 350000000,
    administracion: null,
    ciudad: "Bogotá",
    sector: "Chapinero",
    conjunto: null,
    habitaciones: 3,
    banos: 2,
    area: 80,
    parqueaderos: 1,
    descripcion: "",
    destacado: false,
    publicado: true,
    created_at: "2026-11-01T00:00:00Z",
    updated_at: "2026-11-01T00:00:00Z",
    direccion: "Calle falsa 123",
    propietario_nombre: "Dueño de prueba",
    propietario_telefono: "3000000000",
    propietario_email: null,
    notas_internas: "nota",
    drive_folder_id: null,
    property_media: [],
    ...extra,
  };
}

const medios: PropertyInput["medios"] = [
  { id: "m1", type: "image", provider: "drive", url: "https://x/1.jpg", order: 0, isCover: true },
  { id: "m2", type: "image", provider: "drive", url: "https://x/2.jpg", order: 1, isCover: false },
];

const paso = (op: Op, i = 0) => op.pasos[i]?.[0];
const ops = (tabla: string, accion?: string) => estado.registro.filter((o) => o.tabla === tabla && (!accion || paso(o) === accion));

/** Respuestas de base para leer/actualizar un inmueble; `extra` decide lo demás. */
function responderCon(extra: (op: Op) => Resultado | undefined) {
  estado.responder = (op) => {
    const r = extra(op);
    if (r) return r;
    if (op.tabla === "properties" && paso(op) === "select") {
      const columnas = op.pasos[0][1][0];
      if (columnas === SELECT_INMUEBLE || columnas === SELECT_INMUEBLE_PUBLICO) {
        const una = op.pasos.some((p) => p[0] === "maybeSingle" || p[0] === "single");
        return { data: una ? fila() : [fila()] };
      }
      return { data: [] };
    }
    if (op.tabla === "properties" && paso(op) === "insert") return { data: { id: ID } };
    return { data: null };
  };
}

beforeEach(() => {
  estado.registro = [];
  vi.spyOn(console, "warn").mockImplementation(() => {});
  vi.spyOn(console, "error").mockImplementation(() => {});
});

describe("esFuncionInexistente", () => {
  it("reconoce solo los códigos de función ausente", () => {
    expect(esFuncionInexistente({ code: "PGRST202" })).toBe(true);
    expect(esFuncionInexistente({ code: "42883" })).toBe(true);
    expect(esFuncionInexistente({ code: "23505" })).toBe(false);
    expect(esFuncionInexistente(null)).toBe(false);
  });
});

describe("replaceMedia (vía update)", () => {
  it("con la función 0014 usa una sola RPC y no borra fuera de la transacción", async () => {
    responderCon(() => undefined);
    await createSupabaseRepository().properties.update(ID, { medios });

    const rpc = ops("rpc:reemplazar_medios");
    expect(rpc).toHaveLength(1);
    const args = rpc[0].pasos[0][1][0] as { p_property: string; p_medios: Record<string, unknown>[] };
    expect(args.p_property).toBe(ID);
    expect(args.p_medios).toHaveLength(2);
    expect(args.p_medios[0]).not.toHaveProperty("property_id");
    expect(args.p_medios[0]).toMatchObject({ url: "https://x/1.jpg", is_cover: true, orden: 0 });
    expect(ops("property_media")).toHaveLength(0);
  });

  it("sin la función: inserta primero y borra después solo las anteriores por id", async () => {
    responderCon((op) => {
      if (op.tabla === "rpc:reemplazar_medios") return { error: { code: "PGRST202", message: "no existe" } };
      if (op.tabla === "property_media" && paso(op) === "select") return { data: [{ id: "viejo-1" }, { id: "viejo-2" }] };
      return undefined;
    });
    await createSupabaseRepository().properties.update(ID, { medios });

    const media = ops("property_media").map((o) => paso(o));
    expect(media).toEqual(["select", "insert", "delete"]);
    const borrado = ops("property_media", "delete")[0];
    expect(borrado.pasos).toContainEqual(["in", ["id", ["viejo-1", "viejo-2"]]]);
  });

  it("sin la función: si la inserción falla, no borra nada y propaga el error", async () => {
    responderCon((op) => {
      if (op.tabla === "rpc:reemplazar_medios") return { error: { code: "PGRST202", message: "no existe" } };
      if (op.tabla === "property_media" && paso(op) === "select") return { data: [{ id: "viejo-1" }] };
      if (op.tabla === "property_media" && paso(op) === "insert") return { error: { code: "22P02", message: "fila inválida" } };
      return undefined;
    });
    await expect(createSupabaseRepository().properties.update(ID, { medios })).rejects.toMatchObject({ code: "22P02" });
    expect(ops("property_media", "delete")).toHaveLength(0);
  });

  it("sin la función: un error al borrar las anteriores no se ignora", async () => {
    responderCon((op) => {
      if (op.tabla === "rpc:reemplazar_medios") return { error: { code: "42883", message: "no existe" } };
      if (op.tabla === "property_media" && paso(op) === "select") return { data: [{ id: "viejo-1" }] };
      if (op.tabla === "property_media" && paso(op) === "delete") return { error: { code: "57014", message: "cancelada" } };
      return undefined;
    });
    await expect(createSupabaseRepository().properties.update(ID, { medios })).rejects.toMatchObject({ code: "57014" });
  });

  it("otro error de la RPC se propaga sin intentar el camino de respaldo", async () => {
    responderCon((op) => (op.tabla === "rpc:reemplazar_medios" ? { error: { code: "23503", message: "fk" } } : undefined));
    await expect(createSupabaseRepository().properties.update(ID, { medios })).rejects.toMatchObject({ code: "23503" });
    expect(ops("property_media")).toHaveLength(0);
  });
});

describe("create", () => {
  const entrada: PropertyInput = {
    codigo: "CIC-0001",
    titulo: "Apto Chapinero",
    tipo: "apartamento",
    estado: "disponible",
    precio: 350000000,
    ubicacion: { ciudad: "Bogotá", sector: "Chapinero" },
    caracteristicas: { habitaciones: 3 },
    descripcion: "",
    medios,
    destacado: false,
    publicado: true,
  };

  it("si los medios fallan, deshace el alta y propaga el error", async () => {
    responderCon((op) => (op.tabla === "rpc:reemplazar_medios" ? { error: { code: "22P02", message: "medio inválido" } } : undefined));
    await expect(createSupabaseRepository().properties.create(entrada)).rejects.toMatchObject({ code: "22P02" });
    const borrados = ops("properties", "delete");
    expect(borrados).toHaveLength(1);
    expect(borrados[0].pasos).toContainEqual(["eq", ["id", ID]]);
  });

  it("calcula el código con el máximo numérico (CIC-10000 va después de CIC-9999)", async () => {
    responderCon((op) => {
      if (op.tabla === "properties" && paso(op) === "select" && op.pasos[0][1][0] === "codigo") {
        return { data: [{ codigo: "CIC-9999" }, { codigo: "CIC-10000" }, { codigo: "CIC-0002" }] };
      }
      return undefined;
    });
    await createSupabaseRepository().properties.create({ ...entrada, codigo: undefined });
    const alta = ops("properties", "insert")[0];
    expect(alta.pasos[0][1][0]).toMatchObject({ codigo: "CIC-10001" });
  });
});

describe("lecturas públicas", () => {
  it("listPublic pide solo columnas públicas y solo publicados", async () => {
    responderCon(() => undefined);
    await createSupabaseRepository().properties.listPublic();
    const lectura = ops("properties", "select")[0];
    const columnas = String(lectura.pasos[0][1][0]);
    expect(columnas).toBe(SELECT_INMUEBLE_PUBLICO);
    for (const privada of ["propietario", "direccion", "notas_internas", "drive_folder_id"]) expect(columnas).not.toContain(privada);
    expect(lectura.pasos).toContainEqual(["eq", ["publicado", true]]);
  });

  it("getPublicBySlug filtra por publicado en la consulta y no devuelve datos privados", async () => {
    responderCon(() => undefined);
    const p = await createSupabaseRepository().properties.getPublicBySlug("apto-chapinero");
    expect(ops("properties", "select")[0].pasos).toContainEqual(["eq", ["publicado", true]]);
    expect(p).not.toHaveProperty("propietario");
  });
});

describe("leads.list", () => {
  const lead = (i: number) => ({
    id: `lead-${i}`,
    tipo: "comprador",
    nombre: "N",
    telefono: "3000000000",
    email: null,
    mensaje: null,
    intencion: null,
    property_id: null,
    property_slug: null,
    preferencia: null,
    tipo_inmueble: null,
    ciudad: null,
    fuente: "web",
    estado: "nuevo",
    created_at: "2026-11-01T00:00:00Z",
  });

  it("pagina de a 1.000 hasta que una página llega incompleta", async () => {
    estado.responder = (op) => {
      const rango = op.pasos.find((p) => p[0] === "range")?.[1] as [number, number];
      const n = rango[0] === 0 ? 1000 : 3;
      return { data: Array.from({ length: n }, (_, i) => lead(rango[0] + i)) };
    };
    const leads = await createSupabaseRepository().leads.list();
    expect(leads).toHaveLength(1003);
    const rangos = ops("leads").map((o) => o.pasos.find((p) => p[0] === "range")?.[1]);
    expect(rangos).toEqual([
      [0, 999],
      [1000, 1999],
    ]);
    // Orden estable para que la paginación no repita ni salte filas.
    expect(ops("leads")[0].pasos).toContainEqual(["order", ["id", { ascending: false }]]);
  });

  it("respeta el límite pedido y avisa cuando lo alcanza", async () => {
    estado.responder = () => ({ data: Array.from({ length: 10 }, (_, i) => lead(i)) });
    const leads = await createSupabaseRepository().leads.list({ limite: 10 });
    expect(leads).toHaveLength(10);
    expect(ops("leads")[0].pasos).toContainEqual(["range", [0, 9]]);
    expect(console.warn).toHaveBeenCalled();
  });
});

describe("setAvailability", () => {
  it("sin la función: un error al borrar las franjas anteriores no se ignora", async () => {
    estado.responder = (op) => {
      if (op.tabla === "rpc:fijar_disponibilidad") return { error: { code: "PGRST202", message: "no existe" } };
      if (op.tabla === "agent_availability" && paso(op) === "select") return { data: [{ id: "f1" }] };
      if (op.tabla === "agent_availability" && paso(op) === "delete") return { error: { code: "57014", message: "cancelada" } };
      return { data: null };
    };
    await expect(
      createSupabaseRepository().agents.setAvailability("a1", [{ diaSemana: 1, horaInicio: "09:00", horaFin: "12:00" }]),
    ).rejects.toMatchObject({ code: "57014" });
    expect(ops("agent_availability").map((o) => paso(o))).toEqual(["select", "insert", "delete"]);
  });

  it("con la función 0014 usa una sola RPC", async () => {
    estado.responder = () => ({ data: null });
    await createSupabaseRepository().agents.setAvailability("a1", []);
    expect(ops("rpc:fijar_disponibilidad")).toHaveLength(1);
    expect(ops("agent_availability")).toHaveLength(0);
  });
});
