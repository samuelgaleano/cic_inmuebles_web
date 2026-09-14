import { amountMatchesPlan, getPlan, wompiAmountInCents, type Plan } from "@/lib/config/plans";
import {
  WOMPI_TX_ID,
  fetchTransaction as fetchTransactionFromApi,
  fetchTransactionsByReference as fetchTransactionsByReferenceFromApi,
  planIdFromReference,
  type WompiTransaction,
} from "@/lib/integrations/wompi";
import { sendPagosAlert as sendPagosAlertReal, sendPaymentNotification as sendPaymentNotificationReal, type PaymentNotice } from "@/lib/notifications/payment";
import { getPagosStore, type PagoEstado, type PagoSource, type PagosStore } from "./store";

export interface ProcessDeps {
  store: PagosStore;
  fetchTransaction: (txId: string) => Promise<WompiTransaction | null>;
  fetchTransactionsByReference: (reference: string) => Promise<WompiTransaction[] | null>;
  sendPaymentNotification: (p: PaymentNotice) => Promise<boolean>;
  sendPagosAlert: (subject: string, text: string) => Promise<boolean>;
}

export type ProcessOutcome = PagoEstado | "dedup" | "store_error";

export interface ProcessResult {
  outcome: ProcessOutcome;
  status?: string;
  reference?: string;
  planNombre?: string;
  notified?: boolean;
}

export interface ProcessOptions {
  source: PagoSource;
  /** Tiempo UNIX del evento de Wompi (solo webhook). */
  eventTimestamp?: number;
  /** Status del payload, usado solo si la API no responde (solo webhook). */
  fallbackStatus?: string;
  /** Payload crudo del webhook; se guarda solo para esa fuente. */
  raw?: unknown;
  /** Transacción ya consultada (evita una segunda llamada a la API). */
  tx?: WompiTransaction;
}

export function defaultDeps(): ProcessDeps {
  return {
    store: getPagosStore(),
    fetchTransaction: fetchTransactionFromApi,
    fetchTransactionsByReference: fetchTransactionsByReferenceFromApi,
    sendPaymentNotification: sendPaymentNotificationReal,
    sendPagosAlert: sendPagosAlertReal,
  };
}

type Classified =
  | { estado: "sin_destino"; plan?: undefined; planId?: string; amountOk: null }
  | { estado: "ok" | "revisar"; plan: Plan; planId: string; amountOk: boolean };

function classify(tx: WompiTransaction): Classified {
  const planId = planIdFromReference(tx.reference);
  const plan = planId ? getPlan(planId) : undefined;
  if (!plan || !planId) return { estado: "sin_destino", planId, amountOk: null };
  const amountOk = amountMatchesPlan(plan, tx.amountInCents);
  return { estado: amountOk ? "ok" : "revisar", plan, planId, amountOk };
}

function prefijo(reference: string | null | undefined): string {
  return (reference ?? "").split("-")[0] || "(vacía)";
}

function describe(err: unknown): string {
  return err instanceof Error ? err.message : String(err);
}

/**
 * Procesa una transacción venga de donde venga (webhook, retorno del widget o
 * cron). La API de Wompi es la fuente de verdad; el evento se persiste con
 * clave única (anti-replay) y el aviso al negocio se reclama de forma atómica,
 * así que llamar varias veces —incluso a la vez— es seguro.
 */
