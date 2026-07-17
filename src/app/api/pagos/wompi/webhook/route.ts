import crypto from "crypto";
import { NextResponse } from "next/server";
import { fetchTransactionStatus, planIdFromReference, wompiConfig } from "@/lib/integrations/wompi";
import { getPlan } from "@/lib/config/plans";
import { sendPaymentNotification } from "@/lib/notifications/payment";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

// Ventana de frescura del evento (anti-reenvío de payloads capturados).
const MAX_SKEW_SECONDS = 600;

// Deduplicación best-effort por instancia (Wompi reintenta entregas legítimas).
// No es persistente entre lambdas frías, pero evita avisos duplicados en la
// ráfaga de reintentos habitual. La notificación no muta estado, así que un
// duplicado esporádico tras un reinicio es inofensivo.
const processed = new Set<string>();

/** Lee un valor anidado ("transaction.amount_in_cents") desde el payload. */
function pick(obj: unknown, path: string): unknown {
  return path.split(".").reduce<unknown>((acc, key) => {
    if (acc && typeof acc === "object") return (acc as Record<string, unknown>)[key];
    return undefined;
  }, obj);
}

/**
 * Verifica el checksum oficial de Wompi:
 *   sha256( valores_de_signature.properties + timestamp + eventsSecret )
 * Los valores se toman de `data` en el orden indicado por `properties`.
 */
function verifyChecksum(payload: Record<string, unknown>, eventsSecret: string): boolean {
  const signature = payload.signature as { properties?: string[]; checksum?: string } | undefined;
  const props = signature?.properties;
  const checksum = signature?.checksum;
  if (!props || !checksum) return false;

  const concatenated = props.map((p) => String(pick(payload.data, p) ?? "")).join("");
  const computed = crypto
    .createHash("sha256")
    .update(`${concatenated}${payload.timestamp ?? ""}${eventsSecret}`)
    .digest("hex");

  const a = Buffer.from(computed, "utf8");
  const b = Buffer.from(String(checksum).toLowerCase(), "utf8");
  return a.length === b.length && crypto.timingSafeEqual(a, b);
}

export async function POST(req: Request) {
  const { eventsSecret } = wompiConfig();

  // Falla CERRADO: sin secreto de eventos no se puede validar nada, así que no
  // se acepta ningún webhook (evita que un evento "APPROVED" falso pase).
  if (!eventsSecret) {
    console.warn("[pago] webhook rechazado: falta WOMPI_EVENTS_SECRET");
    return NextResponse.json({ ok: false, error: "webhook no configurado" }, { status: 503 });
  }

  let payload: Record<string, unknown>;
  try {
    payload = await req.json();
  } catch {
    return NextResponse.json({ ok: false }, { status: 400 });
  }

  if (!verifyChecksum(payload, eventsSecret)) {
    return NextResponse.json({ ok: false, error: "checksum inválido" }, { status: 401 });
  }

  // Rechaza eventos fuera de la ventana de frescura (anti-replay).
  const ts = Number(payload.timestamp);
  if (Number.isFinite(ts) && Math.abs(Date.now() / 1000 - ts) > MAX_SKEW_SECONDS) {
    return NextResponse.json({ ok: false, error: "evento vencido" }, { status: 401 });
  }

  if (payload.event !== "transaction.updated") {
    return NextResponse.json({ ok: true });
  }

  const tx = pick(payload.data, "transaction") as
    | { id?: string; status?: string; reference?: string; amount_in_cents?: number; customer_email?: string }
    | undefined;

  if (!tx?.id || !tx.reference) {
    return NextResponse.json({ ok: true });
  }

  // Idempotencia: no reprocesar el mismo evento (reintentos de Wompi).
  const dedupKey = `${tx.id}:${tx.status}`;
  if (processed.has(dedupKey)) {
    return NextResponse.json({ ok: true, dedup: true });
  }
  processed.add(dedupKey);

  // Defensa en profundidad: si hay llave privada, confirma el estado real con
  // la API de Wompi; si no responde, cae al status del payload (ya validado
  // por checksum, que es suficiente según la spec).
  const verifiedStatus = await fetchTransactionStatus(tx.id);
  const status = verifiedStatus ?? tx.status;

  if (status === "APPROVED") {
    const planId = planIdFromReference(tx.reference);
    const plan = planId ? getPlan(planId) : undefined;
    await sendPaymentNotification({
      reference: tx.reference,
      status: "APPROVED",
      transactionId: tx.id,
      amountInCents: tx.amount_in_cents,
      planNombre: plan?.nombre ?? planId,
      customerEmail: tx.customer_email ?? null,
    });
  }

  return NextResponse.json({ ok: true });
}
