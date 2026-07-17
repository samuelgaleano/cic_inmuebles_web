import crypto from "crypto";
import { NextResponse } from "next/server";
import { wompiConfig } from "@/lib/integrations/wompi";
import { planIdFromReference } from "@/lib/integrations/wompi";
import { getPlan } from "@/lib/config/plans";
import { sendPaymentNotification } from "@/lib/notifications/payment";

export const dynamic = "force-dynamic";

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

  // Comparación en tiempo constante (ambas del mismo largo → hex de sha256).
  const a = Buffer.from(computed, "utf8");
  const b = Buffer.from(String(checksum).toLowerCase(), "utf8");
  return a.length === b.length && crypto.timingSafeEqual(a, b);
}

export async function POST(req: Request) {
  const { eventsSecret } = wompiConfig();

  let payload: Record<string, unknown>;
  try {
    payload = await req.json();
  } catch {
    return NextResponse.json({ ok: false }, { status: 400 });
  }

  // Si hay secreto de eventos configurado, el checksum debe ser válido.
  if (eventsSecret && !verifyChecksum(payload, eventsSecret)) {
    return NextResponse.json({ ok: false, error: "checksum inválido" }, { status: 401 });
  }

  if (payload.event !== "transaction.updated") {
    return NextResponse.json({ ok: true });
  }

  const tx = pick(payload.data, "transaction") as
    | { id?: string; status?: string; reference?: string; amount_in_cents?: number; customer_email?: string }
    | undefined;

  if (tx?.status === "APPROVED") {
    // El planId va embebido en la referencia: CIC-<planId>-<rand>-<ts>.
    const planId = tx.reference ? planIdFromReference(tx.reference) : undefined;
    const plan = planId ? getPlan(planId) : undefined;
    await sendPaymentNotification({
      reference: tx.reference ?? "—",
      status: tx.status,
      transactionId: tx.id,
      amountInCents: tx.amount_in_cents,
      planNombre: plan?.nombre ?? planId,
      customerEmail: tx.customer_email ?? null,
    });
  }

  return NextResponse.json({ ok: true });
}
