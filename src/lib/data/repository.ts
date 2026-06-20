import type {
  Property,
  PublicProperty,
  PropertyFilters,
  Lead,
  LeadInput,
} from "@/lib/domain";

/**
 * Contratos de acceso a datos (patrón repositorio).
 *
 * El sitio depende SOLO de estas interfaces, no de una base de datos concreta.
 * Hoy se implementan en memoria (datos de ejemplo); en Fase 1 se añade la
 * implementación con Supabase sin tocar la UI. Ver docs/ARQUITECTURA.md.
 */

export interface PropertyRepository {
  /** Listado completo (incluye datos privados) — uso interno/admin. */
  list(filters?: PropertyFilters): Promise<Property[]>;
  /** Listado público (sin datos sensibles, solo publicados). */
  listPublic(filters?: PropertyFilters): Promise<PublicProperty[]>;
  /** Inmueble por slug (datos completos). */
  getBySlug(slug: string): Promise<Property | null>;
  /** Inmueble público por slug (solo si está publicado). */
  getPublicBySlug(slug: string): Promise<PublicProperty | null>;
  /** Ciudades distintas presentes en el catálogo (para filtros). */
  listCities(): Promise<string[]>;
}

export interface LeadRepository {
  create(input: LeadInput): Promise<Lead>;
  list(): Promise<Lead[]>;
}

export interface Repository {
  properties: PropertyRepository;
  leads: LeadRepository;
}
