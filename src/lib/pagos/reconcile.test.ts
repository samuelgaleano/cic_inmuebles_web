import { beforeEach, describe, expect, it, vi } from "vitest";
import { MemoryPagosStore } from "./memory-store";
import { reconcile } from "./reconcile";
import type { ProcessDeps } from "./process";
import type { WompiTransaction } from "@/lib/integrations/wompi";

const base: WompiTransaction = {
  id: "1234-1610641025-49201",
  status: "APPROVED",
  reference: "CIC-alianza-90-123456-1700000000000",
  amountInCents: 1_000_000,
  currency: "COP",
  customerEmail: null,
};

const HORA = 3_600_000;

describe("reconcile", () => {
  let store: MemoryPagosStore;
  let deps: ProcessDeps;
  let now: number;
  beforeEach(() => {
    now = 1_800_000_000_000;
    store = new MemoryPagosStore();
    store.now = () => now;
    deps = {
      store,
      fetchTransaction: vi.fn(async (id: string) => ({ ...base, id })),
      fetchTransactionsByReference: vi.fn(async () => []),
      sendPaymentNotification: vi.fn(async () => true),
      sendPagosAlert: vi.fn(async () => true),
    };
  });

  const evento = (txId: string, status: string, estado: "ok" | "sin_verificar" = "ok", ts = 1) =>
    store.recordEvent({ txId, status, eventTimestamp: ts, source: "webhook", reference: estado === "ok" ? base.reference : null, amountInCents: estado === "ok" ? 1_000_000 : null, planId: estado === "ok" ? "alianza-90" : null, amountOk: estado === "ok" ? true : null, estado, raw: null });

  it("re-consulta las PENDING y las sin_verificar, y notifica las aprobadas no notificadas", async () => {
    await evento("tx-1", "PENDING");
    await evento("tx-2", "APPROVED", "sin_verificar", 2);
    await evento("tx-3", "APPROVED", "ok", 3);
    await evento("tx-4", "APPROVED", "ok", 4);
    await store.claimNotification("tx-4");
    await store.markNotified("tx-4"); // ya notificada: no se toca

    const r = await reconcile(deps);

    expect(r.revisadas.sort()).toEqual(["tx-1", "tx-2", "tx-3"]);
    expect(deps.fetchTransaction).toHaveBeenCalledTimes(3);
    expect(deps.sendPaymentNotification).toHaveBeenCalledTimes(3);
    expect(store.eventos.filter((e) => e.source === "cron")).toHaveLength(3);
    expect(deps.sendPagosAlert).not.toHaveBeenCalled();
  });

  it("descubre por referencia un pago que no llegó ni por webhook ni por retorno", async () => {
    await store.recordReference({ reference: base.reference, planId: "alianza-90", amountInCents: 1_000_000 });
    now += 2 * HORA;
    (deps.fetchTransactionsByReference as ReturnType<typeof vi.fn>).mockResolvedValue([base]);

    const r = await reconcile(deps);

    expect(deps.fetchTransactionsByReference).toHaveBeenCalledWith(base.reference);
    expect(r.resultados[base.id]).toBe("ok:APPROVED notificado");
    expect(deps.sendPaymentNotification).toHaveBeenCalledTimes(1);
    expect(r.referenciasAbandonadas).toEqual([]);
    expect(deps.sendPagosAlert).not.toHaveBeenCalled();
  });

  it("un checkout abandonado se reporta UNA sola vez", async () => {
    await store.recordReference({ reference: base.reference, planId: "alianza-90", amountInCents: 1_000_000 });
    now += 2 * HORA;

    const r1 = await reconcile(deps);
    expect(r1.referenciasAbandonadas).toEqual([base.reference]);
    expect(deps.sendPagosAlert).toHaveBeenCalledTimes(1);

    now += 24 * HORA;
    const r2 = await reconcile(deps);
    expect(r2.referenciasAbandonadas).toEqual([]);
    expect(deps.sendPagosAlert).toHaveBeenCalledTimes(1);
  });

  it("no busca referencias recién emitidas (menos de 1 h) ni viejas (más de 7 días)", async () => {
    await store.recordReference({ reference: "CIC-anual-5-111111-1700000000000", planId: "anual-5", amountInCents: 23_990_000 });
    now += 30 * 60_000;
    await reconcile(deps);
    expect(deps.fetchTransactionsByReference).not.toHaveBeenCalled();

    now += 8 * 24 * HORA;
    await reconcile(deps);
    expect(deps.fetchTransactionsByReference).not.toHaveBeenCalled();
  });

  it("si Wompi no responde la búsqueda, la referencia se reintenta mañana y se avisa", async () => {
    await store.recordReference({ reference: base.reference, planId: "alianza-90", amountInCents: 1_000_000 });
    now += 2 * HORA;
    (deps.fetchTransactionsByReference as ReturnType<typeof vi.fn>).mockResolvedValue(null);
    const r = await reconcile(deps);
    expect(r.referenciasSinRespuesta).toEqual([base.reference]);
    expect(deps.sendPagosAlert).toHaveBeenCalledTimes(1);
    expect((await store.referencesWithoutEvents(60, 7)).map((x) => x.reference)).toEqual([base.reference]);
  });

  it("una aprobada cuyo aviso sigue fallando aparece en la alerta", async () => {
    await evento("tx-9", "APPROVED", "ok", 9);
    (deps.sendPaymentNotification as ReturnType<typeof vi.fn>).mockResolvedValue(false);
    await reconcile(deps);
    expect(deps.sendPagosAlert).toHaveBeenCalledTimes(1);
    expect((deps.sendPagosAlert as ReturnType<typeof vi.fn>).mock.calls[0][0]).toContain("1 aprobadas sin aviso");
  });

  it("un fallo en una transacción no detiene a las demás", async () => {
    await evento("tx-a", "PENDING", "ok", 1);
    await evento("tx-b", "PENDING", "ok", 2);
    (deps.fetchTransaction as ReturnType<typeof vi.fn>).mockImplementation(async (id: string) => {
      if (id === "tx-a") throw new Error("boom");
      return { ...base, id };
    });
    const r = await reconcile(deps);
    expect(r.resultados["tx-a"]).toMatch(/^error:/);
    expect(r.resultados["tx-b"]).toBe("ok:APPROVED notificado");
  });

  it("purga el payload crudo de más de 72 h", async () => {
    await store.recordEvent({ txId: "old", status: "APPROVED", eventTimestamp: 5, source: "webhook", reference: base.reference, amountInCents: 1_000_000, planId: "alianza-90", amountOk: true, estado: "ok", raw: { pii: "x" } });
    await store.claimNotification("old");
    await store.markNotified("old");
    now += 80 * HORA;
    const r = await reconcile(deps);
    expect(r.rawPurgados).toBe(1);
    expect(store.eventos[0].raw).toBeNull();
  });

  it("no alerta cuando no hay nada pendiente", async () => {
    const r = await reconcile(deps);
    expect(r.revisadas).toEqual([]);
    expect(deps.sendPagosAlert).not.toHaveBeenCalled();
  });
});
