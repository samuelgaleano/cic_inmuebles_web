import { isSupabaseConfigured } from "./supabase/client";

/**
 * Regla unica para elegir entre la implementacion sobre Supabase y la de memoria.
 *
 * - Con NEXT_PUBLIC_SUPABASE_URL y SUPABASE_SERVICE_ROLE_KEY: Supabase.
 * - Sin ellas, fuera de produccion: memoria (datos de ejemplo, se pierden al reiniciar).
 * - Sin ellas, en produccion (VERCEL_ENV=production): LANZA. Caer a memoria ahi mostraria inmuebles
 *   falsos y guardaria leads o pagos en RAM, donde se pierden sin que nadie lo note.
 *
 * Todo lo que tenga dos implementaciones (repositorio, stores) deberia pasar por aqui para que la
 * regla sea la misma en todos lados. `nombre` solo sirve para el mensaje de error.
 */
export function elegirImplementacion<T>(nombre: string, opciones: { supabase: () => T; memoria: () => T }): T {
  if (isSupabaseConfigured()) return opciones.supabase();
  if (process.env.VERCEL_ENV === "production") {
    throw new Error(
      `${nombre}: Supabase no está configurado en producción (NEXT_PUBLIC_SUPABASE_URL y SUPABASE_SERVICE_ROLE_KEY).`,
    );
  }
  return opciones.memoria();
}
