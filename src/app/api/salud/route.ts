import { NextResponse } from "next/server";
import { isSupabaseConfigured } from "@/lib/data/supabase/client";
import { estadoDeLatido, LATIDOS, leerLatidos, type EstadoLatido } from "@/lib/salud/latidos";

/**
 * Salud del sitio para el monitor externo (GitHub Actions cada pocas horas). 200 si la base responde y
 * los procesos diarios corrieron; 503 si no, y el monitor avisa por correo. No devuelve datos de nadie:
 * solo el estado de cada proceso. Cada llamada es una invocacion de Vercel: el monitor la usa con moderacion.
 */
export const dynamic = "force-dynamic";
export const maxDuration = 10;

const CABECERAS = { "Cache-Control": "no-store", "X-Robots-Tag": "noindex" };

export async function GET() {
  if (!isSupabaseConfigured()) {
    return NextResponse.json({ ok: false, base: "sin-configurar" }, { status: 503, headers: CABECERAS });
  }

  let latidos;
  try {
    latidos = await leerLatidos();
  } catch {
    return NextResponse.json({ ok: false, base: "caida" }, { status: 503, headers: CABECERAS });
  }

  const ahora = new Date();
  const procesos: Record<string, EstadoLatido | "sin-tabla"> = {};
  for (const n of LATIDOS) {
    procesos[n] = latidos === null ? "sin-tabla" : estadoDeLatido(latidos.find((l) => l.nombre === n), ahora);
  }
  // "sin-dato" y "sin-tabla" no son fallo: es el primer dia tras desplegar o antes de aplicar la migracion.
  const ok = Object.values(procesos).every((e) => e === "ok" || e === "sin-dato" || e === "sin-tabla");
  return NextResponse.json({ ok, base: "ok", procesos }, { status: ok ? 200 : 503, headers: CABECERAS });
}
