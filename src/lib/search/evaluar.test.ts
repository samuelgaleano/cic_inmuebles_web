import { describe, expect, it } from "vitest";
import { coincide, ordenar, razones, relajaciones, type Buscable } from "./evaluar";
import { normalizarTexto } from "./interpretar";

const b = ({ texto = "", ...resto }: Partial<Buscable> & { id: string }): Buscable => ({
  tipo: "apartamento",
  estado: "disponible",
  precio: 800_000_000,
  ciudad: "Bogotá",
  ...resto,
  texto: normalizarTexto(texto),
});

const catalogo: Buscable[] = [
  b({ id: "bella", sector: "Bella Suiza", precio: 850_000_000, habitaciones: 4, banos: 4, area: 128, parqueaderos: 2, texto: "Bella Suiza chimenea family room terraza" }),
  b({ id: "alejandria", sector: "Alejandría", precio: 680_000_000, habitaciones: 3, banos: 2, area: 74, texto: "Alejandría sala comedor" }),
  b({ id: "gilmar", sector: "Gilmar", precio: 405_000_000, habitaciones: 2, banos: 2, area: 60, parqueaderos: 1, estado: "en_proceso", texto: "Gilmar" }),
  b({ id: "vendido", sector: "Bella Suiza", precio: 900_000_000, habitaciones: 3, estado: "vendido", texto: "Bella Suiza" }),
];

const ids = (f: Parameters<typeof coincide>[1]) => catalogo.filter((x) => coincide(x, f)).map((x) => x.id);

describe("coincide", () => {
  it("sin filtros, todo coincide", () => {
    expect(ids({})).toHaveLength(4);
  });

  it("habitaciones, baños, parqueaderos y área son mínimos/máximos", () => {
    expect(ids({ habitacionesMin: 3 })).toEqual(["bella", "alejandria", "vendido"]);
    expect(ids({ banosMin: 3 })).toEqual(["bella"]);
    expect(ids({ parqueaderosMin: 1 })).toEqual(["bella", "gilmar"]);
    expect(ids({ areaMin: 70, areaMax: 130 })).toEqual(["bella", "alejandria"]);
  });

  it("precio mínimo y máximo", () => {
    expect(ids({ precioMax: 700_000_000 })).toEqual(["alejandria", "gilmar"]);
    expect(ids({ precioMin: 800_000_000 })).toEqual(["bella", "vendido"]);
  });

  it("sectores: cualquiera de los pedidos, sin importar tildes ni mayúsculas", () => {
    expect(ids({ sectores: ["bella suiza", "ALEJANDRIA"] })).toEqual(["bella", "alejandria", "vendido"]);
  });

  it("términos: todos deben aparecer, con singular/plural", () => {
    expect(ids({ terminos: ["chimeneas"] })).toEqual(["bella"]);
    expect(ids({ terminos: ["chimenea", "terraza"] })).toEqual(["bella"]);
    expect(ids({ terminos: ["chimenea", "jacuzzi"] })).toEqual([]);
  });

  it("términos: la coincidencia es por inicio de palabra, no por subcadena", () => {
    const x = b({ id: "x", texto: "salado" });
    expect(coincide(x, { terminos: ["sala"] })).toBe(true); // 'salado' empieza por 'sala'
    expect(coincide(b({ id: "y", texto: "asalto" }), { terminos: ["sala"] })).toBe(false);
  });

  it("un dato ausente no cumple un mínimo exigido", () => {
    expect(coincide(b({ id: "z" }), { habitacionesMin: 1 })).toBe(false);
    expect(coincide(b({ id: "z" }), { areaMax: 200 })).toBe(false);
  });

  it("tipo y ciudad", () => {
    expect(ids({ tipo: "casa" })).toEqual([]);
    expect(ids({ ciudad: "bogota" })).toHaveLength(4);
    expect(ids({ ciudad: "Medellín" })).toEqual([]);
  });
});

describe("razones (por qué aparece cada resultado)", () => {
  it("explica cada criterio cumplido con datos reales", () => {
    const r = razones(catalogo[0], {
      precioMax: 900_000_000,
      habitacionesMin: 3,
      sectores: ["Bella Suiza"],
      terminos: ["chimenea"],
      parqueaderosMin: 1,
    });
    expect(r).toContain("Dentro de tu presupuesto");
    expect(r).toContain("4 habitaciones");
    expect(r).toContain("En Bella Suiza");
    expect(r).toContain("Menciona «chimenea»");
    expect(r).toContain("2 parqueaderos");
  });

  it("sin criterios no inventa razones", () => {
    expect(razones(catalogo[0], {})).toEqual([]);
  });
});

describe("ordenar", () => {
  it("disponibles primero, luego en proceso, luego vendidos; dentro, más cerca del presupuesto primero", () => {
    const orden = ordenar(catalogo, { precioMax: 900_000_000 }).map((x) => x.id);
    expect(orden).toEqual(["bella", "alejandria", "gilmar", "vendido"]);
  });
});

describe("relajaciones (cuando no hay resultados)", () => {
  it("propone ampliar solo lo que de verdad devuelve resultados, con el conteo", () => {
    const filtros = { habitacionesMin: 5, precioMax: 700_000_000, terminos: ["jacuzzi"] };
    expect(ids(filtros)).toEqual([]);
    const sugerencias = relajaciones(catalogo, filtros);
    expect(sugerencias.length).toBeGreaterThan(0);
    for (const s of sugerencias) {
      expect(s.total).toBeGreaterThan(0);
      expect(catalogo.filter((x) => coincide(x, s.filtros))).toHaveLength(s.total);
    }
    expect(sugerencias.map((s) => s.etiqueta).join(" ")).toMatch(/jacuzzi|habitaciones/i);
  });

  it("si hay resultados no sugiere nada", () => {
    expect(relajaciones(catalogo, { habitacionesMin: 2 })).toEqual([]);
  });
});
