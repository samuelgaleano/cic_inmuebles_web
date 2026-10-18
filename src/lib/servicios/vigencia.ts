/**
 * Reglas de vigencia de un servicio de publicación. Puro (sin base de datos ni
 * correo) para poder probarlo: el cron y el panel solo llaman a estas funciones.
 *
 * El reloj arranca cuando CIC publica el inmueble y activa el servicio, no al
 * pagar. Se avisa 7 y 1 día antes del vencimiento y una vez al vencer.
 */

export type EstadoServicio = "pendiente_publicar" | "activo" | "vencido";
export type TipoAviso = "7d" | "1d" | "vencido";

export interface Servicio {
  id: string;
  txId: string;
  reference: string | null;
  planId: string;
  /** Duración del plan en días (copiada de plans.ts al pagar). */
  dias: number;
  clienteEmail: string | null;
  clienteNombre: string | null;
  clienteTelefono: string | null;
  estado: EstadoServicio;
  /** Ficha enlazada (planes por inmueble). Nula en paquetes y mientras esté pendiente. */
  propertySlug: string | null;
  inicioAt: string | null;
  venceAt: string | null;
  aviso7dAt: string | null;
  aviso1dAt: string | null;
  avisoVencidoAt: string | null;
  createdAt: string;
}

const DIA_MS = 86_400_000;

export function sumarDias(desde: Date, dias: number): Date {
  return new Date(desde.getTime() + dias * DIA_MS);
}

/** Días enteros que faltan (redondeo hacia arriba); 0 o negativo si ya venció. */
export function diasRestantes(venceAt: string | Date, ahora: Date): number {
  const vence = typeof venceAt === "string" ? new Date(venceAt) : venceAt;
  return Math.ceil((vence.getTime() - ahora.getTime()) / DIA_MS);
}

/**
 * Fechas de un servicio al activarlo: empieza `inicio` y dura `dias`. Si la
 * ficha ya estaba cubierta por otro servicio vigente (una renovación), el nuevo
 * periodo se suma a lo que le quedaba: no se pierden días pagados.
 */
export function ventanaDeActivacion(inicio: Date, dias: number, vigenteHasta?: string | null): { inicioAt: string; venceAt: string } {
  const base = vigenteHasta && new Date(vigenteHasta).getTime() > inicio.getTime() ? new Date(vigenteHasta) : inicio;
  return { inicioAt: inicio.toISOString(), venceAt: sumarDias(base, dias).toISOString() };
}

/**
 * Renovar suma un periodo completo a partir del vencimiento actual si todavía
 * está vigente (no se pierden días pagados) o a partir de `ahora` si ya venció.
 */
export function ventanaDeRenovacion(servicio: Pick<Servicio, "venceAt" | "dias">, ahora: Date): { inicioAt: string | null; venceAt: string } {
  const vigente = servicio.venceAt && new Date(servicio.venceAt).getTime() > ahora.getTime();
  const base = vigente ? new Date(servicio.venceAt as string) : ahora;
  return { inicioAt: vigente ? null : ahora.toISOString(), venceAt: sumarDias(base, servicio.dias).toISOString() };
}

export interface AccionVigencia {
  /** true si el servicio debe pasar a «vencido» (y su ficha despublicarse). */
  vencer: boolean;
  /** Aviso que corresponde enviar hoy (solo uno, el más urgente), o null. */
  aviso: TipoAviso | null;
}

/**
 * Qué toca hacer hoy con un servicio. Solo los activos con fecha de
 * vencimiento tienen reloj. Un servicio ya vencido solo necesita su aviso de
 * vencimiento si todavía no se envió (p. ej. falló el correo ese día).
 */
export function accionDeHoy(s: Servicio, ahora: Date): AccionVigencia {
  if (s.estado === "pendiente_publicar" || !s.venceAt) return { vencer: false, aviso: null };
  const restan = new Date(s.venceAt).getTime() - ahora.getTime();

  if (restan <= 0) {
    return { vencer: s.estado === "activo", aviso: s.avisoVencidoAt ? null : "vencido" };
  }
  if (s.estado !== "activo") return { vencer: false, aviso: null };
  if (restan <= DIA_MS && !s.aviso1dAt) return { vencer: false, aviso: "1d" };
  if (restan <= 7 * DIA_MS && !s.aviso7dAt && !s.aviso1dAt) return { vencer: false, aviso: "7d" };
  return { vencer: false, aviso: null };
}

/** Etiqueta corta del estado para el panel y los correos. */
export const ETIQUETA_ESTADO: Record<EstadoServicio, string> = {
  pendiente_publicar: "Pendiente de publicar",
  activo: "Activo",
  vencido: "Vencido",
};

/** Fecha y hora en Bogotá: «17 de octubre de 2026, 11:08 p. m.» (Colombia no tiene horario de verano). */
export function fechaHora(iso: string): string {
  return new Intl.DateTimeFormat("es-CO", {
    timeZone: "America/Bogota",
    day: "numeric",
    month: "long",
    year: "numeric",
    hour: "numeric",
    minute: "2-digit",
    hour12: true,
  }).format(new Date(iso));
}

/** Fecha larga en hora de Bogotá: «sábado 14 de noviembre de 2026». */
export function fechaLarga(iso: string): string {
  return new Intl.DateTimeFormat("es-CO", {
    timeZone: "America/Bogota",
    weekday: "long",
    day: "numeric",
    month: "long",
    year: "numeric",
  }).format(new Date(iso));
}
