import { NextResponse } from "next/server";
import { getPlan, wompiAmountInCents } from "@/lib/config/plans";
import {
  appUrl,
  buildReference,
  integritySignature,
  isWompiConfigured,
  wompiConfig,
} from "@/lib/integrations/wompi";

export const dynamic = "force-dynamic";

/**
 * Prepara un pago de Wompi para un plan de publicación.
 *
 * El cliente envía SOLO el `planId` (y datos de contacto opcionales). El precio
 * se resuelve aquí, en el servidor, desde el catálogo de planes — nunca desde
 * el cliente — y la firma se calcula sobre ese monto, de modo que el valor
 * cobrado no se puede manipular desde el navegador.
 */
export async function POST(req: Request) {
  if (!isWompiConfigured()) {
    return NextResponse.json(
      { ok: false, error: "La pasarela de pagos no está configurada." },
      { status: 503 },
    );
  }

  let body: { planId?: string; email?: string; nombre?: string; telefono?: string };
  try {
    body = await req.json();
  } catch {
    return NextResponse.json({ ok: false, error: "Solicitud inválida." }, { status: 400 });
  }

  const plan = body.planId ? getPlan(body.planId) : undefined;
  if (!plan) {
    return NextResponse.json({ ok: false, error: "Plan no encontrado." }, { status: 404 });
  }
  if (plan.mode !== "pago") {
    return NextResponse.json(
      { ok: false, error: "Este plan se cotiza por WhatsApp, no se paga en línea." },
      { status: 400 },
    );
  }

  const amountInCents = wompiAmountInCents(plan);
  const reference = buildReference(plan.id);
  const signature = integritySignature(reference, amountInCents, "COP");
  const { publicKey } = wompiConfig();

  return NextResponse.json({
    ok: true,
    publicKey,
    currency: "COP",
    amountInCents,
    reference,
    signature,
    plan: { id: plan.id, nombre: plan.nombre, precioCOP: plan.precioCOP },
    redirectUrl: `${appUrl()}/publica/agente?pago=procesado&ref=${encodeURIComponent(reference)}`,
  });
}
