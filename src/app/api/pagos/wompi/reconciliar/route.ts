import { NextResponse } from "next/server";
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
 */
function authorized(req: Request): boolean {
  const secret = process.env.CRON_SECRET;
  if (!secret) return false;
  return req.headers.get("authorization") === `Bearer ${secret}`;
}

export async function GET(req: Request) {
  if (!authorized(req)) {
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

  // Las dos tareas son independientes: que falle una no impide la otra.
  let result: Awaited<ReturnType<typeof reconcile>> | null = null;
  let errorPagos: string | null = null;
  try {
    result = await reconcile(defaultDeps());
  } catch (err) {
    errorPagos = err instanceof Error ? err.message : String(err);
    console.error("[pagos] la reconciliación diaria falló:", errorPagos);
  }

  // La misma corrida diaria revisa las vigencias de las publicaciones (avisos y vencimientos).
  let vigencias: Awaited<ReturnType<typeof revisarVencimientos>> | { error: string };
  try {
    vigencias = await revisarVencimientos();
  } catch (err) {
    console.error("[vigencias] la revisión diaria falló:", err instanceof Error ? err.message : err);
    vigencias = { error: "falló la revisión de vigencias" };
  }
  if (!result) return NextResponse.json({ ok: false, at: new Date().toISOString(), error: errorPagos, vigencias }, { status: 500 });
  return NextResponse.json({ ok: true, at: new Date().toISOString(), ...result, vigencias });
}
