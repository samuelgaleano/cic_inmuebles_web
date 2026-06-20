import type { Repository } from "./repository";
import { createMemoryRepository } from "./memory-repository";

/**
 * Selector de implementación del repositorio.
 *
 * Hoy devuelve la implementación en memoria. Cuando se configure Supabase
 * (variables NEXT_PUBLIC_SUPABASE_URL + SUPABASE_SERVICE_ROLE_KEY), aquí se
 * conmutará a `createSupabaseRepository()` sin cambiar la UI ni las acciones.
 */
let repository: Repository | null = null;

export function getRepository(): Repository {
  if (repository) return repository;

  // Fase 1 (siguiente paso): si hay credenciales de Supabase, usarlo.
  // if (process.env.SUPABASE_SERVICE_ROLE_KEY) {
  //   repository = createSupabaseRepository();
  //   return repository;
  // }

  repository = createMemoryRepository();
  return repository;
}

export type { Repository } from "./repository";
