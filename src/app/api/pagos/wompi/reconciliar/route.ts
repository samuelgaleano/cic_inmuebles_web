import { NextResponse } from "next/server";
import { defaultDeps } from "@/lib/pagos/process";
import { reconcile } from "@/lib/pagos/reconcile";
import { getPagosStore, isPagosStoreConfigured } from "@/lib/pagos/store";

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

  const result = await reconcile(defaultDeps());
  return NextResponse.json({ ok: true, at: new Date().toISOString(), ...result });
}
