import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

const recordReference = vi.fn(async () => {});
vi.mock("@/lib/pagos/store", () => ({
  isPagosStoreConfigured: () => true,
  getPagosStore: () => ({ recordReference }),
}));

import { POST } from "./route";

function peticion(body: unknown, headers: Record<string, string> = {}) {
  return new Request("https://www.cicinmuebles.com/api/pagos/wompi", {
    method: "POST",
    headers: { "content-type": "application/json", origin: "https://www.cicinmuebles.com", ...headers },
    body: typeof body === "string" ? body : JSON.stringify(body),
  });
}

describe("POST /api/pagos/wompi", () => {
  beforeEach(() => {
    vi.stubEnv("WOMPI_PUBLIC_KEY", "pub_test_x");
    vi.stubEnv("WOMPI_PRIVATE_KEY", "prv_test_x");
    vi.stubEnv("WOMPI_INTEGRITY_SECRET", "test_integrity_x");
    vi.stubEnv("WOMPI_EVENTS_SECRET", "test_events_x");
    vi.stubEnv("RENOVACION_SECRET", "secreto");
    recordReference.mockReset();
    recordReference.mockResolvedValue(undefined);
  });
  afterEach(() => vi.unstubAllEnvs());

  it("prepara el pago con el monto del catálogo y registra la referencia", async () => {
    const r = await POST(peticion({ planId: "alianza-90", consentimiento: true }));
    const d = await r.json();
    expect(r.status).toBe(200);
    expect(d.amountInCents).toBe(1_000_000);
    expect(recordReference).toHaveBeenCalledWith(expect.objectContaining({ planId: "alianza-90", amountInCents: 1_000_000, renuevaServicioId: null }));
  });

  it("sin la casilla de autorización marcada no prepara el cobro ni registra nada", async () => {
    for (const consentimiento of [undefined, false, "si", 1]) {
      const r = await POST(peticion({ planId: "alianza-90", consentimiento }));
      expect(r.status, String(consentimiento)).toBe(400);
      expect((await r.json()).error).toMatch(/autorización/);
    }
    expect(recordReference).not.toHaveBeenCalled();
  });

  it("guarda la autorización con su versión y el origen ya limpio", async () => {
    const { POLITICA_VERSION } = await import("@/lib/config/legal");
    await POST(
      peticion({
        planId: "alianza-90",
        consentimiento: true,
        origen: { utmSource: " instagram ", referente: "www.Instagram.com", paginaEntrada: "/publica?x=1", utmMedium: 42 },
      }),
    );
    expect(recordReference).toHaveBeenCalledWith(
      expect.objectContaining({
        consentimientoVersion: POLITICA_VERSION,
        consentimientoAt: expect.any(String),
        origen: { utmSource: "instagram", referente: "instagram.com", paginaEntrada: "/publica" },
      }),
    );
  });

  it("rechaza cuerpos raros sin error 500", async () => {
    expect((await POST(peticion("null"))).status).toBe(400);
    expect((await POST(peticion({ planId: 5 }))).status).toBe(400);
    expect((await POST(peticion({ planId: "../../x" }))).status).toBe(400);
    expect((await POST(peticion({ planId: "no-existe" }))).status).toBe(404);
  });

  it("rechaza otro origen y otro tipo de contenido", async () => {
    expect((await POST(peticion({ planId: "alianza-90", consentimiento: true }, { origin: "https://evil.example" }))).status).toBe(403);
    expect((await POST(peticion({ planId: "alianza-90", consentimiento: true }, { "content-type": "text/plain" }))).status).toBe(415);
  });

  it("si la referencia no se puede registrar, no entrega la firma", async () => {
    recordReference.mockRejectedValueOnce(new Error("supabase caído"));
    const r = await POST(peticion({ planId: "alianza-90", consentimiento: true }));
    expect(r.status).toBe(503);
    expect((await r.json()).signature).toBeUndefined();
  });

  it("un token de renovación válido liga la referencia al servicio; uno falso no", async () => {
    const { tokenDeRenovacion } = await import("@/lib/servicios/token");
    const id = "00000000-0000-4000-8000-000000000001";
    await POST(peticion({ planId: "alianza-90", consentimiento: true, renovar: tokenDeRenovacion(id) }));
    expect(recordReference).toHaveBeenLastCalledWith(expect.objectContaining({ renuevaServicioId: id }));
    await POST(peticion({ planId: "alianza-90", consentimiento: true, renovar: `${id}.1999999999.falso` }));
    expect(recordReference).toHaveBeenLastCalledWith(expect.objectContaining({ renuevaServicioId: null }));
  });
});
