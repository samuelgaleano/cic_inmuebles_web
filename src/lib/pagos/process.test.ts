import { beforeEach, describe, expect, it, vi } from "vitest";
import { MemoryPagosStore } from "./memory-store";
import { confirmFromRedirect, processTransaction, type ProcessDeps } from "./process";
import type { WompiTransaction } from "@/lib/integrations/wompi";

const APROBADA: WompiTransaction = {
  id: "1234-1610641025-49201",
  status: "APPROVED",
  reference: "CIC-alianza-90-123456-1700000000000",
  amountInCents: 1_000_000,
  currency: "COP",
  customerEmail: "comprador@x.co",
};

type Deps = ProcessDeps & { store: MemoryPagosStore };

function deps(overrides: Partial<ProcessDeps> = {}): Deps {
  const store = new MemoryPagosStore();
  return {
    store,
    fetchTransaction: vi.fn(async () => APROBADA),
    fetchTransactionsByReference: vi.fn(async () => [APROBADA]),
    sendPaymentNotification: vi.fn(async () => true),
    sendPagosAlert: vi.fn(async () => true),
    ...overrides,
  } as Deps;
}

const fetchMock = (d: Deps) => d.fetchTransaction as ReturnType<typeof vi.fn>;
const notifyMock = (d: Deps) => d.sendPaymentNotification as ReturnType<typeof vi.fn>;

