import { NextResponse } from "next/server";
import { getPlan, wompiAmountInCents } from "@/lib/config/plans";
import {
  appUrl,
  buildReference,
  integritySignature,
  isWompiConfigured,
  wompiConfig,
} from "@/lib/integrations/wompi";
import { getPagosStore, isPagosStoreConfigured } from "@/lib/pagos/store";
import { servicioDeToken } from "@/lib/servicios/token";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

const PLAN_ID = /^[a-z0-9-]{1,40}$/;

function mal(error: string, status: number) {
  return NextResponse.json({ ok: false, error }, { status });
}

/** Solo el propio sitio prepara pagos: si el navegador declara otro origen, se rechaza. */
function origenAjeno(req: Request): boolean {
  const origen = req.headers.get("origin");
  if (!origen) return false; // sin cabecera Origin (algunos clientes) no se puede afirmar nada
  try {
    return new URL(origen).host !== new URL(req.url).host;
  } catch {
    return true;
  }
}

/**
 * Prepara un pago de Wompi para un plan de publicación.
 *
 * El cliente envía SOLO el `planId` (y, si viene del enlace del correo, el token
 * de renovación). El precio se resuelve aquí, en el servidor, desde el catálogo
 * de planes — nunca desde el cliente — y la firma se calcula sobre ese monto,
 * de modo que el valor cobrado no se puede manipular desde el navegador.
 */
export async function POST(req: Request) {
  if (!isWompiConfigured()) return mal("La pasarela de pagos no está configurada.", 503);
  if (origenAjeno(req)) return mal("Origen no permitido.", 403);
  if (!(req.headers.get("content-type") ?? "").includes("application/json")) return mal("Solicitud inválida.", 415);

  let body: unknown;
  try {
    body = await req.json();
  } catch {
    return mal("Solicitud inválida.", 400);
  }
  const datos = body && typeof body === "object" ? (body as Record<string, unknown>) : null;
  const planId = typeof datos?.planId === "string" && PLAN_ID.test(datos.planId) ? datos.planId : null;
  if (!planId) return mal("Solicitud inválida.", 400);

  const plan = getPlan(planId);
  if (!plan) return mal("Plan no encontrado.", 404);
  if (plan.mode !== "pago") return mal("Este plan se cotiza por WhatsApp, no se paga en línea.", 400);

  // Renovación desde el correo: se liga el pago al servicio que renueva. Un token inválido o vencido
  // no impide pagar; solo hace que el pago se trate como una compra nueva.
  const renuevaServicioId = typeof datos?.renovar === "string" ? servicioDeToken(datos.renovar) : null;
  if (typeof datos?.renovar === "string" && !renuevaServicioId) {
    // Sin datos personales: solo se deja constancia de que una renovación entrará como compra nueva.
    console.warn(`[pago] token de renovación inválido o caducado; el pago de ${plan.id} se trata como compra nueva`);
  }

  const amountInCents = wompiAmountInCents(plan);
  const reference = buildReference(plan.id);
  const signature = integritySignature(reference, amountInCents, "COP");
  const { publicKey } = wompiConfig();

  // La referencia emitida es la que permite a la conciliación encontrar un pago cuyo comprador no volvió
  // al sitio. Si no se puede registrar, no se entrega la firma: un pago imposible de rastrear es peor.
  if (isPagosStoreConfigured()) {
    try {
      await getPagosStore().recordReference({ reference, planId: plan.id, amountInCents, renuevaServicioId });
    } catch (err) {
      console.error("[pago] no se pudo registrar la referencia:", err instanceof Error ? err.message : err);
      return mal("No pudimos preparar el pago en este momento. No se hizo ningún cobro; inténtalo de nuevo en unos minutos.", 503);
    }
  }

  return NextResponse.json({
    ok: true,
    publicKey,
    currency: "COP",
    amountInCents,
    reference,
    signature,
    plan: { id: plan.id, nombre: plan.nombre, precioCOP: plan.precioCOP },
    // Wompi agrega ?id=<transacción> al volver; la página confirma con la API.
    redirectUrl: `${appUrl()}/publica/agente?pago=procesado&ref=${encodeURIComponent(reference)}`,
  });
}
