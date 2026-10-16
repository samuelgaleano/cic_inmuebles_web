import { describe, expect, it, vi } from "vitest";
import type { WompiTransaction } from "@/lib/integrations/wompi";
import { MemoryPagosStore } from "./memory-store";
import { processTransaction, type ProcessDeps } from "./process";

const TX: WompiTransaction = {
  id: "1234-1610641025-49201",
  status: "APPROVED",
  reference: "CIC-alianza-90-123456-1700000000000",
  amountInCents: 1_000_000,
  currency: "COP",
  customerEmail: "comprador@x.co",
};

function deps(tx: WompiTransaction, registrarServicio: ProcessDeps["registrarServicio"]): ProcessDeps {
  return {
    store: new MemoryPagosStore(),
    fetchTransaction: vi.fn(async () => tx),
    fetchTransactionsByReference: vi.fn(async () => [tx]),
    sendPaymentNotification: vi.fn(async () => true),
    sendPagosAlert: vi.fn(async () => true),
    registrarServicio,
  };
}

describe("processTransaction → servicio de publicación", () => {
  it("un pago aprobado con el monto del plan abre su servicio", async () => {
    const registrar = vi.fn<NonNullable<ProcessDeps["registrarServicio"]>>(async () => {});
    await processTransaction(TX.id, { source: "redirect" }, deps(TX, registrar));
    expect(registrar).toHaveBeenCalledTimes(1);
    expect(registrar.mock.calls[0][1].id).toBe("alianza-90");
  });

  it("un pago rechazado, pendiente o con monto distinto no abre servicio", async () => {
    for (const tx of [{ ...TX, status: "DECLINED" }, { ...TX, status: "PENDING" }, { ...TX, amountInCents: 5 }]) {
      const registrar = vi.fn(async () => {});
      await processTransaction(tx.id, { source: "redirect" }, deps(tx, registrar));
      expect(registrar).not.toHaveBeenCalled();
    }
  });

  it("si registrar el servicio falla, el pago igual se procesa y se avisa al negocio", async () => {
    const d = deps(TX, async () => {
      throw new Error("sin tabla");
    });
    const r = await processTransaction(TX.id, { source: "redirect" }, d);
    expect(r.outcome).toBe("ok");
    expect(r.notified).toBe(true);
  });
});