export async function processTransaction(
  txId: string,
  opts: ProcessOptions,
  deps: ProcessDeps = defaultDeps(),
): Promise<ProcessResult> {
  const { store } = deps;
  const eventTimestamp = opts.source === "webhook" ? (opts.eventTimestamp ?? 0) : 0;
  const raw = opts.source === "webhook" ? (opts.raw ?? null) : null;

  const tx = opts.tx ?? (await deps.fetchTransaction(txId));
  if (!tx) {
    if (opts.source === "webhook") {
      try {
        await store.recordEvent({
          txId, status: opts.fallbackStatus ?? "DESCONOCIDO", eventTimestamp, source: "webhook",
          reference: null, amountInCents: null, planId: null, amountOk: null,
          estado: "sin_verificar", raw,
        });
      } catch (err) {
        console.error("[pago] no se pudo registrar el evento sin verificar:", describe(err));
        return { outcome: "store_error" };
      }
    }
    console.warn(`[pago] API de Wompi sin respuesta para ${txId} (${opts.source})`);
    return { outcome: "sin_verificar" };
  }

  const c = classify(tx);
  let recorded: "inserted" | "updated" | "duplicate";
  try {
    recorded = await store.recordEvent({
      txId: tx.id, status: tx.status, eventTimestamp, source: opts.source,
      reference: tx.reference, amountInCents: tx.amountInCents ?? null,
      planId: c.planId ?? null, amountOk: c.amountOk, estado: c.estado, raw,
    });
  } catch (err) {
    console.error("[pago] no se pudo registrar el evento:", describe(err));
    return { outcome: "store_error" };
  }
  const nuevo = recorded !== "duplicate";

  console.info(`[pago] ${tx.id} ${tx.status} ${prefijo(tx.reference)} ${c.estado} via ${opts.source}${nuevo ? "" : " (dup)"}`);

  if (c.estado === "sin_destino") {
    if (nuevo) {
      await deps.sendPagosAlert(
        `Referencia sin destino (${tx.status})`,
        [`Transacción Wompi: ${tx.id}`, `Estado: ${tx.status}`, `Referencia: ${tx.reference || "(vacía)"}`, `Monto (centavos): ${tx.amountInCents ?? "—"}`, `Fuente: ${opts.source}`, "", "No corresponde a ningún plan de CIC. No se notificó al cliente."].join("\n"),
      );
    }
    return { outcome: nuevo ? "sin_destino" : "dedup", status: tx.status, reference: tx.reference };
  }

  const notified = tx.status === "APPROVED" ? await notifyOnce(tx, c, deps) : false;

  if (c.estado === "revisar" && nuevo) {
    await deps.sendPagosAlert(
      `Monto distinto al plan (${tx.status})`,
      [`Transacción Wompi: ${tx.id}`, `Referencia: ${tx.reference}`, `Plan: ${c.plan.nombre}`, `Recibido (centavos): ${tx.amountInCents ?? "—"}`, `Esperado (centavos): ${wompiAmountInCents(c.plan)}`, `Fuente: ${opts.source}`].join("\n"),
    );
  }

  return {
    outcome: nuevo ? c.estado : "dedup",
    status: tx.status,
    reference: tx.reference,
    planNombre: c.plan.nombre,
    notified,
  };
}

/**
 * Envía el aviso de pago aprobado una sola vez por transacción. El reclamo es
 * atómico en la base; si Resend falla se libera para que el siguiente intento
 * (retorno, webhook o cron) lo retome. Un fallo del store aquí nunca rompe al
 * llamador: el aviso se reintenta en la reconciliación.
 */
async function notifyOnce(tx: WompiTransaction, c: Classified & { estado: "ok" | "revisar" }, deps: ProcessDeps): Promise<boolean> {
  const { store } = deps;
  let claimed = false;
  try {
    claimed = await store.claimNotification(tx.id);
  } catch (err) {
    console.error(`[pago] no se pudo reclamar el aviso de ${tx.id}:`, describe(err));
    return false;
  }
  if (!claimed) return false;

  const sent = await deps.sendPaymentNotification({
    reference: tx.reference,
    status: "APPROVED",
    transactionId: tx.id,
    amountInCents: tx.amountInCents,
    planNombre: c.plan.nombre,
    customerEmail: tx.customerEmail,
    montoCoincide: c.amountOk,
  });

  try {
    if (sent) await store.markNotified(tx.id);
    else {
      await store.releaseNotification(tx.id);
      console.error(`[pago] aviso de ${tx.id} no enviado; lo reintentará la reconciliación`);
    }
  } catch (err) {
    console.error(`[pago] no se pudo ${sent ? "marcar" : "liberar"} el aviso de ${tx.id}:`, describe(err));
  }
  return sent;
}

/** Referencias que emite CIC: CIC-<planId>-<6 dígitos>-<timestamp>. */
const CIC_REFERENCE = /^CIC-[a-z0-9-]{1,40}-\d{6}-\d{10,16}$/;

/**
 * Confirmación desde la página de retorno del widget. Exige id y referencia
 * con la forma esperada y que la referencia devuelta por la API coincida con
 * la del redirect: la cuenta de Wompi es compartida y un id ajeno no debe
 * revelar nada ni disparar consultas. Nunca lanza: la página siempre renderiza.
 */
export async function confirmFromRedirect(
  txId: string,
  reference: string,
  deps: ProcessDeps = defaultDeps(),
): Promise<{ found: false } | { found: true; status: string; reference: string; amountInCents?: number }> {
  if (!WOMPI_TX_ID.test(txId) || !CIC_REFERENCE.test(reference)) return { found: false };
  try {
    const tx = await deps.fetchTransaction(txId);
    if (!tx || tx.reference !== reference) return { found: false };
    const r = await processTransaction(txId, { source: "redirect", tx }, deps);
    if (r.outcome === "store_error") return { found: false };
    return { found: true, status: tx.status, reference: tx.reference, amountInCents: tx.amountInCents };
  } catch (err) {
    console.error(`[pago] confirmación por retorno falló para ${txId}:`, describe(err));
    return { found: false };
  }
}
