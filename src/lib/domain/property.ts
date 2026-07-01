/**
 * Modelo de dominio del Inmueble (CIC Inmuebles).
 *
 * Catálogo enfocado en VENTA: todos los inmuebles están en venta, por eso no
 * existe el concepto de operación (venta/arriendo). El modelo es deliberadamente
 * mínimo: solo los datos que se usan. La fuente de verdad es la base de datos
 * (ver docs/ARQUITECTURA.md).
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

/** Estado del inmueble dentro del proceso de venta. */
export const PROPERTY_STATUSES = ["disponible", "en_proceso", "vendido"] as const;
export type PropertyStatus = (typeof PROPERTY_STATUSES)[number];

export const PROPERTY_STATUS_LABELS: Record<PropertyStatus, string> = {
  disponible: "Listo para vender",
  en_proceso: "En proceso de venta",
  vendido: "Vendido",
};

/** Moneda única del catálogo (Colombia). */
export const CURRENCY = "COP";

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
  ciudad: string;
  /** Sector / zona / barrio. */
  sector?: string;
  /** Nombre del conjunto o edificio. */
  conjunto?: string;
  /** Dirección exacta — NO se expone en el sitio público. */
  direccion?: string;
}

/** Especificaciones generales. */
export interface PropertyFeatures {
  habitaciones?: number;
  banos?: number;
  /** Área en m². */
  area?: number;
}

/** Datos del propietario — privados, solo visibles en el panel admin. */
export interface PropertyOwner {
  nombre: string;
  telefono: string;
  email?: string;
}

export interface Property {
  id: string;
  /** Código interno legible, p. ej. "1006". */
  codigo: string;
  slug: string;
  titulo: string;
  tipo: PropertyType;
  estado: PropertyStatus;

  /** Precio de venta (COP). */
  precio: number;
  /** Valor de administración mensual, si aplica (COP). */
  administracion?: number;

  ubicacion: PropertyLocation;
  caracteristicas: PropertyFeatures;

  /** Descripción general breve (intro que se muestra en la ficha). */
  descripcion: string;

  medios: PropertyMedia[];

  /** Privado: solo panel admin. */
  propietario?: PropertyOwner;
  /** Notas internas del equipo (negociación, llaves, observaciones). Privado. */
  notasInternas?: string;
  /** ID de la carpeta de Google Drive del inmueble (integración híbrida). */
  driveFolderId?: string;

  destacado: boolean;
  publicado: boolean;

  creadoEn: string;
  actualizadoEn: string;
}

/** Versión pública: omite datos sensibles (propietario, notas internas). */
export type PublicProperty = Omit<Property, "propietario" | "notasInternas"> & {
  ubicacion: Omit<PropertyLocation, "direccion">;
};

/** Datos para crear/editar un inmueble (sin campos generados por el sistema). */
export type PropertyInput = Omit<
  Property,
  "id" | "codigo" | "slug" | "creadoEn" | "actualizadoEn"
> & {
  codigo?: string;
  slug?: string;
};

/** Filtros del catálogo. */
export interface PropertyFilters {
  q?: string;
  tipo?: PropertyType;
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
  const { propietario: _propietario, notasInternas: _notasInternas, ubicacion, ...rest } = p;
  const { direccion: _direccion, ...ubicacionPublica } = ubicacion;
  return { ...rest, ubicacion: ubicacionPublica };
}
