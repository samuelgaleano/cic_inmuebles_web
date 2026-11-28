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
  /** Más nuevos primero, hasta `limite` (por defecto LEADS_LIMITE_POR_DEFECTO). Para exportar y sincronizar; el panel pagina con `listPage`. */
  list(opciones?: ListarLeadsOpciones): Promise<Lead[]>;
  getById(id: string): Promise<Lead | null>;
  /** Una página del panel de leads (más nuevos primero) con el total. `estado` filtra; `pagina` empieza en 1. */
  listPage(opts: { pagina: number; porPagina: number; estado?: LeadStatus }): Promise<{ leads: Lead[]; total: number }>;
  /** Leads de una persona: enlazados por `contacto_id` (o con esos `ids`) o con su mismo teléfono o correo. */
  listarDeContacto(c: { contactoId: string; ids?: string[]; telefonos: string[]; email?: string }): Promise<Lead[]>;
  /** Leads que preguntaron por un inmueble (por id o, los anteriores al enlace, por slug). */
  listarDeInmueble(propertyId: string, slug: string): Promise<Lead[]>;
  /** Leads creados en [desde, hasta) (ISO), para los reportes del mes. */
  listarEntre(desde: string, hasta: string): Promise<Lead[]>;
  /** Cuántos leads llegaron desde ese instante (tope de avisos por correo). */
  countSince(iso: string): Promise<number>;
  updateStatus(id: string, estado: LeadStatus): Promise<Lead | null>;
  /**
   * Fija `primer_contacto_at` (0012) en los que todavía no lo tienen; nunca lo pisa.
   * Devuelve cuántos marcó (0 si la columna no existe todavía).
   */
  marcarPrimerContacto(ids: string[], at: string): Promise<number>;
  /**
   * Ley 1581: anonimiza nombre, teléfono, correo y mensaje (y preferencia y ciudad) y marca `suprimido_at` (0013).
   * Sin esa columna los deja «descartado», para que la sincronización del CRM no los vuelva a pasar.
   */
  suprimir(ids: string[], at: string): Promise<number>;
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
  getById(id: string): Promise<Appointment | null>;
  /** Citas de una persona (por `contacto_id`, 0013) o de sus leads, por fecha. */
  listarDe(c: { contactoId: string; leadIds: string[] }): Promise<Appointment[]>;
  /** Con `contactoId` y sin la columna (0013 sin aplicar), se guarda sin él. */
  create(input: AppointmentInput): Promise<Appointment>;
  updateStatus(id: string, estado: AppointmentStatus): Promise<Appointment | null>;
  /** Ley 1581: anonimiza el cliente (nombre, teléfono, correo, notas) de las citas de esa persona o de esos leads. */
  suprimirDe(c: { contactoId: string; leadIds: string[] }): Promise<number>;
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
