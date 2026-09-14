import { describe, expect, it } from "vitest";
import { titularInventario } from "./titular";

const apto = (sector: string, precio: number, ciudad = "Bogotá") => ({
  tipo: "apartamento" as const,
  ubicacion: { ciudad, sector },
  precio,
});

describe("titularInventario", () => {
  it("con solo apartamentos en una ciudad, el titular es esa ciudad (lo que hay hoy)", () => {
    const t = titularInventario([apto("Bella Suiza", 850e6), apto("Gilmar", 405e6), apto("Calleja", 1600e6)]);
    expect(t.tipos).toBe("Apartamentos");
    expect(t.lugar).toBe("Bogotá");
    expect(t.titulo).toBe("Apartamentos en venta en Bogotá");
    expect(t.ciudad).toBe("Bogotá");
    expect(t.sectores).toEqual(["Bella Suiza", "Calleja", "Gilmar"]);
    expect(t.desde).toBe(405e6);
  });

  it("si aparecen casas u otra ciudad, el titular se ensancha solo", () => {
    const mixto = [apto("Bella Suiza", 850e6), { tipo: "casa" as const, ubicacion: { ciudad: "Chía", sector: "Centro" }, precio: 900e6 }];
    const t = titularInventario(mixto);
    expect(t.titulo).toBe("Apartamentos y casas en venta en Colombia");
    expect(t.ciudad).toBeUndefined();
  });

  it("tipos raros caen en 'Inmuebles'", () => {
    const t = titularInventario([apto("X", 1), { tipo: "lote" as const, ubicacion: { ciudad: "Bogotá" }, precio: 2 }]);
    expect(t.titulo).toBe("Inmuebles en venta en Bogotá");
  });

  it("sin inventario mantiene el titular genérico", () => {
    expect(titularInventario([]).titulo).toBe("Apartamentos y casas en venta en Colombia");
  });
});
