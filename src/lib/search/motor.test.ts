import { describe, expect, it } from "vitest";
import { buscar, combinar, ESTADO_VACIO, tieneCriterios, type EstadoBusqueda } from "./motor";
import { chipsManuales } from "./etiquetas";
import { leerParams, escribirParams, aQuery } from "./url";
import { normalizarTexto, type ContextoBusqueda } from "./interpretar";
import type { ItemIndice } from "./indice";

const it_ = (p: Partial<ItemIndice> & { id: string }): ItemIndice => ({
  slug: p.id,
  titulo: p.id,
  codigo: "1000",
  tipo: "apartamento",
  estado: "disponible",
  precio: 800_000_000,
  ciudad: "Bogotá",
  actualizadoEn: "2026-01-01",
  ...p,
  texto: normalizarTexto(p.texto ?? ""),
});

const indice: ItemIndice[] = [
  it_({ id: "bella", sector: "Bella Suiza", precio: 850_000_000, habitaciones: 4, banos: 4, area: 128, parqueaderos: 2, texto: "Bella Suiza chimenea terraza", actualizadoEn: "2026-09-01" }),
  it_({ id: "alejandria", sector: "Alejandría", precio: 680_000_000, habitaciones: 3, banos: 2, area: 74, texto: "Alejandría sala", actualizadoEn: "2026-08-01" }),
  it_({ id: "gilmar", sector: "Gilmar", precio: 405_000_000, habitaciones: 2, banos: 2, area: 60, parqueaderos: 1, estado: "en_proceso", texto: "Gilmar", actualizadoEn: "2026-10-01" }),
  it_({ id: "vendido", sector: "Bella Suiza", precio: 900_000_000, habitaciones: 3, estado: "vendido", texto: "Bella Suiza", actualizadoEn: "2026-12-01" }),
];
const ctx: ContextoBusqueda = { sectores: ["Bella Suiza", "Alejandría", "Gilmar"], ciudades: ["Bogotá"] };
const estado = (p: Partial<EstadoBusqueda> = {}): EstadoBusqueda => ({ ...ESTADO_VACIO, ...p });
const ids = (e: EstadoBusqueda) => buscar(indice, e, ctx).resultados.map((r) => r.item.id);

describe("buscar", () => {
  it("sin nada escrito devuelve todo, disponibles primero, sin razones", () => {
    const b = buscar(indice, estado(), ctx);
    expect(b.resultados.map((r) => r.item.id)).toEqual(["bella", "alejandria", "gilmar", "vendido"]);
    expect(b.resultados.every((r) => r.razones.length === 0)).toBe(true);
    expect(b.relajaciones).toEqual([]);
  });

  it("entiende una frase completa y explica cada resultado", () => {
    const b = buscar(indice, estado({ texto: "3 alcobas en Bella Suiza con parqueadero hasta 900 millones" }), ctx);
    expect(b.resultados.map((r) => r.item.id)).toEqual(["bella"]);
    expect(b.resultados[0].razones).toContain("En Bella Suiza");
    expect(b.resultados[0].razones).toContain("Dentro de tu presupuesto");
    expect(b.interpretacion.chips.map((c) => c.tipo)).toEqual(expect.arrayContaining(["habitaciones", "sector", "parqueaderos", "precio"]));
  });

  it("lo elegido a mano reemplaza lo interpretado, campo a campo", () => {
    const e = estado({ texto: "3 alcobas", manual: { habitacionesMin: 4 } });
    expect(ids(e)).toEqual(["bella"]);
    expect(combinar({ habitacionesMin: 3, precioMax: 900_000_000 }, { habitacionesMin: 4 })).toEqual({ habitacionesMin: 4, precioMax: 900_000_000 });
  });

  it("filtra por estado público", () => {
    expect(ids(estado({ manual: { estado: "en_proceso" } }))).toEqual(["gilmar"]);
    expect(ids(estado({ manual: { estado: "vendido" } }))).toEqual(["vendido"]);
  });

  it("ordena por precio manteniendo lo disponible primero, y por recientes", () => {
    expect(ids(estado({ orden: "precio_asc" }))).toEqual(["alejandria", "bella", "gilmar", "vendido"]);
    expect(ids(estado({ orden: "precio_desc" }))).toEqual(["bella", "alejandria", "gilmar", "vendido"]);
    expect(ids(estado({ orden: "recientes" }))).toEqual(["bella", "alejandria", "gilmar", "vendido"]);
  });

  it("sin resultados propone qué ampliar, con conteos reales", () => {
    const b = buscar(indice, estado({ texto: "5 alcobas jacuzzi" }), ctx);
    expect(b.resultados).toEqual([]);
    expect(b.relajaciones.length).toBeGreaterThan(0);
    for (const r of b.relajaciones) expect(r.total).toBeGreaterThan(0);
  });

  it("tieneCriterios", () => {
    expect(tieneCriterios({})).toBe(false);
    expect(tieneCriterios({ sectores: [] })).toBe(false);
    expect(tieneCriterios({ precioMax: 1 })).toBe(true);
  });
});

