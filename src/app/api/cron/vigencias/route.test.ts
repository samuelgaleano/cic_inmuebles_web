import { beforeEach, describe, expect, it, vi } from "vitest";

const { revisarVencimientos, sendPagosAlert, registrarLatido } = vi.hoisted(() => ({
  revisarVencimientos: vi.fn(),
  sendPagosAlert: vi.fn(),
  registrarLatido: vi.fn(),
}));

vi.mock("@/lib/servicios/procesar", () => ({ revisarVencimientos }));
vi.mock("@/lib/notifications/payment", () => ({ sendPagosAlert }));
vi.mock("@/lib/salud/latidos", () => ({ registrarLatido }));

const { GET } = await import("./route");

function get(auth?: string) {
  return GET(new Request("https://www.cicinmuebles.com/api/cron/vigencias", { headers: auth ? { authorization: auth } : {} }));
}

const OK = { disponible: true, revisados: 2, vencidos: 1, avisosEnviados: 1, sinCorreo: 0, fallos: 0 };

describe("GET /api/cron/vigencias", () => {
  beforeEach(() => {
    process.env.CRON_SECRET = "cron-secret";
    revisarVencimientos.mockReset().mockResolvedValue(OK);
    sendPagosAlert.mockReset().mockResolvedValue(true);
    registrarLatido.mockReset().mockResolvedValue(undefined);
    vi.spyOn(console, "error").mockImplementation(() => {});
    vi.spyOn(console, "warn").mockImplementation(() => {});
  });

  it("401 sin el Bearer correcto, sin revisar nada ni dejar latido", async () => {
    expect((await get()).status).toBe(401);
    expect((await get("Bearer otro")).status).toBe(401);
    expect(revisarVencimientos).not.toHaveBeenCalled();
    expect(registrarLatido).not.toHaveBeenCalled();
  });

  it("revisa las vigencias, devuelve solo conteos y deja el latido en verde", async () => {
    const res = await get("Bearer cron-secret");
    expect(res.status).toBe(200);
    expect(await res.json()).toMatchObject({ ok: true, ...OK });
    expect(registrarLatido).toHaveBeenCalledWith("cron-vigencias", true, undefined);
    expect(sendPagosAlert).not.toHaveBeenCalled();
  });

  it("sin la migración 0004 avisa en el log y no lo trata como fallo", async () => {
    revisarVencimientos.mockResolvedValue({ ...OK, disponible: false });
    const warn = vi.spyOn(console, "warn").mockImplementation(() => {});
    const res = await get("Bearer cron-secret");
    expect(res.status).toBe(200);
    expect(warn).toHaveBeenCalledWith(expect.stringContaining("aplicar migracion 0004"));
    expect(registrarLatido).toHaveBeenCalledWith("cron-vigencias", true, "sin tablas de vigencias");
  });

  it("si falla: 500, alerta sin el mensaje de error y latido en rojo", async () => {
    revisarVencimientos.mockRejectedValue(new Error("fallo con ana@correo.com"));
    const res = await get("Bearer cron-secret");
    expect(res.status).toBe(500);
    expect(sendPagosAlert).toHaveBeenCalledTimes(1);
    const [asunto, texto] = sendPagosAlert.mock.calls[0];
    expect(`${asunto}\n${texto}`).not.toContain("ana@correo.com");
    expect(texto).toContain("/api/cron/vigencias");
    expect(registrarLatido).toHaveBeenCalledWith("cron-vigencias", false, expect.any(String));
  });

  it("un fallo al enviar la alerta no tumba la respuesta ni el latido", async () => {
    revisarVencimientos.mockRejectedValue(new Error("boom"));
    sendPagosAlert.mockRejectedValue(new Error("resend caído"));
    const res = await get("Bearer cron-secret");
    expect(res.status).toBe(500);
    expect(registrarLatido).toHaveBeenCalledWith("cron-vigencias", false, expect.any(String));
  });
});
