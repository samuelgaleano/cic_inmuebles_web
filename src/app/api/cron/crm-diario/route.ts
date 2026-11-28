import { NextResponse } from "next/server";
import { autorizadoCron } from "@/lib/auth/cron";
import { siteConfig } from "@/lib/config/site";
import { armarResumenDiario, claveDelDia, reunirResumenDiario } from "@/lib/crm/resumen";
import { getCrmStore } from "@/lib/crm/store";
import { getRepository } from "@/lib/data";
import { sendEmailConEstado } from "@/lib/notifications/resend";
import { getServiciosStore } from "@/lib/servicios/store";
import { registrarLatido } from "@/lib/salud/latidos";

/**
 * Resumen diario del CRM por correo (cron de Vercel a las 12:00 UTC = 7:00 de Bogotá, ver vercel.json).
 * Seguimientos vencidos y de hoy, vendedores por aprobar, compradores sin inmuebles propuestos, leads de
 * las últimas 48 h sin atender, pagos sin publicar y planes que vencen en 7 días o menos. Si no hay nada,
 * no se manda correo (el latido igual queda en verde).
 *
 * Requiere CRON_SECRET (401 sin él). En la respuesta solo van conteos: ni nombres ni teléfonos.
 */
export const dynamic = "force-dynamic";
export const maxDuration = 60;

export async function GET(req: Request) {
  if (!autorizadoCron(req)) {
    return NextResponse.json({ ok: false, error: "No autorizado" }, { status: 401 });
  }

  const ahora = new Date();
  try {
    const datos = await reunirResumenDiario(getCrmStore(), getRepository().leads, ahora, getServiciosStore());
    const conteos = {
      seguimientos: datos.seguimientos.length,
      porAprobar: datos.porAprobar.length,
      compradoresSinPropuestas: datos.compradoresSinPropuestas.length,
      leadsNuevos: datos.leadsNuevos.length,
      pagosSinPublicar: datos.pagosSinPublicar?.length ?? 0,
      planesPorVencer: datos.planesPorVencer?.length ?? 0,
    };
    const correo = armarResumenDiario(datos, ahora);
    if (!correo) {
      await registrarLatido("cron-crm", true, "sin pendientes");
      return NextResponse.json({ ok: true, enviado: false, ...conteos });
    }

    const { ok: enviado, status } = await sendEmailConEstado({
      to: process.env.LEADS_NOTIFICATION_EMAIL ?? siteConfig.email,
      subject: correo.asunto,
      text: correo.text,
      html: correo.html,
      idempotencyKey: claveDelDia(ahora),
    });
    // 409 = la clave del día ya se usó (otra corrida, o «Run» a mano con contenido distinto): el correo de hoy
    // ya salió, así que no es un fallo y el latido queda en verde.
    if (!enviado && status === 409) {
      await registrarLatido("cron-crm", true, "ya enviado hoy");
      return NextResponse.json({ ok: true, enviado: false, motivo: "ya enviado", ...conteos });
    }
    await registrarLatido("cron-crm", enviado, enviado ? undefined : "no se pudo enviar el correo");
    return NextResponse.json({ ok: enviado, enviado, ...conteos }, { status: enviado ? 200 : 500 });
  } catch (err) {
    // Solo el mensaje técnico (sin datos de personas): el detalle queda en los logs de Vercel.
    console.error("[cron/crm-diario] falló:", err instanceof Error ? err.message : err);
    await registrarLatido("cron-crm", false, "el resumen lanzó un error");
    return NextResponse.json({ ok: false, error: "No se pudo armar el resumen" }, { status: 500 });
  }
}
