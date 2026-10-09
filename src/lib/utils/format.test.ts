import { describe, expect, it } from "vitest";
import { formatPrice, formatPriceCompact, formatPriceOrConsult } from "./format";

describe("formatPriceCompact", () => {
  it("millones sin decimales cuando son redondos", () => {
    expect(formatPriceCompact(405_000_000)).toBe("$405 M");
    expect(formatPriceCompact(850_000_000)).toBe("$850 M");
  });
  it("miles de millones con punto de miles, como el resto del sitio", () => {
    expect(formatPriceCompact(1_420_000_000)).toBe("$1.420 M");
    expect(formatPriceCompact(1_600_000_000)).toBe("$1.600 M");
  });
  it("un decimal solo si hace falta", () => {
    expect(formatPriceCompact(1_250_000)).toBe("$1,3 M");
    expect(formatPriceCompact(2_500_000)).toBe("$2,5 M");
  });
  it("por debajo de un millón, el valor completo", () => {
    expect(formatPriceCompact(950_000)).toBe(formatPrice(950_000));
  });
});

describe("formatPriceOrConsult", () => {
  it("un precio sin cargar no se anuncia como $ 0", () => {
    expect(formatPriceOrConsult(0)).toBe("Consultar precio");
    expect(formatPriceOrConsult(-5)).toBe("Consultar precio");
    expect(formatPriceOrConsult(850_000_000)).toBe(formatPrice(850_000_000));
  });
});
