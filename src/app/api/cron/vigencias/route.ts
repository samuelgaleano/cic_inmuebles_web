import { NextResponse } from "next/server";
import { autorizadoCron } from "@/lib/auth/cron";
import { sendPagosAlert } from "@/lib/notifications/payment";
import { revisarVencimientos } from "@/lib/servicios/procesar";
import { registrarLatido } from "@/lib/salud/latidos";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";
export const maxDuration = 60;

/**
 * Revisión diaria de vigencias de las publicaciones: avisos de 7 y 1 día, vencimientos con su día de
 * gracia y despublicación de fichas vencidas. Cron de Vercel a las 6:45 UTC (ver vercel.json), después
 * de la conciliación de pagos (6:30), así una renovación pagada que la conciliación retoma ya cuenta.
 * Va en su propia ruta: si la conciliación se cae o tarda, los avisos salen igual, y cada uno deja su latido.
 *
 * Requiere CRON_SECRET (401 sin él). Si falla se avisa a Pixies sin datos personales ni el mensaje de
 * error (puede traer correos); el detalle queda en los logs. En la respuesta solo van conteos.
 */
export async function GET(req: Request) {
  if (!autorizadoCron(req)) {
    return NextResponse.json({ ok: false, error: "No autorizado" }, { status: 401 });
  }

  const at = new Date().toISOString();
  try {
    const vigencias = await revisarVencimientos();
    if (vigencias.disponible === false) {
      console.warn("[vigencias] tablas de vigencias no disponibles: aplicar migracion 0004 en el SQL Editor de Supabase.");
    }
    await registrarLatido("cron-vigencias", true, vigencias.disponible ? undefined : "sin tablas de vigencias");
    return NextResponse.json({ ok: true, at, ...vigencias });
  } catch (err) {
    console.error("[vigencias] la revisión diaria falló:", err instanceof Error ? err.message : err);
    try {
      await sendPagosAlert("Revisión de vigencias con fallos", "La revisión diaria de vigencias de las publicaciones falló.\n\nDetalle en los logs de Vercel de /api/cron/vigencias.");
    } catch (alerta) {
      console.error("[vigencias] no se pudo enviar la alerta del cron:", alerta instanceof Error ? alerta.message : alerta);
    }
    await registrarLatido("cron-vigencias", false, "la revisión lanzó un error");
    return NextResponse.json({ ok: false, at, error: "falló la revisión de vigencias" }, { status: 500 });
  }
}
