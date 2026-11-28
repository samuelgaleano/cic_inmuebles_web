import type { Repository } from "./repository";
import { createMemoryRepository } from "./memory-repository";
import { createSupabaseRepository } from "./supabase-repository";
import { elegirImplementacion } from "./elegir-implementacion";

/**
 * Selector de implementación del repositorio.
 *
 * Si hay credenciales de Supabase (NEXT_PUBLIC_SUPABASE_URL +
 * SUPABASE_SERVICE_ROLE_KEY) usa la base de datos real; de lo contrario, la
 * implementación en memoria con datos de ejemplo. La UI y las acciones no
 * cambian: ambas hablan con la misma interfaz `Repository`.
 * La regla (incluido lanzar en producción sin base) vive en `elegir-implementacion.ts`.
 */
let repository: Repository | null = null;

export function getRepository(): Repository {
  if (repository) return repository;
  repository = elegirImplementacion<Repository>("Repositorio", {
    supabase: createSupabaseRepository,
    memoria: createMemoryRepository,
  });
  return repository;
}

export type { Repository, ListarLeadsOpciones } from "./repository";
