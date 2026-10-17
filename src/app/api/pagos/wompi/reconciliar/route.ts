import { NextResponse } from "next/server";
import { autorizadoCron } from "@/lib/auth/cron";
import { sendPagosAlert } from "@/lib/notifications/payment";
import { defaultDeps } from "@/lib/pagos/process";
import { reconcile } from "@/lib/pagos/reconcile";
import { getPagosStore, isPagosStoreConfigured } from "@/lib/pagos/store";
import { revisarVencimientos } from "@/lib/servicios/procesar";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";
export const maxDuration = 60;

/**
 * Reconciliación de pagos. La invoca el Cron de Vercel (ver vercel.json) con
 * `Authorization: Bearer <CRON_SECRET>`, o Samuel a mano.
 *   GET /api/pagos/wompi/reconciliar          -> corre la reconciliación
 *   GET /api/pagos/wompi/reconciliar?tx=<id>  -> traza completa de una transacción
 *
 * Tres tareas independientes, cada una en su try: la reconciliación, la purga
 * del payload crudo de más de 72 h (Ley 1581) y la revisión de vigencias. Que
 * falle una no impide las otras. Si alguna falla se avisa a Pixies con
 * `sendPagosAlert`, sin datos personales ni mensajes de error (pueden traer
 * referencias o correos): solo qué tarea falló. El detalle queda en los logs.
 */

function mensajeError(err: unknown): string {
  return err instanceof Error ? err.message : String(err);
}

export async function GET(req: Request) {
  if (!autorizadoCron(req)) {
    return NextResponse.json({ ok: false, error: "No autorizado" }, { status: 401 });
  }
  if (!isPagosStoreConfigured()) {
    return NextResponse.json({ ok: false, error: "Supabase no configurado" }, { status: 503 });
  }

  const tx = new URL(req.url).searchParams.get("tx");
  if (tx) {
    const eventos = await getPagosStore().trace(tx);
    return NextResponse.json({ ok: true, tx, eventos: eventos.map(({ raw: _raw, ...e }) => e) });
  }

  const fallos: string[] = [];

  // 1) Reconciliación.
  let result: Awaited<ReturnType<typeof reconcile>> | null = null;
  let errorPagos: string | null = null;
  try {
    result = await reconcile(defaultDeps());
  } catch (err) {
    errorPagos = mensajeError(err);
    console.error("[pagos] la reconciliación diaria falló:", errorPagos);
    fallos.push("La reconciliación de pagos falló.");
  }

  // 2) Purga de 72 h. `reconcile` ya purga al final de una corrida completa; si
  //    se cayó antes de llegar ahí, se purga aquí para no retener datos de más.
  let rawPurgados: number | null = result ? result.rawPurgados : null;
  if (!result) {
    try {
      rawPurgados = await getPagosStore().purgeRaw();
    } catch (err) {
      console.error("[pagos] la purga de payloads falló:", mensajeError(err));
      fallos.push("La purga del payload crudo de más de 72 h falló.");
    }
  }

  // 3) Vigencias de las publicaciones (avisos y vencimientos), en la misma corrida diaria.
  let vigencias: Awaited<ReturnType<typeof revisarVencimientos>> | { error: string };
  try {
    vigencias = await revisarVencimientos();
    if (vigencias.disponible === false) {
      console.warn("[vigencias] tablas de vigencias no disponibles: aplicar migracion 0004 en el SQL Editor de Supabase.");
    }
  } catch (err) {
    console.error("[vigencias] la revisión diaria falló:", mensajeError(err));
    vigencias = { error: "falló la revisión de vigencias" };
    fallos.push("La revisión de vigencias de las publicaciones falló.");
  }

  if (fallos.length) {
    try {
      await sendPagosAlert(
        `Cron diario con fallos (${fallos.length})`,
        [...fallos, "", "Detalle en los logs de Vercel de /api/pagos/wompi/reconciliar."].join("\n"),
      );
    } catch (err) {
      console.error("[pagos] no se pudo enviar la alerta del cron:", mensajeError(err));
    }
  }

  const at = new Date().toISOString();
  if (!result) return NextResponse.json({ ok: false, at, error: errorPagos, rawPurgados, vigencias }, { status: 500 });
  return NextResponse.json({ ok: true, at, ...result, vigencias });
}
