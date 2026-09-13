import { beforeEach, describe, expect, it, vi } from "vitest";

vi.mock("@/lib/pagos/store", () => ({
  isPagosStoreConfigured: () => true,
  getPagosStore: () => ({ trace: async () => [{ id: 1, txId: "t", raw: { secreto: 1 }, status: "APPROVED" }] }),
}));
vi.mock("@/lib/pagos/reconcile", () => ({ reconcile: async () => ({ revisadas: [], resultados: {}, referenciasAbandonadas: [], referenciasSinRespuesta: [], rawPurgados: 0 }) }));
vi.mock("@/lib/pagos/process", () => ({ defaultDeps: () => ({}) }));

const { GET } = await import("./route");

function get(path: string, auth?: string) {
  return GET(new Request(`https://www.cicinmuebles.com${path}`, { headers: auth ? { authorization: auth } : {} }));
}

describe("GET /api/pagos/wompi/reconciliar", () => {
  beforeEach(() => {
    process.env.CRON_SECRET = "cron-secret";
  });

  it("401 sin Bearer, con Bearer incorrecto o sin CRON_SECRET configurado", async () => {
    expect((await get("/api/pagos/wompi/reconciliar")).status).toBe(401);
    expect((await get("/api/pagos/wompi/reconciliar", "Bearer nope")).status).toBe(401);
    delete process.env.CRON_SECRET;
    expect((await get("/api/pagos/wompi/reconciliar", "Bearer cron-secret")).status).toBe(401);
  });

  it("corre la reconciliación con el Bearer correcto", async () => {
    const res = await get("/api/pagos/wompi/reconciliar", "Bearer cron-secret");
    expect(res.status).toBe(200);
    expect(await res.json()).toMatchObject({ ok: true, revisadas: [] });
  });

  it("?tx= devuelve la traza sin el payload crudo", async () => {
    const res = await get("/api/pagos/wompi/reconciliar?tx=t", "Bearer cron-secret");
    const body = await res.json();
    expect(body.eventos[0]).not.toHaveProperty("raw");
    expect(body.eventos[0].status).toBe("APPROVED");
  });
});
