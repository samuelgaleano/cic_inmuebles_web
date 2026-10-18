import { NextResponse } from "next/server";
import { isWompiConfigured } from "@/lib/integrations/wompi";
import { confirmarPorReferencia } from "@/lib/pagos/estado";
import { isPagosStoreConfigured } from "@/lib/pagos/store";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";
export const maxDuration = 20;

/**
 * Estado de un pago por su referencia. La página que abrió la pasarela lo consulta mientras dura el pago,
 * así el pago queda registrado aunque quien paga cierre la ventana de Wompi sin volver al comercio.
 * Solo devuelve el estado (nunca datos de la transacción ni de la persona).
 */
export async function GET(req: Request) {
  const sinCache = { "Cache-Control": "no-store" };
  if (!isWompiConfigured() || !isPagosStoreConfigured()) {
    return NextResponse.json({ estado: "no_disponible" }, { status: 503, headers: sinCache });
  }
  // Solo el propio sitio consulta: si el navegador declara otro origen, se rechaza.
  const origen = req.headers.get("origin");
  if (origen) {
    try {
      if (new URL(origen).host !== new URL(req.url).host) return NextResponse.json({ estado: "rechazada" }, { status: 403, headers: sinCache });
    } catch {
      return NextResponse.json({ estado: "rechazada" }, { status: 403, headers: sinCache });
    }
  }
  const ref = new URL(req.url).searchParams.get("ref") ?? "";
  const r = await confirmarPorReferencia(ref);
  const status = r.estado === "desconocida" ? 404 : r.estado === "espera" ? 429 : 200;
  return NextResponse.json(r, { status, headers: sinCache });
}