describe("URL del catálogo", () => {
  it("las URL de siempre siguen funcionando", () => {
    const e = leerParams({ tipo: "apartamento", habitacionesMin: "3", precioMax: "900000000", q: "chimenea", orden: "precio_asc" });
    expect(e).toEqual({ texto: "chimenea", manual: { tipo: "apartamento", habitacionesMin: 3, precioMax: 900_000_000 }, orden: "precio_asc" });
  });

  it("ignora valores inválidos en lugar de romper", () => {
    const e = leerParams({ tipo: "castillo", estado: "regalado", habitacionesMin: "-2", precioMax: "abc", orden: "caos", q: "x".repeat(500) });
    expect(e.manual).toEqual({});
    expect(e.orden).toBe("relevancia");
    expect(e.texto).toHaveLength(200);
  });

  it("ida y vuelta, con sectores y términos repetidos", () => {
    const original = estado({
      texto: "algo cerca del parque",
      manual: { tipo: "casa", estado: "disponible", sectores: ["Bella Suiza", "Gilmar"], terminos: ["chimenea"], precioMin: 400_000_000, areaMax: 150 },
      orden: "recientes",
    });
    const sp = escribirParams(original);
    expect(sp.getAll("sector")).toEqual(["Bella Suiza", "Gilmar"]);
    expect(leerParams(sp)).toEqual(original);
  });

  it("acepta URLSearchParams y los formatea como query", () => {
    expect(leerParams(new URLSearchParams("q=hola&habitacionesMin=2")).manual).toEqual({ habitacionesMin: 2 });
    expect(aQuery(ESTADO_VACIO)).toBe("");
    expect(aQuery(estado({ texto: "hola" }))).toBe("?q=hola");
  });
});

describe("chipsManuales", () => {
  it("un chip por criterio, con su redacción y la forma de quitarlo", () => {
    const m = { tipo: "apartamento", habitacionesMin: 3, precioMax: 900_000_000, parqueaderosMin: 1, sectores: ["Gilmar"] } as const;
    const chips = chipsManuales({ ...m, sectores: [...m.sectores] });
    expect(chips.map((c) => c.etiqueta)).toEqual(["Apartamento", "Gilmar", "Hasta $900 M", "3+ habitaciones", "Con parqueadero"]);
    const sinPrecio = chips.find((c) => c.etiqueta.startsWith("Hasta"))!.quitar({ ...m, sectores: [...m.sectores] });
    expect(sinPrecio.precioMax).toBeUndefined();
    expect(sinPrecio.habitacionesMin).toBe(3);
  });

  it("rango de precio y de área como un solo chip", () => {
    const chips = chipsManuales({ precioMin: 400_000_000, precioMax: 700_000_000, areaMin: 60, areaMax: 90 });
    expect(chips.map((c) => c.etiqueta)).toEqual(["$400 M – $700 M", "60–90 m²"]);
    expect(chips[0].quitar({ precioMin: 1, precioMax: 2, banosMin: 2 })).toEqual({ banosMin: 2 });
  });
});
