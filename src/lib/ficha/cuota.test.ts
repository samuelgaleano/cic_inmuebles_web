import { describe, expect, it } from "vitest";
import { calcularCuota, LIMITES } from "./cuota";

describe("calcularCuota", () => {
  it("cuota fija mensual de un crédito en pesos (sistema francés, tasa efectiva anual)", () => {
    const r = calcularCuota({ precio: 200_000_000, inicialPct: 50, plazoAnios: 15, tasaEA: 12 });
    expect(r.inicial).toBe(100_000_000);
    expect(r.prestamo).toBe(100_000_000);
    // 1.12^(1/12) − 1 = 0,9489 % mensual · 180 cuotas ⇒ ≈ $1.161.000
    expect(r.cuota).toBeGreaterThan(1_150_000);
    expect(r.cuota).toBeLessThan(1_172_000);
    expect(r.totalPagado).toBeCloseTo(r.cuota * 180, -2);
    expect(r.totalIntereses).toBeCloseTo(r.totalPagado - r.prestamo, -2);
  });

  it("tasa 0 %: el préstamo se reparte en partes iguales", () => {
    const r = calcularCuota({ precio: 120_000_000, inicialPct: 0 + LIMITES.inicialPct.min, plazoAnios: 10, tasaEA: 0 });
    expect(r.cuota).toBe(Math.round(r.prestamo / 120));
    expect(r.totalIntereses).toBe(0);
  });

  it("limita los valores a rangos razonables en vez de producir resultados absurdos", () => {
    const r = calcularCuota({ precio: 500_000_000, inicialPct: 150, plazoAnios: 100, tasaEA: -5 });
    expect(r.inicialPct).toBe(LIMITES.inicialPct.max);
    expect(r.plazoAnios).toBe(LIMITES.plazoAnios.max);
    expect(r.tasaEA).toBe(LIMITES.tasaEA.min);
    expect(Number.isFinite(r.cuota)).toBe(true);
  });

  it("precio inválido: todo en cero, sin NaN", () => {
    for (const precio of [0, -10, NaN]) {
      const r = calcularCuota({ precio, inicialPct: 30, plazoAnios: 15, tasaEA: 12 });
      expect(r).toMatchObject({ cuota: 0, prestamo: 0, totalIntereses: 0 });
    }
  });

  it("más inicial o más plazo siempre bajan la cuota", () => {
    const base = calcularCuota({ precio: 800_000_000, inicialPct: 30, plazoAnios: 15, tasaEA: 12 });
    expect(calcularCuota({ precio: 800_000_000, inicialPct: 40, plazoAnios: 15, tasaEA: 12 }).cuota).toBeLessThan(base.cuota);
    expect(calcularCuota({ precio: 800_000_000, inicialPct: 30, plazoAnios: 20, tasaEA: 12 }).cuota).toBeLessThan(base.cuota);
  });
});
