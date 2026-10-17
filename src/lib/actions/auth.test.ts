import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

const { fijar, redirigir } = vi.hoisted(() => ({
  fijar: vi.fn(),
  redirigir: vi.fn((url: string) => {
    throw new Error(`NEXT_REDIRECT:${url}`);
  }),
}));

vi.mock("next/headers", () => ({ cookies: async () => ({ set: fijar, delete: vi.fn() }) }));
vi.mock("next/navigation", () => ({ redirect: redirigir }));

import { loginAction } from "./auth";

function form(email: string, password: string): FormData {
  const fd = new FormData();
  fd.set("email", email);
  fd.set("password", password);
  return fd;
}

beforeEach(() => {
  vi.useFakeTimers();
  fijar.mockClear();
  redirigir.mockClear();
  vi.stubEnv("ADMIN_EMAIL", "jefe@cic.com");
  vi.stubEnv("ADMIN_PASSWORD", "clave-fuerte");
  vi.stubEnv("ADMIN_SESSION_SECRET", "secreto-largo");
});

afterEach(() => {
  vi.useRealTimers();
  vi.unstubAllEnvs();
});

describe("loginAction", () => {
  it("credenciales invalidas: no responde antes de ~1 s y no deja cookie", async () => {
    for (const [email, clave] of [
      ["jefe@cic.com", "mala"],
      ["otro@cic.com", "clave-fuerte"],
    ]) {
      let resuelto = false;
      const p = loginAction({}, form(email, clave)).then((r) => {
        resuelto = true;
        return r;
      });
      await vi.advanceTimersByTimeAsync(999);
      expect(resuelto).toBe(false);
      await vi.advanceTimersByTimeAsync(1);
      expect(await p).toEqual({ error: "Correo o contraseña incorrectos." });
    }
    expect(fijar).not.toHaveBeenCalled();
  });

  it("credenciales validas: entra sin espera y fija la cookie de sesion", async () => {
    await expect(loginAction({}, form(" Jefe@CIC.com ", "clave-fuerte"))).rejects.toThrow("NEXT_REDIRECT:/admin");
    expect(fijar).toHaveBeenCalledWith("cic_admin", expect.any(String), expect.objectContaining({ httpOnly: true }));
  });
});
