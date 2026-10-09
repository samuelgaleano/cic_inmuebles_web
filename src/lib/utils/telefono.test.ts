import { describe, expect, it } from "vitest";
import { enlaceWhatsApp, normalizarTelefono } from "./telefono";

describe("normalizarTelefono", () => {
  it("celular colombiano en cualquier formato", () => {
    for (const crudo of ["300 123 4567", "3001234567", "(300) 123-4567", "+57 300 123 4567", "57 3001234567", "0057 300 1234567", "+57-300-123-4567"]) {
      expect(normalizarTelefono(crudo), crudo).toEqual({ tipo: "movil", e164: "+573001234567", legible: "+57 300 123 4567" });
    }
  });

  it("fijo con indicativo y fijo local de 7 dígitos", () => {
    expect(normalizarTelefono("601 234 5678")).toEqual({ tipo: "fijo", e164: "+576012345678", legible: "+57 601 234 5678" });
    expect(normalizarTelefono("234 5678")).toEqual({ tipo: "local", legible: "234 5678" });
  });

  it("números de otros países (propietarios que venden desde afuera)", () => {
    expect(normalizarTelefono("+1 305 555 0100")).toEqual({ tipo: "internacional", e164: "+13055550100", legible: "+13055550100" });
    expect(normalizarTelefono("0034 612 345 678")?.e164).toBe("+34612345678");
  });

  it("rechaza lo que no es un teléfono", () => {
    for (const crudo of ["", "   ", "-------", "+++++++", "abcdefghij", "1234567890", "0000000000", "3333333333", "30012", "+57 123", "+999"]) {
      expect(normalizarTelefono(crudo), crudo).toBeNull();
    }
  });

  it("un número local de 7 dígitos con '+' no se acepta (sin país no se sabe cuál es)", () => {
    expect(normalizarTelefono("+2345678")).toBeNull();
  });
});

describe("enlaceWhatsApp", () => {
  it("lleva el indicativo de Colombia aunque el visitante no lo escribiera", () => {
    expect(enlaceWhatsApp("300 123 4567")).toBe("https://wa.me/573001234567");
  });
  it("con mensaje", () => {
    expect(enlaceWhatsApp("3001234567", "Hola, ¿cómo estás?")).toBe("https://wa.me/573001234567?text=Hola%2C%20%C2%BFc%C3%B3mo%20est%C3%A1s%3F");
  });
  it("sin enlace para fijos locales o basura", () => {
    expect(enlaceWhatsApp("234 5678")).toBeUndefined();
    expect(enlaceWhatsApp("-------")).toBeUndefined();
  });
});
