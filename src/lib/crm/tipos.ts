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
  /** Cuándo volver a llamarlo (ISO UTC). Se fija y se borra aparte de los datos (`fijarProximoContacto`). */
  proximoContactoAt?: string;
  /** Para qué es ese próximo contacto ("mandarle el apto de Cedritos"). */
  proximoContactoNota?: string;
}

export type ContactoInput = Omit<Contacto, "id" | "archivado" | "creadoEn" | "proximoContactoAt" | "proximoContactoNota">;

/** Tipos de actividad con los que se cierra un seguimiento («Hecho»). */
export const TIPOS_SEGUIMIENTO = ["llamada", "whatsapp", "nota"] as const satisfies readonly TipoActividad[];

export type ClaseSeguimiento = "vencido" | "hoy" | "futuro";

/** Una venta cerrada: quién vendió, quién compró, por cuánto y la comisión pactada y cobrada. */
export interface Cierre {
  id: string;
  captacionId?: string;
  busquedaId?: string;
  propertyId?: string;
  vendedorContactoId?: string;
  compradorContactoId?: string;
  precioVenta: number;
  /** Día de la venta (YYYY-MM-DD, calendario de Bogotá). */
  fechaCierre: string;
  comisionPct?: number;
  comisionPactada?: number;
  comisionCobrada?: number;
  /** Día en que se cobró la comisión (YYYY-MM-DD). */
  cobradaAt?: string;
  notas?: string;
  creadoEn: string;
}

export type CierreInput = Omit<Cierre, "id" | "creadoEn" | "comisionCobrada" | "cobradaAt">;

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

/** Tamaño de página de los listados del CRM. */
export const POR_PAGINA = 50;

export const FILTROS_TIPO_CONTACTO = ["vendedor", "comprador"] as const;
export type FiltroTipoContacto = (typeof FILTROS_TIPO_CONTACTO)[number];

/** Filtros del listado paginado de contactos (vista `contactos_resumen`, migración 0013). */
export interface FiltroContactos {
  q?: string;
  incluirArchivados?: boolean;
  /** Vendedor: con alguna captación no descartada. Comprador: con alguna búsqueda no descartada. */
  tipo?: FiltroTipoContacto;
  origen?: Origen;
  /** Solo los que no tienen fecha de próximo contacto. */
  sinProximo?: boolean;
  /** Desde 1. */
  pagina?: number;
  porPagina?: number;
}

export interface Pagina<T> {
  filas: T[];
  total: number;
  pagina: number;
  porPagina: number;
}

/** Lo mínimo de una persona para nombrarla y escribirle desde un listado. */
export interface ContactoBreve {
  id: string;
  nombre: string;
  telefono?: string;
  email?: string;
  archivado: boolean;
}

export interface CaptacionConContacto extends Captacion {
  contacto: ContactoBreve;
}

export interface BusquedaConContacto extends Busqueda {
  contacto: ContactoBreve;
  /** Inmuebles propuestos a esta búsqueda. */
  propuestas: number;
}

/** Una propuesta vista desde el inmueble: a quién se le propuso y cómo va. */
export interface PropuestaDeInmueble extends Propuesta {
  contacto: ContactoBreve;
  estadoBusqueda: EstadoBusqueda;
}

export interface GrupoPendiente {
  total: number;
  /** Los primeros (para nombrarlos en «Por hacer»). */
  items: ContactoBreve[];
}

export interface PendientesCrm {
  porAprobar: GrupoPendiente;
  pagoPendiente: GrupoPendiente;
  multimedia: GrupoPendiente;
  sinPropuestas: GrupoPendiente;
  sinSeguimiento: GrupoPendiente;
  totales: { contactos: number; vendedores: number; compradores: number };
}

/**
 * De dónde viene una actividad automática: el lead, el plan pagado o la cita que la originó.
 * Con la migración 0013 es una columna con índice único (no se repite aunque se corra dos veces);
 * sin ella, la marca `[lead:<id>]` en el texto cumple el mismo papel.
 */
export interface LlaveActividad {
  tipo: "lead" | "servicio" | "cita";
  id: string;
}

export const marcaDe = (llave: LlaveActividad) => `[${llave.tipo}:${llave.id}]`;

/** Lo que el reporte necesita de cada captación y búsqueda creadas en el mes. */
export interface DatosEmbudo {
  captaciones: { estado: EstadoCaptacion }[];
  busquedas: { estado: EstadoBusqueda; propuestas: EstadoPropuesta[] }[];
}
