import { beforeEach, describe, expect, it, vi } from "vitest";
import type { WompiTransaction } from "@/lib/integrations/wompi";
import { esperaDeSeguimiento } from "@/components/public/checkout-utils";
import { confirmarPorReferencia, INTERVALO_MINIMO_MS, reiniciarLimite } from "./estado";
import { MemoryPagosStore } from "./memory-store";
import type { ProcessDeps } from "./process";

const REF = "CIC-alianza-90-595037-1792296218150";
const TX: WompiTransaction = {
  id: "1446679-1792296260-41495",
  status: "APPROVED",
  reference: REF,
  amountInCents: 1_000_000,
  currency: "COP",
  customerEmail: "comprador@x.co",
};

function deps(extra: Partial<ProcessDeps> = {}) {
  const store = new MemoryPagosStore();
  const d = {
    store,
    fetchTransaction: vi.fn(async () => TX),
    fetchTransactionsByReference: vi.fn(async () => [TX]),
    sendPaymentNotification: vi.fn(async () => true),
    sendPagosAlert: vi.fn(async () => true),
    registrarServicio: vi.fn(async () => {}),
    ...extra,
  } as ProcessDeps & { store: MemoryPagosStore };
  return d;
}

describe("confirmarPorReferencia", () => {
  beforeEach(() => reiniciarLimite());

  it("un pago aprobado se registra solo: evento, aviso y servicio, sin que la persona vuelva al comercio", async () => {
    const d = deps();
    await d.store.recordReference({ reference: REF, planId: "alianza-90", amountInCents: 1_000_000 });
    const r = await confirmarPorReferencia(REF, { deps: d, fetchPorReferencia: async () => [TX] });
    expect(r).toEqual({ estado: "APPROVED", final: true });
    expect(d.store.eventos).toHaveLength(1);
    expect(d.sendPaymentNotification).toHaveBeenCalledTimes(1);
    expect(d.registrarServicio).toHaveBeenCalledTimes(1);
  });

  it("si luego la persona vuelve con su botón, no se duplica nada", async () => {
    const d = deps();
    await d.store.recordReference({ reference: REF, planId: "alianza-90", amountInCents: 1_000_000 });
    let t = 1_000_000;
    await confirmarPorReferencia(REF, { deps: d, fetchPorReferencia: async () => [TX], ahora: () => t });
    t += 60_000;
    await confirmarPorReferencia(REF, { deps: d, fetchPorReferencia: async () => [TX], ahora: () => t });
    expect(d.store.eventos).toHaveLength(1);
    expect(d.sendPaymentNotification).toHaveBeenCalledTimes(1);
  });

  it("una referencia que este sitio no emitió no se le consulta a Wompi", async () => {
    const d = deps();
    const wompi = vi.fn(async () => [TX]);
    expect(await confirmarPorReferencia(REF, { deps: d, fetchPorReferencia: wompi })).toEqual({ estado: "desconocida" });
    expect(wompi).not.toHaveBeenCalled();
    expect(await confirmarPorReferencia("basura", { deps: d, fetchPorReferencia: wompi })).toEqual({ estado: "desconocida" });
  });

  it("sin transacción todavía (aún no paga) no es final y no registra nada", async () => {
    const d = deps();
    await d.store.recordReference({ reference: REF, planId: "alianza-90", amountInCents: 1_000_000 });
    expect(await confirmarPorReferencia(REF, { deps: d, fetchPorReferencia: async () => [] })).toEqual({ estado: "sin_transaccion" });
    expect(d.store.eventos).toHaveLength(0);
  });

  it("un pago pendiente (Nequi o PSE) se registra pero no es final: se sigue consultando", async () => {
    const d = deps();
    await d.store.recordReference({ reference: REF, planId: "alianza-90", amountInCents: 1_000_000 });
    const pendiente = { ...TX, status: "PENDING" };
    expect(await confirmarPorReferencia(REF, { deps: d, fetchPorReferencia: async () => [pendiente] })).toEqual({ estado: "PENDING", final: false });
    expect(d.sendPaymentNotification).not.toHaveBeenCalled();
  });

  it("si Wompi no responde, se informa sin registrar nada", async () => {
    const d = deps();
    await d.store.recordReference({ reference: REF, planId: "alianza-90", amountInCents: 1_000_000 });
    expect(await confirmarPorReferencia(REF, { deps: d, fetchPorReferencia: async () => null })).toEqual({ estado: "sin_respuesta" });
  });

  it("limita las consultas: dos seguidas de la misma referencia no llegan a Wompi", async () => {
    const d = deps();
    await d.store.recordReference({ reference: REF, planId: "alianza-90", amountInCents: 1_000_000 });
    const wompi = vi.fn(async () => [] as WompiTransaction[]);
    const t = 5_000_000;
    await confirmarPorReferencia(REF, { deps: d, fetchPorReferencia: wompi, ahora: () => t });
    expect(await confirmarPorReferencia(REF, { deps: d, fetchPorReferencia: wompi, ahora: () => t + 1_000 })).toEqual({ estado: "espera" });
    expect(wompi).toHaveBeenCalledTimes(1);
    await confirmarPorReferencia(REF, { deps: d, fetchPorReferencia: wompi, ahora: () => t + INTERVALO_MINIMO_MS + 1 });
    expect(wompi).toHaveBeenCalledTimes(2);
  });

  it("un fallo del almacén se informa como error recuperable y no lanza", async () => {
    const d = deps();
    d.store.getReference = vi.fn(async () => {
      throw new Error("supabase caído");
    });
    expect(await confirmarPorReferencia(REF, { deps: d, fetchPorReferencia: async () => [TX] })).toEqual({ estado: "error" });
  });
});

describe("calendario de consultas del navegador", () => {
  it("5 s al inicio, luego 10 s, luego 20 s, y se detiene a los 20 minutos", () => {
    expect(esperaDeSeguimiento(0)).toBe(5_000);
    expect(esperaDeSeguimiento(119_000)).toBe(5_000);
    expect(esperaDeSeguimiento(120_000)).toBe(10_000);
    expect(esperaDeSeguimiento(300_000)).toBe(20_000);
    expect(esperaDeSeguimiento(20 * 60_000)).toBeNull();
  });
});