describe("processTransaction", () => {
  let d: Deps;
  beforeEach(() => {
    d = deps();
  });

  it("pago CIC aprobado con monto correcto: registra, notifica UNA vez y marca notified_at", async () => {
    const r = await processTransaction(APROBADA.id, { source: "webhook", eventTimestamp: 1700000000 }, d);
    expect(r.outcome).toBe("ok");
    expect(r.notified).toBe(true);
    expect(d.sendPaymentNotification).toHaveBeenCalledTimes(1);
    expect(d.sendPaymentNotification).toHaveBeenCalledWith(
      expect.objectContaining({ reference: APROBADA.reference, planNombre: "Alianza por resultados", montoCoincide: true, customerEmail: "comprador@x.co" }),
    );
    expect(d.store.eventos).toHaveLength(1);
    expect(d.store.eventos[0].notifiedAt).not.toBeNull();
    expect(d.store.avisos.get(APROBADA.id)?.sentAt).not.toBeNull();
    expect(d.sendPagosAlert).not.toHaveBeenCalled();
  });

  it("reintento de Wompi con el mismo timestamp: dedup y sin segundo correo", async () => {
    await processTransaction(APROBADA.id, { source: "webhook", eventTimestamp: 1700000000 }, d);
    const r = await processTransaction(APROBADA.id, { source: "webhook", eventTimestamp: 1700000000 }, d);
    expect(r.outcome).toBe("dedup");
    expect(d.sendPaymentNotification).toHaveBeenCalledTimes(1);
    expect(d.store.eventos).toHaveLength(1);
  });

  it("retorno y webhook del mismo pago EN PARALELO: un solo correo", async () => {
    await Promise.all([
      processTransaction(APROBADA.id, { source: "redirect" }, d),
      processTransaction(APROBADA.id, { source: "webhook", eventTimestamp: 1700000000 }, d),
      processTransaction(APROBADA.id, { source: "redirect" }, d),
    ]);
    expect(d.sendPaymentNotification).toHaveBeenCalledTimes(1);
    expect(d.store.eventos).toHaveLength(2);
    expect(d.store.eventos.every((e) => e.notifiedAt)).toBe(true);
  });

  it("si Resend falla, se libera el reclamo y el siguiente intento vuelve a notificar", async () => {
    notifyMock(d).mockResolvedValueOnce(false);
    const r1 = await processTransaction(APROBADA.id, { source: "webhook", eventTimestamp: 1700000000 }, d);
    expect(r1.notified).toBe(false);
    expect(d.store.eventos[0].notifiedAt).toBeNull();
    expect(d.store.avisos.has(APROBADA.id)).toBe(false);

    const r2 = await processTransaction(APROBADA.id, { source: "cron" }, d);
    expect(r2.notified).toBe(true);
    expect(d.sendPaymentNotification).toHaveBeenCalledTimes(2);
    expect(d.store.eventos.every((e) => e.notifiedAt)).toBe(true);
  });

  it("un reclamo huérfano (lambda muerta) se retoma pasados 10 minutos", async () => {
    let t = 1_800_000_000_000;
    d.store.now = () => t;
    await d.store.claimNotification(APROBADA.id); // alguien reclamó y murió sin enviar
    const r1 = await processTransaction(APROBADA.id, { source: "cron" }, d);
    expect(r1.notified).toBe(false);
    t += 11 * 60_000;
    const r2 = await processTransaction(APROBADA.id, { source: "cron" }, d);
    expect(r2.notified).toBe(true);
    expect(d.sendPaymentNotification).toHaveBeenCalledTimes(1);
  });

  it("si el store falla al reclamar o marcar, no se lanza: la reconciliación reintenta", async () => {
    d.store.failNext = "claimNotification";
    const r1 = await processTransaction(APROBADA.id, { source: "redirect" }, d);
    expect(r1.outcome).toBe("ok");
    expect(r1.notified).toBe(false);

    d.store.failNext = "markNotified";
    const r2 = await processTransaction(APROBADA.id, { source: "cron" }, d);
    expect(r2.notified).toBe(true);
    expect(d.sendPaymentNotification).toHaveBeenCalledTimes(1);
  });

  it("referencia ajena (otro comercio): sin correo al cliente, alerta a Pixies una vez, estado sin_destino", async () => {
    fetchMock(d).mockResolvedValue({ ...APROBADA, reference: "FYC-ORDEN-77" });
    const r = await processTransaction(APROBADA.id, { source: "webhook", eventTimestamp: 1 }, d);
    expect(r.outcome).toBe("sin_destino");
    const r2 = await processTransaction(APROBADA.id, { source: "webhook", eventTimestamp: 1 }, d);
    expect(r2.outcome).toBe("dedup");
    expect(d.sendPaymentNotification).not.toHaveBeenCalled();
    expect(d.sendPagosAlert).toHaveBeenCalledTimes(1);
    expect(d.store.eventos[0].estado).toBe("sin_destino");
  });

  it("referencia CIC- con plan inexistente: nunca correo APPROVED al cliente", async () => {
    fetchMock(d).mockResolvedValue({ ...APROBADA, reference: "CIC-plan-falso-1-2" });
    const r = await processTransaction(APROBADA.id, { source: "webhook", eventTimestamp: 1 }, d);
    expect(r.outcome).toBe("sin_destino");
    expect(d.sendPaymentNotification).not.toHaveBeenCalled();
    expect(d.sendPagosAlert).toHaveBeenCalledTimes(1);
  });

  it("monto distinto al del plan: correo marcado REVISAR + alerta", async () => {
    fetchMock(d).mockResolvedValue({ ...APROBADA, amountInCents: 10_000 });
    const r = await processTransaction(APROBADA.id, { source: "webhook", eventTimestamp: 1 }, d);
    expect(r.outcome).toBe("revisar");
    expect(d.sendPaymentNotification).toHaveBeenCalledWith(expect.objectContaining({ montoCoincide: false }));
    expect(d.sendPagosAlert).toHaveBeenCalledTimes(1);
  });

  it("usa la referencia de la API, no la del payload (el checksum no la cubre)", async () => {
    fetchMock(d).mockResolvedValue({ ...APROBADA, reference: "FYC-AJENA" });
    const r = await processTransaction(
      APROBADA.id,
      { source: "webhook", eventTimestamp: 1, fallbackStatus: "APPROVED", raw: { data: { transaction: { reference: APROBADA.reference } } } },
      d,
    );
    expect(r.outcome).toBe("sin_destino");
    expect(d.sendPaymentNotification).not.toHaveBeenCalled();
  });

  it("estado no aprobado (PENDING/DECLINED): se registra, sin correo", async () => {
    fetchMock(d).mockResolvedValue({ ...APROBADA, status: "DECLINED" });
    const r = await processTransaction(APROBADA.id, { source: "webhook", eventTimestamp: 1 }, d);
    expect(r.outcome).toBe("ok");
    expect(r.status).toBe("DECLINED");
    expect(d.sendPaymentNotification).not.toHaveBeenCalled();
  });

  it("API de Wompi caída en webhook: registra sin_verificar con el status del payload (lo retoma el cron)", async () => {
    fetchMock(d).mockResolvedValue(null);
    const r = await processTransaction(APROBADA.id, { source: "webhook", eventTimestamp: 1, fallbackStatus: "APPROVED" }, d);
    expect(r.outcome).toBe("sin_verificar");
    expect(d.store.eventos[0]).toMatchObject({ estado: "sin_verificar", status: "APPROVED", reference: null });
    expect(d.sendPaymentNotification).not.toHaveBeenCalled();
  });

  it("API caída y payload sin status: igual se persiste (DESCONOCIDO), nada se pierde", async () => {
    fetchMock(d).mockResolvedValue(null);
    await processTransaction(APROBADA.id, { source: "webhook", eventTimestamp: 1 }, d);
    expect(d.store.eventos[0]).toMatchObject({ estado: "sin_verificar", status: "DESCONOCIDO" });
  });

  it("el reintento del webhook completa la fila sin_verificar y dispara las alertas que faltaban", async () => {
    fetchMock(d).mockResolvedValueOnce(null);
    await processTransaction(APROBADA.id, { source: "webhook", eventTimestamp: 1, fallbackStatus: "APPROVED" }, d);
    fetchMock(d).mockResolvedValue({ ...APROBADA, reference: "FYC-AJENA" });
    const r = await processTransaction(APROBADA.id, { source: "webhook", eventTimestamp: 1, fallbackStatus: "APPROVED" }, d);
    expect(r.outcome).toBe("sin_destino");
    expect(d.store.eventos).toHaveLength(1);
    expect(d.store.eventos[0].estado).toBe("sin_destino");
    expect(d.sendPagosAlert).toHaveBeenCalledTimes(1);
  });

  it("API caída en retorno/cron: no registra nada", async () => {
    fetchMock(d).mockResolvedValue(null);
    const r = await processTransaction(APROBADA.id, { source: "redirect" }, d);
    expect(r.outcome).toBe("sin_verificar");
    expect(d.store.eventos).toHaveLength(0);
  });

  it("fallo de Supabase al registrar: store_error (el webhook responde 500)", async () => {
    d.store.failNext = "recordEvent";
    const r = await processTransaction(APROBADA.id, { source: "webhook", eventTimestamp: 1 }, d);
    expect(r.outcome).toBe("store_error");
    expect(d.sendPaymentNotification).not.toHaveBeenCalled();
  });

  it("el payload crudo solo se guarda para el webhook", async () => {
    await processTransaction(APROBADA.id, { source: "redirect", raw: { x: 1 } }, d);
    expect(d.store.eventos[0].raw).toBeNull();
  });
});

