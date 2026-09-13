import { NextResponse } from "next/server";
import { wompiConfig } from "@/lib/integrations/wompi";
import { processTransaction } from "@/lib/pagos/process";
import { isPagosStoreConfigured } from "@/lib/pagos/store";
import { pick, verifyChecksum, type WompiEvent } from "@/lib/pagos/verify";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";
export const maxDuration = 30;

/**
 * Webhook de eventos de Wompi.
 *
 * Falla CERRADO: sin secreto de eventos, sin llave privada o sin base de datos
 * no se acepta nada (503), para que Wompi reintente cuando esté configurado.
 * Solo se responde 200 cuando el evento quedó persistido; un fallo de
 * persistencia devuelve 500 y Wompi reintenta (30 min, 3 h, 24 h). No se
 * rechaza por antigüedad del timestamp: los reintentos lo conservan y el
 * anti-replay lo da la clave única de `pagos_eventos`.
 */
export async function POST(req: Request) {
  const { eventsSecret, privateKey } = wompiConfig();
  if (!eventsSecret || !privateKey || !isPagosStoreConfigured()) {
    console.warn("[pago] webhook rechazado: falta WOMPI_EVENTS_SECRET, WOMPI_PRIVATE_KEY o Supabase");
    return NextResponse.json({ ok: false, error: "webhook no configurado" }, { status: 503 });
  }

  let payload: WompiEvent;
  try {
    payload = await req.json();
  } catch {
    return NextResponse.json({ ok: false }, { status: 400 });
  }

  if (!verifyChecksum(payload, eventsSecret)) {
    return NextResponse.json({ ok: false, error: "checksum inválido" }, { status: 401 });
  }

  if (payload.event !== "transaction.updated") {
    return NextResponse.json({ ok: true });
  }

  const txId = String(pick(payload.data, "transaction.id") ?? "");
  if (!txId) {
    return NextResponse.json({ ok: true });
  }

  const eventTimestamp = Number(payload.timestamp);
  const fallbackStatus = pick(payload.data, "transaction.status");

  const result = await processTransaction(txId, {
    source: "webhook",
    eventTimestamp: Number.isFinite(eventTimestamp) ? eventTimestamp : 0,
    fallbackStatus: typeof fallbackStatus === "string" ? fallbackStatus : undefined,
    raw: payload,
  });

  if (result.outcome === "store_error") {
    return NextResponse.json({ ok: false, error: "no se pudo registrar el evento" }, { status: 500 });
  }

  return NextResponse.json({ ok: true, outcome: result.outcome });
}
