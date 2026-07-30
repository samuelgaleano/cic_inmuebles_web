import { afterEach, describe, expect, it, vi } from "vitest";
import { createSessionToken, validateCredentials, verifySessionToken } from "./session";

/**
 * El panel admin se protege con credenciales y un secreto de firma que vienen
 * de variables de entorno. Fuera de producción hay valores por defecto para
 * poder trabajar en local, pero esos valores están en el repositorio: en
 * producción NUNCA deben usarse. Estas pruebas blindan ese límite.
 */

afterEach(() => {
  vi.unstubAllEnvs();
});

function configurar(email = "jefe@cic.com", password = "clave-fuerte", secreto = "secreto-largo") {
  vi.stubEnv("ADMIN_EMAIL", email);
  vi.stubEnv("ADMIN_PASSWORD", password);
  vi.stubEnv("ADMIN_SESSION_SECRET", secreto);
}

describe("validateCredentials", () => {
  it("acepta las credenciales configuradas (sin distinguir mayúsculas en el correo)", () => {
    configurar();
    expect(validateCredentials("jefe@cic.com", "clave-fuerte")).toBe(true);
    expect(validateCredentials("  JEFE@CIC.COM  ", "clave-fuerte")).toBe(true);
  });

  it("rechaza contraseña incorrecta y correo incorrecto", () => {
    configurar();
    expect(validateCredentials("jefe@cic.com", "otra")).toBe(false);
    expect(validateCredentials("otro@cic.com", "clave-fuerte")).toBe(false);
  });

  it("no acepta contraseña vacía cuando la variable está definida", () => {
    configurar();
    expect(validateCredentials("jefe@cic.com", "")).toBe(false);
  });
});

describe("en producción falla cerrado si faltan las variables", () => {
  it("rechaza las credenciales por defecto del repositorio", () => {
    vi.stubEnv("NODE_ENV", "production");
    vi.stubEnv("ADMIN_EMAIL", undefined);
    vi.stubEnv("ADMIN_PASSWORD", undefined);
    vi.stubEnv("ADMIN_SESSION_SECRET", undefined);

    expect(validateCredentials("admin@cicinmuebles.com", "cic-admin-2026")).toBe(false);
  });

  it("rechaza cualquier credencial si falta solo ADMIN_SESSION_SECRET", () => {
    vi.stubEnv("NODE_ENV", "production");
    vi.stubEnv("ADMIN_EMAIL", "jefe@cic.com");
    vi.stubEnv("ADMIN_PASSWORD", "clave-fuerte");
    vi.stubEnv("ADMIN_SESSION_SECRET", undefined);

    expect(validateCredentials("jefe@cic.com", "clave-fuerte")).toBe(false);
  });

  it("no acepta sesiones firmadas con el secreto por defecto", () => {
    // Token emitido en un entorno mal configurado (usa el secreto del repo)...
    const token = createSessionToken("admin@cicinmuebles.com");
    expect(verifySessionToken(token)).not.toBeNull();

    // ...no debe valer nada en producción sin configurar.
    vi.stubEnv("NODE_ENV", "production");
    vi.stubEnv("ADMIN_SESSION_SECRET", undefined);
    expect(verifySessionToken(token)).toBeNull();
  });

  it("no emite sesiones nuevas mientras esté mal configurado", () => {
    vi.stubEnv("NODE_ENV", "production");
    vi.stubEnv("ADMIN_SESSION_SECRET", undefined);
    expect(() => createSessionToken("jefe@cic.com")).toThrow();
  });
});

describe("verifySessionToken", () => {
  it("acepta un token recién emitido y devuelve el correo", () => {
    configurar();
    const payload = verifySessionToken(createSessionToken("jefe@cic.com"));
    expect(payload?.email).toBe("jefe@cic.com");
  });

  it("rechaza token vacío, malformado o con firma inválida", () => {
    configurar();
    expect(verifySessionToken(null)).toBeNull();
    expect(verifySessionToken("")).toBeNull();
    expect(verifySessionToken("sinpunto")).toBeNull();

    const [data] = createSessionToken("jefe@cic.com").split(".");
    expect(verifySessionToken(`${data}.firmaFalsa`)).toBeNull();
  });

  it("rechaza un token firmado con otro secreto", () => {
    configurar("jefe@cic.com", "clave-fuerte", "secreto-A");
    const token = createSessionToken("jefe@cic.com");

    vi.stubEnv("ADMIN_SESSION_SECRET", "secreto-B");
    expect(verifySessionToken(token)).toBeNull();
  });

  it("rechaza un token vencido", () => {
    configurar();
    expect(verifySessionToken(createSessionToken("jefe@cic.com", -1000))).toBeNull();
  });
});
