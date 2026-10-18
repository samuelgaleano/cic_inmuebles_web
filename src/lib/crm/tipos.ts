/**
 * Modelo del CRM interno. Una persona (Contacto) puede ser vendedora (Captacion),
 * compradora (Busqueda) o ambas; cada compradora recibe Propuestas de inmuebles
 * y cada contacto tiene su linea de tiempo de Actividades.
 */

export const ORIGENES = ["manual", "web", "whatsapp", "hoja", "referido"] as const;
export type Origen = (typeof ORIGENES)[number];
export const ORIGEN_LABELS: Record<Origen, string> = {
  manual: "Manual",
  web: "Formulario web",
  whatsapp: "WhatsApp",
  hoja: "Hoja de Google",
  referido: "Referido",
};

export const TIPOS_COMPRADOR = ["comprador", "inmobiliaria", "independiente"] as const;
export type TipoComprador = (typeof TIPOS_COMPRADOR)[number];
export const TIPO_COMPRADOR_LABELS: Record<TipoComprador, string> = {
  comprador: "Comprador",
  inmobiliaria: "Inmobiliaria",
  independiente: "Asesor independiente",
};

export const ESTATUS_PAGO = ["pendiente", "paga_completo", "paga_parcial", "no_paga"] as const;
export type EstatusPago = (typeof ESTATUS_PAGO)[number];
export const ESTATUS_PAGO_LABELS: Record<EstatusPago, string> = {
  pendiente: "Pendiente",
  paga_completo: "Paga completo",
  paga_parcial: "Paga parcial",
  no_paga: "No paga",
};

export const MULTIMEDIA = ["por_coordinar", "en_curso", "listo"] as const;
export type Multimedia = (typeof MULTIMEDIA)[number];
export const MULTIMEDIA_LABELS: Record<Multimedia, string> = {
  por_coordinar: "Por coordinar",
  en_curso: "En curso",
  listo: "Listo",
};

export const ESTADOS_CAPTACION = ["nueva", "en_gestion", "publicada", "vendida", "descartada"] as const;
export type EstadoCaptacion = (typeof ESTADOS_CAPTACION)[number];
export const ESTADO_CAPTACION_LABELS: Record<EstadoCaptacion, string> = {
  nueva: "Nueva",
  en_gestion: "En gestión",
  publicada: "Publicada",
  vendida: "Vendida",
  descartada: "Descartada",
};

export const ESTADOS_BUSQUEDA = ["activa", "en_visitas", "cerrada", "descartada"] as const;
export type EstadoBusqueda = (typeof ESTADOS_BUSQUEDA)[number];
export const ESTADO_BUSQUEDA_LABELS: Record<EstadoBusqueda, string> = {
  activa: "Activa",
  en_visitas: "En visitas",
  cerrada: "Cerrada",
  descartada: "Descartada",
};

export const ESTADOS_PROPUESTA = ["propuesto", "visito", "oferto", "descartado"] as const;
export type EstadoPropuesta = (typeof ESTADOS_PROPUESTA)[number];
export const ESTADO_PROPUESTA_LABELS: Record<EstadoPropuesta, string> = {
  propuesto: "Propuesto",
  visito: "Visitó",
  oferto: "Ofertó",
  descartado: "Descartado",
};

export const TIPOS_ACTIVIDAD = ["nota", "llamada", "whatsapp", "visita", "correo"] as const;
export type TipoActividad = (typeof TIPOS_ACTIVIDAD)[number];
export const TIPO_ACTIVIDAD_LABELS: Record<TipoActividad, string> = {
  nota: "Nota",
  llamada: "Llamada",
  whatsapp: "WhatsApp",
  visita: "Visita",
  correo: "Correo",
};

export interface Contacto {
  id: string;
  nombre: string;
  telefono?: string;
  /** Formato internacional; sirve para no duplicar a la misma persona. */
  telefonoE164?: string;
  email?: string;
  ciudad?: string;
  notas?: string;
  origen: Origen;
  archivado: boolean;
  creadoEn: string;
}

export type ContactoInput = Omit<Contacto, "id" | "archivado" | "creadoEn">;

export interface Captacion {
  id: string;
  contactoId: string;
  propertyId?: string;
  ubicacion?: string;
  precioEsperado?: number;
  /** Porcentaje de comisión (3 = 3 %). */
  comisionPct: number;
  /** Precio por porcentaje; nulo si no hay precio. */
  comisionValor?: number;
  estatusPago: EstatusPago;
  aprobada: boolean;
  multimedia: Multimedia;
  estado: EstadoCaptacion;
  notas?: string;
  creadoEn: string;
}

export type CaptacionInput = Omit<Captacion, "id" | "comisionValor" | "creadoEn">;

export interface Busqueda {
  id: string;
  contactoId: string;
  tipo: TipoComprador;
  ubicacion?: string;
  precioMax?: number;
  especificacion?: string;
  potencial: boolean;
  estado: EstadoBusqueda;
  notas?: string;
  creadoEn: string;
}

export type BusquedaInput = Omit<Busqueda, "id" | "creadoEn">;

export interface Propuesta {
  busquedaId: string;
  propertyId: string;
  estado: EstadoPropuesta;
  creadoEn: string;
}

export interface Actividad {
  id: string;
  contactoId: string;
  propertyId?: string;
  tipo: TipoActividad;
  detalle: string;
  ocurrioEn: string;
}

export type ActividadInput = Omit<Actividad, "id" | "ocurrioEn"> & { ocurrioEn?: string };

/** Fila del listado de contactos: la persona con lo que tiene abierto. */
export interface ContactoResumen extends Contacto {
  captaciones: number;
  busquedas: number;
  ultimaActividad?: string;
}
