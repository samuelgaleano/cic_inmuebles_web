import type {
  Property,
  PropertyInput,
  PublicProperty,
  PropertyFilters,
  Lead,
  LeadInput,
  LeadStatus,
  Agent,
  AgentInput,
  AgentAvailability,
  AvailabilitySlot,
  Appointment,
  AppointmentInput,
  AppointmentStatus,
  Template,
  TemplateInput,
} from "@/lib/domain";

/**
 * Contratos de acceso a datos (patrón repositorio).
 *
 * El sitio depende SOLO de estas interfaces, no de una base de datos concreta.
 * Hay dos implementaciones: Supabase (producción, `supabase-repository.ts`) y
 * memoria con datos de ejemplo (local y pruebas, `memory-repository.ts`). La
 * elección la hace `elegir-implementacion.ts`. Ver docs/ARQUITECTURA.md.
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

export interface ListarLeadsOpciones {
  /**
   * Máximo de leads a devolver, los más recientes primero. Por defecto `LEADS_LIMITE_POR_DEFECTO`.
   * La implementación Supabase pagina de a 1.000 (el tope de filas por respuesta de la API), así que
   * el límite puede pasar de 1.000 sin que el listado se corte en silencio.
   */
  limite?: number;
}

/** Tope por defecto de `leads.list()`. Si se alcanza, el repositorio lo avisa en el log. */
export const LEADS_LIMITE_POR_DEFECTO = 5000;

export interface LeadRepository {
  create(input: LeadInput): Promise<Lead>;
  list(opciones?: ListarLeadsOpciones): Promise<Lead[]>;
  /** Cuántos leads llegaron desde ese instante (tope de avisos por correo). */
  countSince(iso: string): Promise<number>;
  updateStatus(id: string, estado: LeadStatus): Promise<Lead | null>;
  remove(id: string): Promise<boolean>;
}

export interface AgentRepository {
  list(): Promise<Agent[]>;
  getById(id: string): Promise<Agent | null>;
  create(input: AgentInput): Promise<Agent>;
  update(id: string, patch: Partial<AgentInput>): Promise<Agent | null>;
  remove(id: string): Promise<boolean>;
  listAvailability(agentId: string): Promise<AgentAvailability[]>;
  setAvailability(agentId: string, slots: AvailabilitySlot[]): Promise<void>;
}

export interface AppointmentRepository {
  list(): Promise<Appointment[]>;
  create(input: AppointmentInput): Promise<Appointment>;
  updateStatus(id: string, estado: AppointmentStatus): Promise<Appointment | null>;
  remove(id: string): Promise<boolean>;
}

export interface TemplateRepository {
  list(): Promise<Template[]>;
  getById(id: string): Promise<Template | null>;
  create(input: TemplateInput): Promise<Template>;
  update(id: string, patch: Partial<TemplateInput>): Promise<Template | null>;
  remove(id: string): Promise<boolean>;
}

export interface Repository {
  properties: PropertyRepository;
  leads: LeadRepository;
  agents: AgentRepository;
  appointments: AppointmentRepository;
  templates: TemplateRepository;
}
