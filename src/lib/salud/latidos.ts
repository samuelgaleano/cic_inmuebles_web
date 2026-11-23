import { getSupabaseAdmin, isSupabaseConfigured } from "@/lib/data/supabase/client";

/** Procesos que deben latir al menos una vez al dia. */
export const LATIDOS = ["cron-sync", "cron-diario"] as const;
export type NombreLatido = (typeof LATIDOS)[number];

/** Un cron de Vercel corre una vez al dia con hasta ±59 min de desfase: 27 h sin latido es un fallo. */
export const MAX_SIN_LATIDO_MS = 27 * 60 * 60 * 1000;

export interface Latido {
  nombre: string;
  okAt: string | null;
  falloAt: string | null;
}

/**
 * Deja constancia de una corrida. Nunca lanza: si la tabla no existe (migracion 0009 sin aplicar) o la
 * base falla, el cron sigue y solo queda el registro en el log.
 */
export async function registrarLatido(nombre: NombreLatido, ok: boolean, detalle?: string): Promise<void> {
  if (!isSupabaseConfigured()) return;
  const ahora = new Date().toISOString();
  try {
    const { error } = await getSupabaseAdmin()
      .from("latidos")
      .upsert(
        { nombre, ...(ok ? { ok_at: ahora } : { fallo_at: ahora }), detalle: detalle?.slice(0, 300) ?? null, updated_at: ahora },
        { onConflict: "nombre" },
      );
    if (error) console.warn(`[salud] no se pudo registrar el latido ${nombre}:`, error.code ?? error.message);
  } catch (err) {
    console.warn(`[salud] no se pudo registrar el latido ${nombre}:`, err instanceof Error ? err.message : err);
  }
}

export type EstadoLatido = "ok" | "atrasado" | "con-fallos" | "sin-dato";

/** Regla pura: como esta un proceso segun su ultima corrida buena y su ultimo fallo. */
export function estadoDeLatido(l: Latido | undefined, ahora: Date): EstadoLatido {
  if (!l || !l.okAt) return l?.falloAt ? "con-fallos" : "sin-dato";
  const ok = new Date(l.okAt).getTime();
  if (l.falloAt && new Date(l.falloAt).getTime() > ok) return "con-fallos";
  return ahora.getTime() - ok > MAX_SIN_LATIDO_MS ? "atrasado" : "ok";
}

/** null si la tabla aun no existe (migracion 0009 sin aplicar); lanza si la base no responde. */
export async function leerLatidos(): Promise<Latido[] | null> {
  const { data, error } = await getSupabaseAdmin().from("latidos").select("nombre, ok_at, fallo_at");
  if (error) {
    if (error.code === "42P01" || error.code === "PGRST205") return null;
    throw error;
  }
  return (data ?? []).map((r) => ({
    nombre: r.nombre as string,
    okAt: (r.ok_at as string | null) ?? null,
    falloAt: (r.fallo_at as string | null) ?? null,
  }));
}
