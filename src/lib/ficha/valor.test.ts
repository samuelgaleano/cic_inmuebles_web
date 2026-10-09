import { describe, expect, it } from "vitest";
import { contextoDePrecio, fraseContexto, MIN_COMPARABLES, precioPorM2, type ItemValor } from "./valor";

const p = (id: string, precio: number, area?: number, estado: ItemValor["estado"] = "disponible"): ItemValor => ({ id, precio, area, estado });

describe("precioPorM2", () => {
  it("precio entre área, redondeado", () => {
    expect(precioPorM2(850_000_000, 128)).toBe(6_640_625);
    expect(precioPorM2(405_000_000, 60)).toBe(6_750_000);
  });
  it("sin área válida no hay cifra", () => {
    expect(precioPorM2(1_000, undefined)).toBeUndefined();
    expect(precioPorM2(1_000, 0)).toBeUndefined();
    expect(precioPorM2(0, 50)).toBeUndefined();
  });
});

describe("contextoDePrecio", () => {
  const portafolio = [
    p("a", 600_000_000, 100), // 6,0 M/m²
    p("b", 700_000_000, 100), // 7,0
    p("c", 800_000_000, 100), // 8,0
    p("d", 900_000_000, 100), // 9,0
    p("vendido", 100_000_000, 100, "vendido"), // no cuenta
    p("sin-area", 500_000_000),
  ];

  it("compara contra el promedio de los demás, sin vendidos ni inmuebles sin área", () => {
    const c = contextoDePrecio(p("a", 600_000_000, 100), portafolio)!;
    expect(c.porM2).toBe(6_000_000);
    expect(c.promedio).toBe(8_000_000);
    expect(c.diferenciaPct).toBe(-25);
    expect(c.n).toBe(3);
  });

  it("no inventa contexto con pocos comparables o sin área propia", () => {
    expect(MIN_COMPARABLES).toBe(3);
    expect(contextoDePrecio(p("a", 600_000_000, 100), [p("a", 1, 1), p("b", 700_000_000, 100)])).toBeUndefined();
    expect(contextoDePrecio(p("x", 600_000_000), portafolio)).toBeUndefined();
  });

  it("la frase dice el sentido y a qué se compara", () => {
    expect(fraseContexto({ porM2: 1, promedio: 1, diferenciaPct: -12, n: 5 })).toBe("12 % por debajo del promedio de los 5 inmuebles comparables del portafolio de CIC.");
    expect(fraseContexto({ porM2: 1, promedio: 1, diferenciaPct: 8, n: 4 })).toContain("8 % por encima");
    expect(fraseContexto({ porM2: 1, promedio: 1, diferenciaPct: 2, n: 4 })).toMatch(/^En línea con el promedio/);
  });
});
