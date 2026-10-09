import type { Repository } from "./repository";
import { createMemoryRepository } from "./memory-repository";
import { createSupabaseRepository } from "./supabase-repository";
import { isSupabaseConfigured } from "./supabase/client";

/**
 * Selector de implementación del repositorio.
 *
 * Si hay credenciales de Supabase (NEXT_PUBLIC_SUPABASE_URL +
 * SUPABASE_SERVICE_ROLE_KEY) usa la base de datos real; de lo contrario, la
 * implementación en memoria con datos de ejemplo. La UI y las acciones no
 * cambian: ambas hablan con la misma interfaz `Repository`.
 */
let repository: Repository | null = null;

export function getRepository(): Repository {
  if (repository) return repository;
  // En producción, un entorno sin base de datos es un error de configuración: caer a los datos de
  // ejemplo mostraría inmuebles falsos y los leads se perderían en memoria sin que nadie lo note.
  if (!isSupabaseConfigured() && process.env.VERCEL_ENV === "production") {
    throw new Error("Supabase no está configurado en producción (NEXT_PUBLIC_SUPABASE_URL y SUPABASE_SERVICE_ROLE_KEY).");
  }
  repository = isSupabaseConfigured() ? createSupabaseRepository() : createMemoryRepository();
  return repository;
}

export type { Repository } from "./repository";
