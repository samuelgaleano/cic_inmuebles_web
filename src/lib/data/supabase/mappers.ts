import type {
  Lead,
  LeadInput,
  Property,
  PropertyInput,
  PropertyMedia,
} from "@/lib/domain";

/* eslint-disable @typescript-eslint/no-explicit-any */

/** Fila de la tabla `property_media` -> dominio. */
export function mediaRowToDomain(row: any): PropertyMedia {
  return {
    id: row.id,
    type: row.tipo,
    provider: row.provider,
    url: row.url,
    thumbnailUrl: row.thumbnail_url ?? undefined,
    alt: row.alt ?? undefined,
    order: row.orden ?? 0,
    isCover: Boolean(row.is_cover),
  };
}

/** Fila de `properties` (con `property_media` anidado) -> dominio. */
export function propertyRowToDomain(row: any): Property {
  const medios: PropertyMedia[] = (row.property_media ?? [])
    .map(mediaRowToDomain)
    .sort((a: PropertyMedia, b: PropertyMedia) => a.order - b.order);

  return {
    id: row.id,
    codigo: row.codigo,
    slug: row.slug,
    titulo: row.titulo,
    tipo: row.tipo,
    operacion: row.operacion,
    estado: row.estado,
    precio: Number(row.precio),
    moneda: row.moneda ?? "COP",
    ubicacion: {
      departamento: row.departamento,
      ciudad: row.ciudad,
      barrio: row.barrio ?? undefined,
      direccion: row.direccion ?? undefined,
      lat: row.lat ?? undefined,
      lng: row.lng ?? undefined,
    },
    caracteristicas: {
      habitaciones: row.habitaciones ?? undefined,
      banos: row.banos ?? undefined,
      areaConstruida: row.area_construida ?? undefined,
      areaTotal: row.area_total ?? undefined,
      parqueaderos: row.parqueaderos ?? undefined,
      estrato: row.estrato ?? undefined,
      piso: row.piso ?? undefined,
      antiguedadAnios: row.antiguedad_anios ?? undefined,
      administracion: row.administracion ?? undefined,
    },
    amenidades: row.amenidades ?? [],
    descripcion: row.descripcion ?? "",
    descripcionCorta: row.descripcion_corta ?? "",
    medios,
    propietario: row.propietario_nombre
      ? {
          nombre: row.propietario_nombre,
          telefono: row.propietario_telefono ?? "",
          email: row.propietario_email ?? undefined,
        }
      : undefined,
    driveFolderId: row.drive_folder_id ?? undefined,
    destacado: Boolean(row.destacado),
    publicado: Boolean(row.publicado),
    creadoEn: row.created_at,
    actualizadoEn: row.updated_at,
  };
}

/** PropertyInput -> fila de `properties` (sin medios, que van aparte). */
export function propertyInputToRow(input: PropertyInput): Record<string, unknown> {
  return {
    titulo: input.titulo,
    tipo: input.tipo,
    operacion: input.operacion,
    estado: input.estado,
    precio: input.precio,
    moneda: input.moneda,
    departamento: input.ubicacion.departamento,
    ciudad: input.ubicacion.ciudad,
    barrio: input.ubicacion.barrio ?? null,
    direccion: input.ubicacion.direccion ?? null,
    lat: input.ubicacion.lat ?? null,
    lng: input.ubicacion.lng ?? null,
    habitaciones: input.caracteristicas.habitaciones ?? null,
    banos: input.caracteristicas.banos ?? null,
    area_construida: input.caracteristicas.areaConstruida ?? null,
    area_total: input.caracteristicas.areaTotal ?? null,
    parqueaderos: input.caracteristicas.parqueaderos ?? null,
    estrato: input.caracteristicas.estrato ?? null,
    piso: input.caracteristicas.piso ?? null,
    antiguedad_anios: input.caracteristicas.antiguedadAnios ?? null,
    administracion: input.caracteristicas.administracion ?? null,
    amenidades: input.amenidades,
    descripcion: input.descripcion,
    descripcion_corta: input.descripcionCorta,
    propietario_nombre: input.propietario?.nombre ?? null,
    propietario_telefono: input.propietario?.telefono ?? null,
    propietario_email: input.propietario?.email ?? null,
    drive_folder_id: input.driveFolderId ?? null,
    destacado: input.destacado,
    publicado: input.publicado,
  };
}

/** Medios del input -> filas de `property_media` para un inmueble dado. */
export function mediaInputToRows(
  propertyId: string,
  medios: PropertyMedia[],
): Record<string, unknown>[] {
  return medios.map((m, i) => ({
    property_id: propertyId,
    tipo: m.type,
    provider: m.provider,
    url: m.url,
    thumbnail_url: m.thumbnailUrl ?? null,
    alt: m.alt ?? null,
    orden: m.order ?? i,
    is_cover: m.isCover,
  }));
}

/** Fila de `leads` -> dominio. */
export function leadRowToDomain(row: any): Lead {
  return {
    id: row.id,
    tipo: row.tipo,
    nombre: row.nombre,
    telefono: row.telefono,
    email: row.email ?? undefined,
    mensaje: row.mensaje ?? undefined,
    intencion: row.intencion ?? undefined,
    propertyId: row.property_id ?? undefined,
    propertySlug: row.property_slug ?? undefined,
    preferencia: row.preferencia ?? undefined,
    tipoInmueble: row.tipo_inmueble ?? undefined,
    ciudad: row.ciudad ?? undefined,
    fuente: row.fuente ?? "web",
    estado: row.estado ?? "nuevo",
    creadoEn: row.created_at,
  };
}

/** LeadInput -> fila de `leads`. */
export function leadInputToRow(input: LeadInput): Record<string, unknown> {
  return {
    tipo: input.tipo,
    nombre: input.nombre,
    telefono: input.telefono,
    email: input.email ?? null,
    mensaje: input.mensaje ?? null,
    intencion: input.intencion ?? null,
    property_id: input.propertyId ?? null,
    property_slug: input.propertySlug ?? null,
    preferencia: input.preferencia ?? null,
    tipo_inmueble: input.tipoInmueble ?? null,
    ciudad: input.ciudad ?? null,
    fuente: input.fuente,
  };
}
