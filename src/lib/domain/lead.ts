/**
 * Modelo de dominio del Lead (cliente potencial).
 *
 * Cubre los dos embudos del negocio, ambos diseñados para MÍNIMA FRICCIÓN:
 *  - comprador: quiere visitar / saber más de un inmueble.
 *  - vendedor:  tiene un inmueble que desea vender o arrendar con nosotros.
 */

import type { OrigenVisita } from "@/lib/leads/origen";

export const LEAD_TYPES = ["comprador", "vendedor"] as const;
export type LeadType = (typeof LEAD_TYPES)[number];

/**
 * Intención del comprador al contactar. "alerta": no encontró lo que buscaba en el catálogo y pidió que le
 * avisen cuando llegue (en el CRM entra como búsqueda con lo que escribió).
 */
export const LEAD_INTENTS = ["visita", "info", "alerta"] as const;
export type LeadIntent = (typeof LEAD_INTENTS)[number];

export const LEAD_INTENT_LABELS: Record<LeadIntent, string> = {
  visita: "Agendar visita",
  info: "Más información",
  alerta: "Avísenme cuando llegue",
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
  /** De dónde llegó la visita (campaña, referente, página de entrada). Lo mide el propio sitio, sin terceros. */
  origen?: OrigenVisita;
  /** Autorización de tratamiento de datos: cuándo y qué versión de la política (Ley 1581). */
  consentimientoAt?: string;
  consentimientoVersion?: string;
  /** Primera vez que el equipo contactó a la persona (la escribe la gestión del lead, no el formulario). */
  primerContactoAt?: string;
  estado: LeadStatus;
  creadoEn: string;

  // Origen en campos planos (mismos datos que `origen`; los usan los reportes del CRM)
  utmSource?: string;
  utmMedium?: string;
  utmCampaign?: string;
  /** Sitio desde el que llegó (document.referrer). */
  referente?: string;
  paginaEntrada?: string;
  /** Datos suprimidos a pedido de la persona (Ley 1581, columna de 0013). */
  suprimidoAt?: string;
}

/** Nombre que queda en una persona, un lead o una cita cuyos datos se suprimieron (Ley 1581). */
export const NOMBRE_SUPRIMIDO = "Suprimido";

/** Datos que llegan desde un formulario (sin campos generados por el sistema). */
export type LeadInput = Omit<Lead, "id" | "estado" | "creadoEn" | "primerContactoAt" | "suprimidoAt">;
