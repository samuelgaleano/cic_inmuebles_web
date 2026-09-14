import { describe, expect, it } from "vitest";
import { formatLugar } from "./lugar";

describe("formatLugar", () => {
  it("corrige la ciudad tal como llega del catálogo (BogotÁ → Bogotá)", () => {
    expect(formatLugar("BogotÁ")).toBe("Bogotá");
    expect(formatLugar("BOGOTA")).toBe("Bogotá");
    expect(formatLugar("bogota")).toBe("Bogotá");
    expect(formatLugar("Medellin")).toBe("Medellín");
  });

  it("pasa a mayúscula inicial los sectores escritos en mayúsculas", () => {
    expect(formatLugar("BELLA SUIZA")).toBe("Bella Suiza");
    expect(formatLugar("CIUDAD JARDIN DEL NORTE")).toBe("Ciudad Jardin del Norte");
  });

  it("respeta lo que ya viene bien escrito", () => {
    expect(formatLugar("La Calleja")).toBe("La Calleja");
    expect(formatLugar("San Patricio")).toBe("San Patricio");
    expect(formatLugar("El Poblado")).toBe("El Poblado");
    expect(formatLugar("Puente Largo Alhambra")).toBe("Puente Largo Alhambra");
  });

  it("limpia espacios y tolera vacío", () => {
    expect(formatLugar("  Gilmar  ")).toBe("Gilmar");
    expect(formatLugar("")).toBe("");
    expect(formatLugar(undefined)).toBeUndefined();
  });
});
