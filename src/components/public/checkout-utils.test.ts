import { describe, expect, it } from "vitest";
import { esDatosPago, leerDatosGuardados, telefonoNacional, urlPaginaCompleta } from "./checkout-utils";

const PAGO = {
  currency: "COP",
  amountInCents: 1_000_000,
  reference: "CIC-alianza-90-123456-1700000000000",
  publicKey: "pub_test_x",
  signature: "abc",
  redirectUrl: "https://www.cicinmuebles.com/publica/agente?pago=procesado&ref=CIC-alianza-90-123456-1700000000000",
};

describe("checkout-utils", () => {
  it("la página completa de Wompi lleva la firma, el retorno y el teléfono solo con dígitos y +57", () => {
    const u = new URL(urlPaginaCompleta(PAGO, { nombre: "Marta", email: "m@x.co", telefono: "300 123-4567" }));
    expect(u.origin + u.pathname).toBe("https://checkout.wompi.co/p/");
    expect(u.searchParams.get("signature:integrity")).toBe("abc");
    expect(u.searchParams.get("redirect-url")).toBe(PAGO.redirectUrl);
    expect(u.searchParams.get("customer-data:phone-number")).toBe("3001234567");
    expect(u.searchParams.get("customer-data:phone-number-prefix")).toBe("+57");
  });

  it("sin teléfono no manda parámetros de teléfono", () => {
    const u = new URL(urlPaginaCompleta(PAGO, { nombre: "Marta", email: "m@x.co", telefono: "" }));
    expect(u.searchParams.has("customer-data:phone-number")).toBe(false);
  });

  it("los datos guardados se leen con tolerancia y se descartan si están dañados", () => {
    expect(leerDatosGuardados(null)).toBeNull();
    expect(leerDatosGuardados("{roto")).toBeNull();
    expect(leerDatosGuardados(JSON.stringify({ nombre: 3, email: null }))).toBeNull();
    expect(leerDatosGuardados(JSON.stringify({ nombre: "Marta", email: "m@x.co", telefono: "300" }))).toEqual({ nombre: "Marta", email: "m@x.co", telefono: "300" });
    expect(leerDatosGuardados(JSON.stringify({ nombre: "x".repeat(500) }))!.nombre).toHaveLength(120);
  });

  it("solo una respuesta completa del servidor abre la pasarela", () => {
    expect(esDatosPago(PAGO)).toBe(true);
    expect(esDatosPago({ ...PAGO, signature: undefined })).toBe(false);
    expect(esDatosPago({ ok: false, error: "x" })).toBe(false);
    expect(esDatosPago(null)).toBe(false);
  });

  it("el teléfono con 57 que guarda Wompi se normaliza para no duplicar el prefijo", () => {
    expect(telefonoNacional("573012679392")).toBe("3012679392");
    expect(telefonoNacional("+57 301 267 9392")).toBe("3012679392");
    expect(telefonoNacional("3012679392")).toBe("3012679392");
    expect(telefonoNacional("5712345")).toBe("5712345"); // un fijo corto que empieza en 57 no se toca
    const u = new URL(urlPaginaCompleta(PAGO, { nombre: "M", email: "m@x.co", telefono: "573012679392" }));
    expect(u.searchParams.get("customer-data:phone-number")).toBe("3012679392");
  });
});
