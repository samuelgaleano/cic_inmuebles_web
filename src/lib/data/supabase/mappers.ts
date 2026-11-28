import type {
  Agent,
  AgentAvailability,
  AgentInput,
  Appointment,
  AppointmentInput,
  Lead,
  LeadInput,
  Property,
  PropertyInput,
  PropertyMedia,
  Template,
  TemplateInput,
} from "@/lib/domain";
import { normalizarInmueble } from "@/lib/domain/normalizar";
import type {
  AgentRow,
  AgentWrite,
  AppointmentRow,
  AppointmentWrite,
  AvailabilityRow,
  LeadRow,
  LeadWrite,
  PropertyMediaInsert,
  PropertyMediaRow,
  PropertyRowLectura,
  PropertyWrite,
  TemplateRow,
  TemplateWrite,
} from "./filas";
import { limpiarOrigen } from "@/lib/leads/origen";

/** Fila de la tabla `property_media` -> dominio. */
export function mediaRowToDomain(row: PropertyMediaRow): PropertyMedia {
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
export function propertyRowToDomain(row: PropertyRowLectura): Property {
  const medios: PropertyMedia[] = (row.property_media ?? [])
    .map(mediaRowToDomain)
    .sort((a, b) => a.order - b.order);

  // Lo ya guardado con errores de digitación ("BogotÁ", "BELLA SUIZA") se
  // corrige al leer: ver src/lib/domain/normalizar.ts.
  return normalizarInmueble({
    id: row.id,
    codigo: row.codigo,
    slug: row.slug,
    titulo: row.titulo,
    tipo: row.tipo,
    estado: row.estado,
    precio: Number(row.precio),
    administracion: row.administracion ?? undefined,
    ubicacion: {
      ciudad: row.ciudad,
      sector: row.sector ?? undefined,
      conjunto: row.conjunto ?? undefined,
      direccion: row.direccion ?? undefined,
    },
    caracteristicas: {
      habitaciones: row.habitaciones ?? undefined,
      banos: row.banos ?? undefined,
      area: row.area ?? undefined,
      parqueaderos: row.parqueaderos ?? undefined,
    },
    descripcion: row.descripcion ?? "",
    medios,
    propietario: row.propietario_nombre
      ? {
          nombre: row.propietario_nombre,
          telefono: row.propietario_telefono ?? "",
          email: row.propietario_email ?? undefined,
        }
      : undefined,
    notasInternas: row.notas_internas ?? undefined,
    driveFolderId: row.drive_folder_id ?? undefined,
    // Columnas de 0012: sin la migración no vienen y el inmueble queda sin anunciante.
    anunciante: row.anunciante_whatsapp
      ? { nombre: row.anunciante_nombre ?? undefined, whatsapp: row.anunciante_whatsapp }
      : undefined,
    destacado: Boolean(row.destacado),
    publicado: Boolean(row.publicado),
    creadoEn: row.created_at,
    actualizadoEn: row.updated_at,
  });
}

/** PropertyInput -> fila de `properties` (sin medios, que van aparte). */
export function propertyInputToRow(entrada: PropertyInput): PropertyWrite {
  // Se guarda ya corregido: cubre el panel admin y la importación desde Drive.
  const input = normalizarInmueble(entrada);
  return {
    titulo: input.titulo,
    tipo: input.tipo,
    estado: input.estado,
    precio: input.precio,
    administracion: input.administracion ?? null,
    ciudad: input.ubicacion.ciudad,
    sector: input.ubicacion.sector ?? null,
    conjunto: input.ubicacion.conjunto ?? null,
    direccion: input.ubicacion.direccion ?? null,
    habitaciones: input.caracteristicas.habitaciones ?? null,
    banos: input.caracteristicas.banos ?? null,
    area: input.caracteristicas.area ?? null,
    parqueaderos: input.caracteristicas.parqueaderos ?? null,
    descripcion: input.descripcion,
    propietario_nombre: input.propietario?.nombre ?? null,
    propietario_telefono: input.propietario?.telefono ?? null,
    propietario_email: input.propietario?.email ?? null,
    notas_internas: input.notasInternas ?? null,
    drive_folder_id: input.driveFolderId ?? null,
    anunciante_nombre: input.anunciante?.whatsapp ? (input.anunciante.nombre ?? null) : null,
    anunciante_whatsapp: input.anunciante?.whatsapp ?? null,
    destacado: input.destacado,
    publicado: input.publicado,
  };
}

/**
 * Columnas que llegan con la migración 0012. Si la base aún no la tiene, PostgREST rechaza la escritura
 * (PGRST204, "Could not find the 'x' column") o Postgres responde 42703: el repositorio reintenta sin ellas
 * para que un despliegue antes de la migración no frene leads, cobros ni el panel.
 */
export const COLUMNAS_0012_PROPERTIES = ["anunciante_nombre", "anunciante_whatsapp"] as const;
export const COLUMNAS_0012_LEADS = [
  "utm_source",
  "utm_medium",
  "utm_campaign",
  "referente",
  "pagina_entrada",
  "consentimiento_at",
  "consentimiento_version",
] as const;

/** true si el error es «esa columna no existe» para alguna de `columnas`. */
export function faltaColumna(error: unknown, columnas: readonly string[]): boolean {
  const e = error as { code?: string; message?: string } | null;
  if (!e) return false;
  if (e.code !== "PGRST204" && e.code !== "42703") return false;
  const msg = e.message ?? "";
  return columnas.some((c) => msg.includes(c));
}

/** La misma fila sin las columnas indicadas. */
export function sinColumnas(fila: Record<string, unknown>, columnas: readonly string[]): Record<string, unknown> {
  const copia = { ...fila };
  for (const c of columnas) delete copia[c];
  return copia;
}

/** Medios del input -> filas de `property_media` para un inmueble dado. */
export function mediaInputToRows(
  propertyId: string,
  medios: PropertyMedia[],
): PropertyMediaInsert[] {
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
export function leadRowToDomain(row: LeadRow): Lead {
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
    origen: limpiarOrigen({
      utmSource: row.utm_source,
      utmMedium: row.utm_medium,
      utmCampaign: row.utm_campaign,
      referente: row.referente,
      paginaEntrada: row.pagina_entrada,
    }),
    consentimientoAt: row.consentimiento_at ?? undefined,
    consentimientoVersion: row.consentimiento_version ?? undefined,
    primerContactoAt: row.primer_contacto_at ?? undefined,
    estado: row.estado ?? "nuevo",
    creadoEn: row.created_at,
    // Columnas de 0012 y 0013: la lectura es `select *`, así que llegan solas cuando la migración está aplicada.
    ...(row.primer_contacto_at ? { primerContactoAt: new Date(row.primer_contacto_at).toISOString() } : {}),
    ...(row.utm_source ? { utmSource: row.utm_source } : {}),
    ...(row.utm_medium ? { utmMedium: row.utm_medium } : {}),
    ...(row.utm_campaign ? { utmCampaign: row.utm_campaign } : {}),
    ...(row.referente ? { referente: row.referente } : {}),
    ...(row.pagina_entrada ? { paginaEntrada: row.pagina_entrada } : {}),
    ...(row.suprimido_at ? { suprimidoAt: new Date(row.suprimido_at).toISOString() } : {}),
  };
}

/** LeadInput -> fila de `leads`. */
export function leadInputToRow(input: LeadInput): LeadWrite {
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
    // Columnas de 0012 (ver COLUMNAS_0012_LEADS). primer_contacto_at no la escribe el formulario.
    utm_source: input.origen?.utmSource ?? null,
    utm_medium: input.origen?.utmMedium ?? null,
    utm_campaign: input.origen?.utmCampaign ?? null,
    referente: input.origen?.referente ?? null,
    pagina_entrada: input.origen?.paginaEntrada ?? null,
    consentimiento_at: input.consentimientoAt ?? null,
    consentimiento_version: input.consentimientoVersion ?? null,
  };
}

