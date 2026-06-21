/**
 * Modelo de dominio del Lead (cliente potencial).
 *
 * Cubre los dos embudos del negocio, ambos diseñados para MÍNIMA FRICCIÓN:
 *  - comprador: quiere visitar / saber más de un inmueble.
 *  - vendedor:  tiene un inmueble que desea vender o arrendar con nosotros.
 */

export const LEAD_TYPES = ["comprador", "vendedor"] as const;
export type LeadType = (typeof LEAD_TYPES)[number];

/** Intención del comprador al contactar. */
export const LEAD_INTENTS = ["visita", "info"] as const;
export type LeadIntent = (typeof LEAD_INTENTS)[number];

export const LEAD_INTENT_LABELS: Record<LeadIntent, string> = {
  visita: "Agendar visita",
  info: "Más información",
};

/** Origen del lead. */
export const LEAD_SOURCES = ["web", "whatsapp"] as const;
export type LeadSource = (typeof LEAD_SOURCES)[number];

/** Estado del lead en el pipeline comercial (gestión interna). */
export const LEAD_STATUSES = [
  "nuevo",
  "contactado",
  "en_proceso",
  "cerrado",
  "descartado",
] as const;
export type LeadStatus = (typeof LEAD_STATUSES)[number];

export const LEAD_STATUS_LABELS: Record<LeadStatus, string> = {
  nuevo: "Nuevo",
  contactado: "Contactado",
  en_proceso: "En proceso",
  cerrado: "Cerrado",
  descartado: "Descartado",
};

export interface Lead {
  id: string;
  tipo: LeadType;

  // Datos de contacto (mínimos para concretar)
  nombre: string;
  telefono: string;
  email?: string;
  mensaje?: string;

  // Contexto del comprador
  intencion?: LeadIntent;
  propertyId?: string;
  propertySlug?: string;
  /** Fecha/franja preferida para la visita (texto libre, opcional). */
  preferencia?: string;

  // Contexto del vendedor
  tipoInmueble?: string;
  ciudad?: string;

  fuente: LeadSource;
  estado: LeadStatus;
  creadoEn: string;
}

/** Datos que llegan desde un formulario (sin campos generados por el sistema). */
export type LeadInput = Omit<Lead, "id" | "estado" | "creadoEn">;
