/**
 * Modelo de dominio del Inmueble.
 *
 * Es la entidad central del catálogo. La fuente de verdad es la base de datos
 * (ver docs/ARQUITECTURA.md); estos tipos describen la forma de los datos que
 * consume tanto el sitio público como el panel de administración.
 */

/** Tipo de inmueble. */
export const PROPERTY_TYPES = [
  "apartamento",
  "casa",
  "apartaestudio",
  "casa_campestre",
  "oficina",
  "local",
  "bodega",
  "lote",
  "finca",
] as const;
export type PropertyType = (typeof PROPERTY_TYPES)[number];

export const PROPERTY_TYPE_LABELS: Record<PropertyType, string> = {
  apartamento: "Apartamento",
  casa: "Casa",
  apartaestudio: "Apartaestudio",
  casa_campestre: "Casa campestre",
  oficina: "Oficina",
  local: "Local comercial",
  bodega: "Bodega",
  lote: "Lote",
  finca: "Finca",
};

/** Operación comercial. */
export const OPERATIONS = ["venta", "arriendo"] as const;
export type Operation = (typeof OPERATIONS)[number];

export const OPERATION_LABELS: Record<Operation, string> = {
  venta: "En venta",
  arriendo: "En arriendo",
};

/**
 * Estado del inmueble dentro del proceso comercial.
 * Sincronizado con el catálogo público en tiempo (casi) real.
 */
export const PROPERTY_STATUSES = ["disponible", "en_proceso", "vendido"] as const;
export type PropertyStatus = (typeof PROPERTY_STATUSES)[number];

export const PROPERTY_STATUS_LABELS: Record<PropertyStatus, string> = {
  disponible: "Disponible",
  en_proceso: "En proceso",
  vendido: "Vendido",
};

/** Medio audiovisual asociado al inmueble. */
export type MediaProvider = "cloudinary" | "youtube" | "drive" | "external";

export interface PropertyMedia {
  id: string;
  type: "image" | "video";
  provider: MediaProvider;
  /** URL de entrega (imagen) o ID/URL del video. */
  url: string;
  thumbnailUrl?: string;
  alt?: string;
  order: number;
  isCover: boolean;
}

/** Ubicación. La dirección exacta es privada (solo panel admin). */
export interface PropertyLocation {
  departamento: string;
  ciudad: string;
  barrio?: string;
  /** Dirección exacta — NO se expone en el sitio público. */
  direccion?: string;
  lat?: number;
  lng?: number;
}

/** Características numéricas/estructurales. */
export interface PropertyFeatures {
  habitaciones?: number;
  banos?: number;
  /** Área construida en m². */
  areaConstruida?: number;
  /** Área total/lote en m². */
  areaTotal?: number;
  parqueaderos?: number;
  estrato?: number;
  piso?: number;
  antiguedadAnios?: number;
  /** Valor de administración mensual (si aplica). */
  administracion?: number;
}

/** Datos del propietario — privados, solo visibles en el panel admin. */
export interface PropertyOwner {
  nombre: string;
  telefono: string;
  email?: string;
}

export interface Property {
  id: string;
  /** Código interno legible, p. ej. "CIC-0001". */
  codigo: string;
  slug: string;
  titulo: string;
  tipo: PropertyType;
  operacion: Operation;
  estado: PropertyStatus;

  precio: number;
  moneda: string;

  ubicacion: PropertyLocation;
  caracteristicas: PropertyFeatures;
  amenidades: string[];

  /** Descripción larga (se muestra en la ficha). */
  descripcion: string;
  /** Descripción breve para compartir (WhatsApp/redes). */
  descripcionCorta: string;

  medios: PropertyMedia[];

  /** Privado: solo panel admin. */
  propietario?: PropertyOwner;
  /** ID de la carpeta de Google Drive del inmueble (integración híbrida). */
  driveFolderId?: string;

  destacado: boolean;
  publicado: boolean;

  creadoEn: string;
  actualizadoEn: string;
}

/** Versión pública: omite datos sensibles del propietario. */
export type PublicProperty = Omit<Property, "propietario"> & {
  ubicacion: Omit<PropertyLocation, "direccion">;
};

/** Filtros del catálogo. */
export interface PropertyFilters {
  q?: string;
  tipo?: PropertyType;
  operacion?: Operation;
  estado?: PropertyStatus;
  ciudad?: string;
  habitacionesMin?: number;
  precioMin?: number;
  precioMax?: number;
  destacado?: boolean;
}

/** Devuelve la imagen de portada (o la primera disponible). */
export function getCoverMedia(p: Pick<Property, "medios">): PropertyMedia | undefined {
  const images = p.medios.filter((m) => m.type === "image");
  return images.find((m) => m.isCover) ?? images[0] ?? p.medios[0];
}

/** Convierte un inmueble en su versión pública (sin datos privados). */
export function toPublicProperty(p: Property): PublicProperty {
  const { propietario: _propietario, ubicacion, ...rest } = p;
  const { direccion: _direccion, ...ubicacionPublica } = ubicacion;
  return { ...rest, ubicacion: ubicacionPublica };
}
