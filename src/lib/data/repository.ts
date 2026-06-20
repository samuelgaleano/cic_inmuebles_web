import type {
  Property,
  PropertyInput,
  PublicProperty,
  PropertyFilters,
  Lead,
  LeadInput,
  LeadStatus,
} from "@/lib/domain";

/**
 * Contratos de acceso a datos (patrón repositorio).
 *
 * El sitio depende SOLO de estas interfaces, no de una base de datos concreta.
 * Hoy se implementan en memoria (datos de ejemplo); en Fase 1b se añade la
 * implementación con Supabase sin tocar la UI. Ver docs/ARQUITECTURA.md.
 */

export interface PropertyRepository {
  /** Listado completo (incluye datos privados) — uso interno/admin. */
  list(filters?: PropertyFilters): Promise<Property[]>;
  /** Listado público (sin datos sensibles, solo publicados). */
  listPublic(filters?: PropertyFilters): Promise<PublicProperty[]>;
  /** Inmueble por slug (datos completos). */
  getBySlug(slug: string): Promise<Property | null>;
  /** Inmueble por id (datos completos) — uso interno/admin. */
  getById(id: string): Promise<Property | null>;
  /** Inmueble público por slug (solo si está publicado). */
  getPublicBySlug(slug: string): Promise<PublicProperty | null>;
  /** Ciudades distintas presentes en el catálogo (para filtros). */
  listCities(): Promise<string[]>;

  // --- Escritura (panel admin) ---
  create(input: PropertyInput): Promise<Property>;
  update(id: string, patch: Partial<PropertyInput>): Promise<Property | null>;
  remove(id: string): Promise<boolean>;
}

export interface LeadRepository {
  create(input: LeadInput): Promise<Lead>;
  list(): Promise<Lead[]>;
  updateStatus(id: string, estado: LeadStatus): Promise<Lead | null>;
  remove(id: string): Promise<boolean>;
}

export interface Repository {
  properties: PropertyRepository;
  leads: LeadRepository;
}
