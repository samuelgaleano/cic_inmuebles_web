import { describe, expect, it } from "vitest";
import { formatLugar, formatNombre, titulo } from "./lugar";

describe("formatLugar", () => {
  it("corrige la ciudad tal como llega del catálogo (BogotÁ → Bogotá)", () => {
    expect(formatLugar("BogotÁ")).toBe("Bogotá");
    expect(formatLugar("BOGOTA")).toBe("Bogotá");
    expect(formatLugar("bogota")).toBe("Bogotá");
    expect(formatLugar("Medellin")).toBe("Medellín");
  });

  it("pasa a mayúscula inicial lo escrito todo en mayúsculas o todo en minúsculas", () => {
    expect(formatLugar("BELLA SUIZA")).toBe("Bella Suiza");
    expect(formatLugar("CIUDAD JARDIN DEL NORTE")).toBe("Ciudad Jardin del Norte");
    expect(formatLugar("cedritos")).toBe("Cedritos");
    expect(formatLugar("bella suiza")).toBe("Bella Suiza");
    expect(formatLugar("Bella suiza")).toBe("Bella Suiza"); // mezcla inconsistente
  });

  it("respeta lo que ya viene bien escrito, incluidas mayúsculas internas legítimas", () => {
    expect(formatLugar("La Calleja")).toBe("La Calleja");
    expect(formatLugar("San Patricio")).toBe("San Patricio");
    expect(formatLugar("Ciudad Jardín del Norte")).toBe("Ciudad Jardín del Norte");
    expect(formatNombre("BioCity Torre 2")).toBe("BioCity Torre 2");
    expect(formatNombre("Área 19 PH")).toBe("Área 19 PH");
    expect(formatNombre("Torre-B")).toBe("Torre-B");
  });

  it("solo corrige la mayúscula acentuada suelta que dejaba el importador viejo", () => {
    expect(formatNombre("AlejandrÍa")).toBe("Alejandría");
    expect(formatNombre("BioCity ChicÓ")).toBe("BioCity Chicó");
  });

  it("al reescribir un texto todo en mayúsculas conserva siglas y números romanos", () => {
    expect(formatNombre("CHICÓ II")).toBe("Chicó II");
    expect(formatNombre("EDIFICIO PH TORRE III")).toBe("Edificio PH Torre III");
    expect(formatNombre("CONJUNTO SAN JOSÉ")).toBe("Conjunto San José");
    expect(formatNombre("APARTAMENTO VIS EN BOSA")).toBe("Apartamento VIS En Bosa");
    expect(formatNombre("EDIFICIO BBVA")).toBe("Edificio BBVA");
    expect(formatNombre("torres y casas")).toBe("Torres y Casas");
    expect(formatLugar("CAN")).toBe("CAN");
    expect(formatLugar("BOGOTÁ, D.C.")).toBe("Bogotá");
  });

  it("capitaliza tras guion, paréntesis o comillas y no toca palabras con dígitos", () => {
    expect(formatNombre("PUENTE-LARGO (ETAPA 2)")).toBe("Puente-Largo (Etapa 2)");
    expect(formatNombre("torre 2b")).toBe("Torre 2b");
    expect(formatNombre("'el nogal'")).toBe("'El Nogal'");
  });

  it("limpia espacios y tolera vacío", () => {
    expect(formatLugar("  Gilmar  ")).toBe("Gilmar");
    expect(formatLugar("")).toBe("");
    expect(formatLugar(undefined)).toBeUndefined();
  });
});

describe("titulo", () => {
  it("es la capitalización pura, para nombres de carpeta de Drive", () => {
    expect(titulo("puente largo alhambra")).toBe("Puente Largo Alhambra");
    expect(titulo("conjunto SAN JOSÉ")).toBe("Conjunto San José");
  });
});
