import { afterEach, describe, expect, it, vi } from "vitest";
import { elegirImplementacion } from "./elegir-implementacion";

const opciones = { supabase: () => "supabase", memoria: () => "memoria" };

afterEach(() => {
  vi.unstubAllEnvs();
});

function sinSupabase() {
  vi.stubEnv("NEXT_PUBLIC_SUPABASE_URL", "");
  vi.stubEnv("SUPABASE_SERVICE_ROLE_KEY", "");
}

describe("elegirImplementacion", () => {
  it("usa Supabase cuando están las dos variables", () => {
    vi.stubEnv("NEXT_PUBLIC_SUPABASE_URL", "https://x.supabase.co");
    vi.stubEnv("SUPABASE_SERVICE_ROLE_KEY", "llave-de-prueba");
    vi.stubEnv("VERCEL_ENV", "production");
    expect(elegirImplementacion("Prueba", opciones)).toBe("supabase");
  });

  it("fuera de producción, sin Supabase, cae a memoria", () => {
    sinSupabase();
    vi.stubEnv("VERCEL_ENV", "preview");
    expect(elegirImplementacion("Prueba", opciones)).toBe("memoria");
  });

  it("en producción, sin Supabase, lanza en vez de guardar en memoria", () => {
    sinSupabase();
    vi.stubEnv("VERCEL_ENV", "production");
    const memoria = vi.fn(() => "memoria");
    expect(() => elegirImplementacion("Prueba", { ...opciones, memoria })).toThrow(/Prueba: Supabase no está configurado/);
    expect(memoria).not.toHaveBeenCalled();
  });
});
