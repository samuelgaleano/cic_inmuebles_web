import { describe, expect, it } from "vitest";
import { encabezadoFicha, MAX_DESCRIPCION, recortarEnPalabra } from "./textos-seo";

describe("recortarEnPalabra", () => {
  it("deja igual un texto que cabe", () => {
    expect(recortarEnPalabra("Apartamentos en venta en Bogotá.")).toBe("Apartamentos en venta en Bogotá.");
  });

  it("normaliza espacios y saltos de línea", () => {
    expect(recortarEnPalabra("  Casa\n en   venta ")).toBe("Casa en venta");
  });

  it("nunca corta a mitad de palabra y respeta el máximo", () => {
    const texto =
      "Apartamentos en venta en Bogotá: Bella Suiza, Calleja, Gilmar. Describe lo que buscas, filtra por precio y características y agenda tu visita con CIC Inmuebles.";
    expect(texto.length).toBeGreaterThan(MAX_DESCRIPCION);
    const r = recortarEnPalabra(texto);
    expect(r.length).toBeLessThanOrEqual(MAX_DESCRIPCION);
    expect(r.endsWith("…")).toBe(true);
    const sinElipsis = r.slice(0, -1);
    // Lo que queda es un prefijo del original que termina justo antes de un espacio.
    expect(texto.startsWith(sinElipsis)).toBe(true);
    expect(texto[sinElipsis.length]).toBe(" ");
  });

  it("no deja puntuación colgando antes de la elipsis", () => {
    expect(recortarEnPalabra("uno dos, tres cuatro", 10)).toBe("uno dos…");
  });

  it("si el corte cae justo al final de una palabra, la conserva", () => {
    // "abcd efgh ijkl": con máximo 10 el tope es 9 y "abcd efgh" queda completa.
    expect(recortarEnPalabra("abcd efgh ijkl", 10)).toBe("abcd efgh…");
  });

  it("una sola palabra larga se corta duro (no hay espacio donde cortar)", () => {
    expect(recortarEnPalabra("a".repeat(20), 10)).toBe(`${"a".repeat(9)}…`);
  });
});

describe("encabezadoFicha", () => {
  it("tipo, operación, sector y ciudad", () => {
    expect(encabezadoFicha({ tipo: "Apartamento", sector: "Gilmar", ciudad: "Bogotá" }).texto).toBe(
      "Apartamento en venta en Gilmar, Bogotá",
    );
  });

  it("sin sector se omite y queda la ciudad", () => {
    expect(encabezadoFicha({ tipo: "Casa", sector: null, ciudad: "Bogotá" }).texto).toBe("Casa en venta en Bogotá");
    expect(encabezadoFicha({ tipo: "Casa", sector: "  ", ciudad: "Bogotá" }).texto).toBe("Casa en venta en Bogotá");
  });

  it("sin lugar queda solo el prefijo", () => {
    expect(encabezadoFicha({ tipo: "Lote", ciudad: "" }).texto).toBe("Lote en venta");
  });

  it("lo vendido no se anuncia en venta", () => {
    const e = encabezadoFicha({ tipo: "Apartamento", sector: "Gilmar", ciudad: "Bogotá", vendido: true });
    expect(e.prefijo).toBe("Apartamento");
    expect(e.texto).toBe("Apartamento en Gilmar, Bogotá");
  });
});
