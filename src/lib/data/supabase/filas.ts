/**
 * Tipos de fila de las tablas que usa el repositorio principal, escritos a mano a partir de las
 * migraciones (supabase/migrations). Van de la mano con las listas de columnas de abajo: cada
 * consulta pide exactamente esas columnas, y el mapper recibe la fila tipada en vez de `any`.
 *
 * Si una migracion cambia una columna, hay que tocar aqui la lista Y el tipo: `tsc` marca entonces
 * cada mapper que lee el campo viejo. No hay tipos generados (`supabase gen types`) porque el
 * proyecto no levanta Supabase local; si algun dia se hace, este archivo se reemplaza por ellos.
 *
 * Convenciones: `timestamptz` y `time` llegan como texto ISO; `bigint` y `numeric` pueden llegar
 * como numero o como texto segun el tamano, por eso se tipan `number | string` donde importa.
 */

import type {
  AgentRole,
  AppointmentStatus,
  LeadIntent,
  LeadSource,
  LeadStatus,
  LeadType,
  MediaProvider,
  PropertyMedia,
  PropertyStatus,
  PropertyType,
  TemplateType,
} from "@/lib/domain";

/** Une una lista de columnas en el formato de `select()` de PostgREST. */
function columnas(lista: readonly string[]): string {
  return lista.join(", ");
}

// --- property_media (0001) ----------------------------------------------------------------------

export interface PropertyMediaRow {
  id: string;
  property_id: string;
  tipo: PropertyMedia["type"];
  provider: MediaProvider;
  url: string;
  thumbnail_url: string | null;
  alt: string | null;
  orden: number | null;
  is_cover: boolean | null;
}

export const COLUMNAS_MEDIA = [
  "id",
  "property_id",
  "tipo",
  "provider",
  "url",
  "thumbnail_url",
  "alt",
  "orden",
  "is_cover",
] as const;

/** Fila para insertar en `property_media` (sin id ni created_at, que los pone la base). */
export type PropertyMediaInsert = Omit<PropertyMediaRow, "id">;

// --- properties (0001 + 0002) -------------------------------------------------------------------

/** Columnas que se pueden mostrar al visitante (las mismas que 0009 concede a la llave anonima). */
export const COLUMNAS_INMUEBLE_PUBLICAS = [
  "id",
  "codigo",
  "slug",
  "titulo",
  "tipo",
  "estado",
  "precio",
  "administracion",
  "ciudad",
  "sector",
  "conjunto",
  "habitaciones",
  "banos",
  "area",
  "parqueaderos",
  "descripcion",
  "destacado",
  "publicado",
  "created_at",
  "updated_at",
] as const;

/** Contacto del anunciante (0012): publico a proposito (boton de la ficha), pero sin permiso para la llave anonima. */
export const COLUMNAS_INMUEBLE_ANUNCIANTE = ["anunciante_nombre", "anunciante_whatsapp"] as const;

/** Columnas privadas: solo el panel las necesita. Nunca viajan en la lectura publica. */
export const COLUMNAS_INMUEBLE_PRIVADAS = [
  "direccion",
  "propietario_nombre",
  "propietario_telefono",
  "propietario_email",
  "notas_internas",
  "drive_folder_id",
] as const;

export interface PropertyPublicRow {
  id: string;
  codigo: string;
  slug: string;
  titulo: string;
  tipo: PropertyType;
  estado: PropertyStatus;
  precio: number | string;
  administracion: number | null;
  ciudad: string;
  sector: string | null;
  conjunto: string | null;
  habitaciones: number | null;
  banos: number | null;
  area: number | null;
  parqueaderos: number | null;
  descripcion: string | null;
  destacado: boolean | null;
  publicado: boolean | null;
  created_at: string;
  updated_at: string;
  anunciante_nombre?: string | null;
  anunciante_whatsapp?: string | null;
  property_media?: PropertyMediaRow[] | null;
}

export interface PropertyRow extends PropertyPublicRow {
  direccion: string | null;
  propietario_nombre: string | null;
  propietario_telefono: string | null;
  propietario_email: string | null;
  notas_internas: string | null;
  drive_folder_id: string | null;
}

/** Fila de `properties` en una lectura publica: las columnas privadas pueden faltar. */
export type PropertyRowLectura = PropertyPublicRow & Partial<Omit<PropertyRow, keyof PropertyPublicRow>>;

/** Fila para insertar/actualizar `properties` (sin id, codigo, slug ni marcas de tiempo). */
export type PropertyWrite = Omit<PropertyRow, "id" | "codigo" | "slug" | "created_at" | "updated_at" | "property_media">;

