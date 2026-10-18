/**
 * Reglas de vigencia de un servicio de publicación. Puro (sin base de datos ni
 * correo) para poder probarlo: el cron y el panel solo llaman a estas funciones.
 *
 * El reloj arranca cuando CIC publica el inmueble y activa el servicio, no al
 * pagar. Se avisa 7 y 1 día antes del vencimiento y una vez al vencer; después
 * del vencimiento corre un día de gracia en que la ficha sigue publicada para
 * que el cliente renueve sin interrupciones.
 */

/** «descartado» saca el registro de la lista sin borrar el pago (pagos reversados, pruebas, duplicados). */
export type EstadoServicio = "pendiente_publicar" | "activo" | "vencido" | "descartado";
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
  /** Persona del CRM a la que pertenece (llave foránea). Opcional: los planes anteriores a 0008 pueden no tenerla. */
  contactoId?: string | null;
  /** Inmueble enlazado (llave foránea; `propertySlug` es solo el texto de su dirección). */
  propertyId?: string | null;
  /** Cuándo aprobó Wompi el pago (distinto de `createdAt`, que es cuándo se registró aquí). */
  pagadoAt?: string | null;
}

/** Cómo nació un tramo de vigencia en el libro de periodos de un plan. */
export const TIPOS_PERIODO = ["activacion", "renovacion", "suma_manual", "recorte"] as const;
export type TipoPeriodo = (typeof TIPOS_PERIODO)[number];

export const ETIQUETA_PERIODO: Record<TipoPeriodo, string> = {
  activacion: "Activación",
  renovacion: "Renovación pagada",
  suma_manual: "Días sumados a mano",
  recorte: "Tiempo recortado",
};

export interface Periodo {
  id: number;
  servicioId: string;
  tipo: TipoPeriodo;
  desde: string;
  hasta: string;
  txId: string | null;
  createdAt: string;
}

/** Días enteros de un tramo (redondeo al más cercano). */
export function diasDePeriodo(p: Pick<Periodo, "desde" | "hasta">): number {
  return Math.round((new Date(p.hasta).getTime() - new Date(p.desde).getTime()) / DIA_MS);
}

const DIA_MS = 86_400_000;

/** Días que la publicación sigue visible después de vencer, para que el cliente renueve sin que se caiga. */
export const DIAS_DE_GRACIA = 1;

/** Hasta cuándo se mantiene publicada un servicio vencido: el vencimiento más la gracia. */
export function finDeGracia(venceAt: string | Date): Date {
  const vence = typeof venceAt === "string" ? new Date(venceAt) : venceAt;
  return sumarDias(vence, DIAS_DE_GRACIA);
}

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
  /** true si ya pasó el vencimiento pero sigue dentro del día de gracia: la ficha continúa publicada. */
  gracia: boolean;
}

/**
 * Qué toca hacer hoy con un servicio. Solo los activos con fecha de
 * vencimiento tienen reloj. Al pasar el vencimiento se avisa una vez y la ficha
 * sigue publicada durante el día de gracia; recién después se despublica. Un
 * servicio ya vencido solo necesita su aviso si todavía no se envió (p. ej.
 * falló el correo ese día).
 */
export function accionDeHoy(s: Servicio, ahora: Date): AccionVigencia {
  if (s.estado === "pendiente_publicar" || s.estado === "descartado" || !s.venceAt) return { vencer: false, aviso: null, gracia: false };
  const restan = new Date(s.venceAt).getTime() - ahora.getTime();

  if (restan <= 0) {
    const aviso = s.avisoVencidoAt ? null : "vencido";
    const enGracia = s.estado === "activo" && ahora.getTime() < finDeGracia(s.venceAt).getTime();
    return { vencer: s.estado === "activo" && !enGracia, aviso, gracia: enGracia };
  }
  if (s.estado !== "activo") return { vencer: false, aviso: null, gracia: false };
  if (restan <= DIA_MS && !s.aviso1dAt) return { vencer: false, aviso: "1d", gracia: false };
  if (restan <= 7 * DIA_MS && !s.aviso7dAt && !s.aviso1dAt) return { vencer: false, aviso: "7d", gracia: false };
  return { vencer: false, aviso: null, gracia: false };
}

/** Etiqueta corta del estado para el panel y los correos. */
export const ETIQUETA_ESTADO: Record<EstadoServicio, string> = {
  pendiente_publicar: "Pendiente de publicar",
  activo: "Activo",
  vencido: "Vencido",
  descartado: "Descartado",
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
