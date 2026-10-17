import { beforeEach, describe, expect, it, vi } from "vitest";

const { reconcile, purgeRaw, revisarVencimientos, sendPagosAlert } = vi.hoisted(() => ({
  reconcile: vi.fn(),
  purgeRaw: vi.fn(),
  revisarVencimientos: vi.fn(),
  sendPagosAlert: vi.fn(),
}));

vi.mock("@/lib/pagos/store", () => ({
  isPagosStoreConfigured: () => true,
  getPagosStore: () => ({
    trace: async () => [{ id: 1, txId: "t", raw: { secreto: 1 }, status: "APPROVED" }],
    purgeRaw,
  }),
}));
vi.mock("@/lib/pagos/reconcile", () => ({ reconcile }));
vi.mock("@/lib/pagos/process", () => ({ defaultDeps: () => ({}) }));
vi.mock("@/lib/servicios/procesar", () => ({ revisarVencimientos }));
vi.mock("@/lib/notifications/payment", () => ({ sendPagosAlert }));

const { GET } = await import("./route");

function get(path: string, auth?: string) {
  return GET(new Request(`https://www.cicinmuebles.com${path}`, { headers: auth ? { authorization: auth } : {} }));
}

const OK_RECONCILE = { revisadas: [], resultados: {}, referenciasAbandonadas: [], referenciasSinRespuesta: [], rawPurgados: 0 };
const OK_VIGENCIAS = { disponible: true, revisados: 0, vencidos: 0, avisosEnviados: 0, sinCorreo: 0, fallos: 0 };

describe("GET /api/pagos/wompi/reconciliar", () => {
  beforeEach(() => {
    process.env.CRON_SECRET = "cron-secret";
    vi.restoreAllMocks();
    reconcile.mockReset().mockResolvedValue(OK_RECONCILE);
    purgeRaw.mockReset().mockResolvedValue(3);
    revisarVencimientos.mockReset().mockResolvedValue(OK_VIGENCIAS);
    sendPagosAlert.mockReset().mockResolvedValue(true);
    vi.spyOn(console, "error").mockImplementation(() => {});
    vi.spyOn(console, "warn").mockImplementation(() => {});
  });

  it("401 sin Bearer, con Bearer incorrecto o sin CRON_SECRET configurado", async () => {
    expect((await get("/api/pagos/wompi/reconciliar")).status).toBe(401);
    expect((await get("/api/pagos/wompi/reconciliar", "Bearer nope")).status).toBe(401);
    expect((await get("/api/pagos/wompi/reconciliar", "Bearer cron-secret-extra")).status).toBe(401);
    delete process.env.CRON_SECRET;
    expect((await get("/api/pagos/wompi/reconciliar", "Bearer cron-secret")).status).toBe(401);
    expect(reconcile).not.toHaveBeenCalled();
  });

  it("corre la reconciliación con el Bearer correcto y no alerta si todo sale bien", async () => {
    const res = await get("/api/pagos/wompi/reconciliar", "Bearer cron-secret");
    expect(res.status).toBe(200);
    expect(await res.json()).toMatchObject({ ok: true, revisadas: [], vigencias: OK_VIGENCIAS });
    expect(sendPagosAlert).not.toHaveBeenCalled();
    // La purga ya la hizo reconcile: no se repite.
    expect(purgeRaw).not.toHaveBeenCalled();
  });

  it("?tx= devuelve la traza sin el payload crudo", async () => {
    const res = await get("/api/pagos/wompi/reconciliar?tx=t", "Bearer cron-secret");
    const body = await res.json();
    expect(body.eventos[0]).not.toHaveProperty("raw");
    expect(body.eventos[0].status).toBe("APPROVED");
  });

  it("si reconcile falla, igual purga, revisa vigencias y alerta sin el mensaje de error", async () => {
    reconcile.mockRejectedValue(new Error("fallo con ana@correo.com y ref CIC-123"));
    const res = await get("/api/pagos/wompi/reconciliar", "Bearer cron-secret");
    expect(res.status).toBe(500);
    expect(await res.json()).toMatchObject({ ok: false, rawPurgados: 3, vigencias: OK_VIGENCIAS });
    expect(purgeRaw).toHaveBeenCalledTimes(1);
    expect(revisarVencimientos).toHaveBeenCalledTimes(1);
    expect(sendPagosAlert).toHaveBeenCalledTimes(1);
    const [asunto, texto] = sendPagosAlert.mock.calls[0];
    expect(`${asunto}\n${texto}`).not.toContain("ana@correo.com");
    expect(texto).not.toContain("CIC-123");
    expect(texto).toContain("reconciliación de pagos falló");
  });

  it("si la revisión de vigencias falla, la reconciliación sigue y se alerta", async () => {
    revisarVencimientos.mockRejectedValue(new Error("boom"));
    const res = await get("/api/pagos/wompi/reconciliar", "Bearer cron-secret");
    expect(res.status).toBe(200);
    expect(await res.json()).toMatchObject({ ok: true, vigencias: { error: "falló la revisión de vigencias" } });
    expect(sendPagosAlert).toHaveBeenCalledTimes(1);
    expect(sendPagosAlert.mock.calls[0][1]).toContain("vigencias");
  });

  it("si reconcile y la purga fallan, la alerta lista ambas", async () => {
    reconcile.mockRejectedValue(new Error("x"));
    purgeRaw.mockRejectedValue(new Error("y"));
    const res = await get("/api/pagos/wompi/reconciliar", "Bearer cron-secret");
    expect(res.status).toBe(500);
    const texto: string = sendPagosAlert.mock.calls[0][1];
    expect(texto).toContain("reconciliación");
    expect(texto).toContain("72 h");
  });

  it("sin la migración 0004 avisa en el log y no lo trata como fallo", async () => {
    revisarVencimientos.mockResolvedValue({ ...OK_VIGENCIAS, disponible: false });
    const warn = vi.spyOn(console, "warn").mockImplementation(() => {});
    const res = await get("/api/pagos/wompi/reconciliar", "Bearer cron-secret");
    expect(res.status).toBe(200);
    expect(warn).toHaveBeenCalledWith(expect.stringContaining("aplicar migracion 0004"));
    expect(sendPagosAlert).not.toHaveBeenCalled();
  });

  it("un fallo al enviar la alerta no tumba la respuesta", async () => {
    revisarVencimientos.mockRejectedValue(new Error("boom"));
    sendPagosAlert.mockRejectedValue(new Error("resend caído"));
    const res = await get("/api/pagos/wompi/reconciliar", "Bearer cron-secret");
    expect(res.status).toBe(200);
  });
});