/** Select del inmueble completo con sus medios (panel). */
export const SELECT_INMUEBLE = `${columnas([...COLUMNAS_INMUEBLE_PUBLICAS, ...COLUMNAS_INMUEBLE_ANUNCIANTE, ...COLUMNAS_INMUEBLE_PRIVADAS])}, property_media(${columnas(COLUMNAS_MEDIA)})`;

/** Select del inmueble publico con sus medios: sin propietario, direccion, notas ni carpeta de Drive. */
export const SELECT_INMUEBLE_PUBLICO = `${columnas([...COLUMNAS_INMUEBLE_PUBLICAS, ...COLUMNAS_INMUEBLE_ANUNCIANTE])}, property_media(${columnas(COLUMNAS_MEDIA)})`;

// --- leads (0001; contacto_id llega en 0008 y lo maneja el CRM) ---------------------------------

export interface LeadRow {
  id: string;
  tipo: LeadType;
  nombre: string;
  telefono: string;
  email: string | null;
  mensaje: string | null;
  intencion: LeadIntent | null;
  property_id: string | null;
  property_slug: string | null;
  preferencia: string | null;
  tipo_inmueble: string | null;
  ciudad: string | null;
  fuente: LeadSource | null;
  estado: LeadStatus | null;
  created_at: string;
  // 0012: origen de la visita, prueba de la autorizacion de datos y primera respuesta del equipo.
  utm_source?: string | null;
  utm_medium?: string | null;
  utm_campaign?: string | null;
  referente?: string | null;
  pagina_entrada?: string | null;
  consentimiento_at?: string | null;
  consentimiento_version?: string | null;
  primer_contacto_at?: string | null;
}

export type LeadWrite = Omit<LeadRow, "id" | "estado" | "created_at" | "primer_contacto_at">;

export const SELECT_LEAD = columnas([
  "id",
  "tipo",
  "nombre",
  "telefono",
  "email",
  "mensaje",
  "intencion",
  "property_id",
  "property_slug",
  "preferencia",
  "tipo_inmueble",
  "ciudad",
  "fuente",
  "estado",
  "created_at",
  "utm_source",
  "utm_medium",
  "utm_campaign",
  "referente",
  "pagina_entrada",
  "consentimiento_at",
  "consentimiento_version",
  "primer_contacto_at",
]);

// --- agents y agent_availability (0001) ---------------------------------------------------------

export interface AgentRow {
  id: string;
  user_id: string | null;
  nombre: string;
  email: string;
  telefono: string | null;
  foto_url: string | null;
  rol: AgentRole;
  activo: boolean | null;
  created_at: string;
}

export type AgentWrite = Omit<AgentRow, "id" | "created_at">;

export const SELECT_AGENTE = columnas(["id", "user_id", "nombre", "email", "telefono", "foto_url", "rol", "activo", "created_at"]);

export interface AvailabilityRow {
  id: string;
  agent_id: string;
  dia_semana: number;
  hora_inicio: string;
  hora_fin: string;
}

export type AvailabilityInsert = Omit<AvailabilityRow, "id">;

export const SELECT_DISPONIBILIDAD = columnas(["id", "agent_id", "dia_semana", "hora_inicio", "hora_fin"]);

// --- appointments (0001) ------------------------------------------------------------------------

export interface AppointmentRow {
  id: string;
  property_id: string;
  agent_id: string | null;
  lead_id: string | null;
  cliente_nombre: string;
  cliente_telefono: string;
  cliente_email: string | null;
  inicio_en: string;
  duracion_min: number | null;
  estado: AppointmentStatus;
  notas: string | null;
  created_at: string;
}

export type AppointmentWrite = Omit<AppointmentRow, "id" | "created_at">;

export const SELECT_CITA = columnas([
  "id",
  "property_id",
  "agent_id",
  "lead_id",
  "cliente_nombre",
  "cliente_telefono",
  "cliente_email",
  "inicio_en",
  "duracion_min",
  "estado",
  "notas",
  "created_at",
]);

// --- templates (0001) ---------------------------------------------------------------------------

export interface TemplateRow {
  id: string;
  nombre: string;
  tipo: TemplateType;
  contenido: string;
  created_at: string;
  updated_at: string;
}

export type TemplateWrite = Pick<TemplateRow, "nombre" | "tipo" | "contenido">;

export const SELECT_PLANTILLA = columnas(["id", "nombre", "tipo", "contenido", "created_at", "updated_at"]);