describe("confirmFromRedirect", () => {
  it("devuelve el estado real cuando id y referencia coinciden", async () => {
    const d = deps();
    const r = await confirmFromRedirect(APROBADA.id, APROBADA.reference, d);
    // El monto que se muestra al usuario es el que Wompi cobró, no el del catálogo.
    expect(r).toEqual({ found: true, status: "APPROVED", reference: APROBADA.reference, amountInCents: 1_000_000 });
    expect(d.sendPaymentNotification).toHaveBeenCalledTimes(1);
    expect(d.fetchTransaction).toHaveBeenCalledTimes(1);
  });

  it("no revela nada si la referencia no coincide (evita enumerar transacciones de la cuenta)", async () => {
    const d = deps();
    const r = await confirmFromRedirect(APROBADA.id, "CIC-anual-10-999999-1700000000001", d);
    expect(r).toEqual({ found: false });
    expect(d.store.eventos).toHaveLength(0);
    expect(d.sendPaymentNotification).not.toHaveBeenCalled();
  });

  it("no consulta la API si el id o la referencia no tienen la forma esperada", async () => {
    const d = deps();
    expect(await confirmFromRedirect("../../etc", APROBADA.reference, d)).toEqual({ found: false });
    expect(await confirmFromRedirect(APROBADA.id, "FYC-otra-cosa", d)).toEqual({ found: false });
    expect(await confirmFromRedirect(APROBADA.id, "", d)).toEqual({ found: false });
    expect(d.fetchTransaction).not.toHaveBeenCalled();
  });

  it("nunca lanza: API caída o store roto devuelven found=false", async () => {
    expect(await confirmFromRedirect(APROBADA.id, APROBADA.reference, deps({ fetchTransaction: vi.fn(async () => null) }))).toEqual({ found: false });
    const d = deps();
    d.store.failNext = "recordEvent";
    expect(await confirmFromRedirect(APROBADA.id, APROBADA.reference, d)).toEqual({ found: false });
    const d2 = deps({ fetchTransaction: vi.fn(async () => { throw new Error("boom"); }) });
    expect(await confirmFromRedirect(APROBADA.id, APROBADA.reference, d2)).toEqual({ found: false });
  });
});
