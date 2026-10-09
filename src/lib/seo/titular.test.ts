import { describe, expect, it } from "vitest";
import { tipoSingular, titularInventario } from "./titular";

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

describe("titularInventario · precio de entrada", () => {
  const con = (estado: "disponible" | "en_proceso" | "vendido", precio: number) => ({ ...apto("X", precio), estado });

  it("el 'desde' es lo más barato que hoy se puede comprar, no lo que está en negociación o vendido", () => {
    const t = titularInventario([con("en_proceso", 405e6), con("vendido", 300e6), con("disponible", 680e6), con("disponible", 850e6)]);
    expect(t.desde).toBe(680e6);
  });

  it("si nada está disponible, usa lo que no está vendido; y si todo está vendido, el mínimo general", () => {
    expect(titularInventario([con("en_proceso", 405e6), con("vendido", 300e6)]).desde).toBe(405e6);
    expect(titularInventario([con("vendido", 300e6), con("vendido", 500e6)]).desde).toBe(300e6);
  });

  it("un precio 0 (sin cargar) no es el precio de entrada", () => {
    expect(titularInventario([con("disponible", 0), con("disponible", 700e6)]).desde).toBe(700e6);
  });
});

describe("tipoSingular", () => {
  it("para frases con cantidad", () => {
    expect(tipoSingular("Apartamentos")).toBe("apartamento");
    expect(tipoSingular("Casas")).toBe("casa");
    expect(tipoSingular("Apartamentos y casas")).toBe("inmueble");
    expect(tipoSingular("Inmuebles")).toBe("inmueble");
  });
});