/** Fila de `agents` -> dominio. */
export function agentRowToDomain(row: AgentRow): Agent {
  return {
    id: row.id,
    userId: row.user_id ?? undefined,
    nombre: row.nombre,
    email: row.email,
    telefono: row.telefono ?? undefined,
    fotoUrl: row.foto_url ?? undefined,
    rol: row.rol,
    activo: Boolean(row.activo),
    creadoEn: row.created_at,
  };
}

/** AgentInput -> fila de `agents`. */
export function agentInputToRow(input: AgentInput): AgentWrite {
  return {
    user_id: input.userId ?? null,
    nombre: input.nombre,
    email: input.email,
    telefono: input.telefono ?? null,
    foto_url: input.fotoUrl ?? null,
    rol: input.rol,
    activo: input.activo,
  };
}

/** Fila de `agent_availability` -> dominio. */
export function availabilityRowToDomain(row: AvailabilityRow): AgentAvailability {
  return {
    id: row.id,
    agentId: row.agent_id,
    diaSemana: row.dia_semana,
    horaInicio: row.hora_inicio,
    horaFin: row.hora_fin,
  };
}

/** Fila de `appointments` -> dominio. */
export function appointmentRowToDomain(row: AppointmentRow): Appointment {
  return {
    id: row.id,
    propertyId: row.property_id,
    agentId: row.agent_id ?? undefined,
    leadId: row.lead_id ?? undefined,
    ...(row.contacto_id ? { contactoId: row.contacto_id } : {}),
    clienteNombre: row.cliente_nombre,
    clienteTelefono: row.cliente_telefono,
    clienteEmail: row.cliente_email ?? undefined,
    inicioEn: row.inicio_en,
    duracionMin: row.duracion_min ?? 60,
    estado: row.estado,
    notas: row.notas ?? undefined,
    creadoEn: row.created_at,
  };
}

/** AppointmentInput -> fila de `appointments`. */
export function appointmentInputToRow(input: AppointmentInput): AppointmentWrite {
  return {
    property_id: input.propertyId,
    agent_id: input.agentId ?? null,
    lead_id: input.leadId ?? null,
    // Solo si viene: así una base sin la columna (0013 sin aplicar) acepta las citas que no la usan.
    ...(input.contactoId ? { contacto_id: input.contactoId } : {}),
    cliente_nombre: input.clienteNombre,
    cliente_telefono: input.clienteTelefono,
    cliente_email: input.clienteEmail ?? null,
    inicio_en: input.inicioEn,
    duracion_min: input.duracionMin,
    estado: input.estado ?? "solicitada",
    notas: input.notas ?? null,
  };
}

/** Fila de `templates` -> dominio. */
export function templateRowToDomain(row: TemplateRow): Template {
  return {
    id: row.id,
    nombre: row.nombre,
    tipo: row.tipo,
    contenido: row.contenido,
    creadoEn: row.created_at,
    actualizadoEn: row.updated_at,
  };
}

/** TemplateInput -> fila de `templates`. */
export function templateInputToRow(input: TemplateInput): TemplateWrite {
  return {
    nombre: input.nombre,
    tipo: input.tipo,
    contenido: input.contenido,
  };
}
