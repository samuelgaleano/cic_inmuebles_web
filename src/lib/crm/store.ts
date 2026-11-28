import { getSupabaseAdmin, isSupabaseConfigured } from "@/lib/data/supabase/client";
import { NOMBRE_SUPRIMIDO } from "@/lib/domain/lead";
import { comisionValor } from "./reglas";
import {
  POR_PAGINA,
  type Actividad,
  type ActividadInput,
  type Busqueda,
  type BusquedaConContacto,
  type BusquedaInput,
  type Captacion,
  type CaptacionConContacto,
  type CaptacionInput,
  type Cierre,
  type CierreInput,
  type Contacto,
  type ContactoBreve,
  type ContactoInput,
  type ContactoResumen,
  type DatosEmbudo,
  type EstadoBusqueda,
  type EstadoPropuesta,
  type FiltroContactos,
  type GrupoPendiente,
  type LlaveActividad,
  type Pagina,
  type PendientesCrm,
  type Propuesta,
  type PropuestaDeInmueble,
  marcaDe,
} from "./tipos";

/** Nombre que queda en un contacto, lead o cita cuyos datos se suprimieron (Ley 1581). */
export { NOMBRE_SUPRIMIDO };
/** Texto que reemplaza el detalle de las actividades de una persona suprimida (la columna no admite vacío). */
export const TEXTO_SUPRIMIDO = "(texto suprimido a pedido de la persona)";

/** Normaliza página y tamaño: página desde 1, tamaño entre 1 y 200. */
export function paginaYTamano(f: { pagina?: number; porPagina?: number }): { pagina: number; porPagina: number; desde: number } {
  const porPagina = Math.min(200, Math.max(1, Math.floor(f.porPagina ?? POR_PAGINA) || POR_PAGINA));
  const pagina = Math.max(1, Math.floor(f.pagina ?? 1) || 1);
  return { pagina, porPagina, desde: (pagina - 1) * porPagina };
}

/**
 * Los filtros del listado de contactos aplicados en memoria: es la misma regla que la consulta a la vista
 * `contactos_resumen` y el respaldo cuando la vista no existe (migración 0013 sin aplicar).
 */
export function filtrarContactos(lista: ContactoResumen[], f: FiltroContactos): ContactoResumen[] {
  const q = f.q?.trim().toLowerCase();
  return lista
    .filter((c) => (f.incluirArchivados ? true : !c.archivado))
    .filter((c) => !q || [c.nombre, c.telefono, c.email, c.ciudad].some((v) => v?.toLowerCase().includes(q)))
    .filter((c) => (f.tipo === "vendedor" ? c.captaciones > 0 : f.tipo === "comprador" ? c.busquedas > 0 : true))
    .filter((c) => !f.origen || c.origen === f.origen)
    .filter((c) => !f.sinProximo || !c.proximoContactoAt);
}

const breve = (c: Pick<Contacto, "id" | "nombre" | "telefono" | "email" | "archivado">): ContactoBreve => ({
  id: c.id,
  nombre: c.nombre,
  ...(c.telefono ? { telefono: c.telefono } : {}),
  ...(c.email ? { email: c.email } : {}),
  archivado: c.archivado,
});

/** Lo que cambió al suprimir los datos de una persona. */
export interface ResumenSupresion {
  actividades: number;
}

/** Las tablas o columnas no existen todavía (falta aplicar la migración `migracion`, por defecto 0007_crm.sql). */
export class CrmNoDisponibleError extends Error {
  constructor(
    message?: string,
    readonly migracion: string = "0007",
  ) {
    super(message);
  }
}
export class CrmStoreError extends Error {}

export interface CrmStore {
  disponible(): Promise<boolean>;

  // Contactos
  /** Todos (hasta 1000), con sus conteos. Para exportar e importar; el panel usa `paginaContactos`. */
  listarContactos(opts?: { q?: string; incluirArchivados?: boolean }): Promise<ContactoResumen[]>;
  /** Una página del listado (vista `contactos_resumen`, 0013); sin la vista, el método de arriba filtrado y cortado. */
  paginaContactos(filtro?: FiltroContactos): Promise<Pagina<ContactoResumen>>;
  /** Nombre y datos de contacto de unas pocas personas (las de una página o una venta). */
  contactosPorId(ids: string[]): Promise<ContactoBreve[]>;
  /** «Por hacer» del CRM: cada grupo con su total y los primeros `muestra` nombres, solo de contactos no archivados. */
  pendientes(muestra?: number): Promise<PendientesCrm>;
  obtenerContacto(id: string): Promise<Contacto | null>;
  /** Si ya existe alguien con ese teléfono devuelve a esa persona (`creado: false`) en vez de duplicarla. */
  crearContacto(input: ContactoInput): Promise<{ contacto: Contacto; creado: boolean }>;
  actualizarContacto(id: string, patch: Partial<ContactoInput>): Promise<Contacto | null>;
  archivarContacto(id: string, archivado: boolean): Promise<void>;
  /** Persona con ese correo (sin distinguir mayúsculas), archivada o no. */
  buscarPorEmail(email: string): Promise<Contacto | null>;

  // Vendedores
  listarCaptaciones(contactoId?: string): Promise<Captacion[]>;
  /** La captación no descartada de un inmueble (hay a lo sumo una), sin traer la tabla entera. */
  captacionVigenteDe(propertyId: string): Promise<Captacion | null>;
  /** Con `leadId` (0013) es idempotente: si ese lead ya abrió una captación, devuelve esa. */
  crearCaptacion(input: CaptacionInput, origen?: { leadId?: string }): Promise<Captacion>;
  actualizarCaptacion(id: string, patch: Partial<CaptacionInput>): Promise<Captacion | null>;
  /** Captaciones de contactos no archivados, más nuevas primero, con su persona. */
  paginaCaptaciones(opts?: { pagina?: number; porPagina?: number }): Promise<Pagina<CaptacionConContacto>>;

  // Compradores
  listarBusquedas(contactoId?: string): Promise<Busqueda[]>;
  /** Con `leadId` (0013) es idempotente, como `crearCaptacion`. */
  crearBusqueda(input: BusquedaInput, origen?: { leadId?: string }): Promise<Busqueda>;
  actualizarBusqueda(id: string, patch: Partial<BusquedaInput>): Promise<Busqueda | null>;
  /** Búsquedas de contactos no archivados, más nuevas primero, con su persona y cuántos inmuebles se le propusieron. */
  paginaBusquedas(opts?: { pagina?: number; porPagina?: number }): Promise<Pagina<BusquedaConContacto>>;

  // Inmuebles propuestos a una búsqueda
  listarPropuestas(busquedaIds?: string[]): Promise<Propuesta[]>;
  /** A quién se le propusieron estos inmuebles (consulta por property_id, sin leer las búsquedas de todos). */
  propuestasDeInmuebles(propertyIds: string[]): Promise<PropuestaDeInmueble[]>;
  /** Idempotente: proponer dos veces el mismo inmueble no lo repite. */
  proponer(busquedaId: string, propertyId: string): Promise<Propuesta>;
  cambiarEstadoPropuesta(busquedaId: string, propertyId: string, estado: EstadoPropuesta): Promise<void>;
  quitarPropuesta(busquedaId: string, propertyId: string): Promise<void>;

  // Línea de tiempo
  listarActividades(contactoId: string): Promise<Actividad[]>;
  registrarActividad(input: ActividadInput): Promise<Actividad>;
  /**
   * Registra la actividad que originó un lead, un plan o una cita, una sola vez. Con la 0013 la llave es una
   * columna con índice único; sin ella se busca la marca `[tipo:id]` (que el detalle debe traer) en la línea
   * de tiempo del contacto.
   */
  registrarActividadUnica(input: ActividadInput, llave: LlaveActividad): Promise<{ actividad: Actividad; nueva: boolean }>;
  /** ¿Ya hay una actividad con esa llave? Sin la 0013 se busca la marca en la línea de tiempo de `contactoId`. */
  existeActividad(llave: LlaveActividad, contactoId: string): Promise<boolean>;

  // Leads del formulario enlazados con su persona (llave foránea leads.contacto_id)
  enlazarLead(leadId: string, contactoId: string): Promise<void>;
  leadsDeContacto(contactoId: string): Promise<string[]>;

  // Próximo contacto (migración 0010)
  /** `at` en ISO UTC; null borra la fecha y la nota. */
  fijarProximoContacto(contactoId: string, at: string | null, nota?: string): Promise<void>;
  /** Contactos no archivados con próximo contacto hasta `hasta` (ISO), del más viejo al más nuevo. Vacío si falta la 0010. */
  listarSeguimientos(hasta: string): Promise<Contacto[]>;

  // Ventas cerradas (migración 0010)
  registrarCierre(input: CierreInput): Promise<Cierre>;
  /** Con `contactoId`, las ventas donde esa persona fue vendedora o compradora. Más reciente primero. Vacío si falta la 0010. */
  listarCierres(filtro?: { contactoId?: string; propertyId?: string }): Promise<Cierre[]>;
  marcarComisionCobrada(id: string, monto: number, fecha: string): Promise<Cierre | null>;

  // Reportes
  /** Captaciones y búsquedas no descartadas creadas en [desde, hasta), con los estados de sus propuestas. */
  datosEmbudo(desde: string, hasta: string): Promise<DatosEmbudo>;

  // Ley 1581
  /**
   * Suprime los datos de la persona en el CRM: el contacto queda «Suprimido», sin teléfono, correo, ciudad,
   * notas ni próximo contacto, y archivado; sus actividades conservan tipo y fecha pero no el texto; se borran
   * las notas de sus captaciones, búsquedas y ventas. Los montos (precios, comisiones) se conservan.
   */
  suprimirContacto(contactoId: string, at: string): Promise<ResumenSupresion>;
}

// ---------------------------------------------------------------- Supabase

type ContactoRow = {
  id: string;
  nombre: string;
  telefono: string | null;
  telefono_e164: string | null;
  email: string | null;
  ciudad: string | null;
  notas: string | null;
  origen: Contacto["origen"];
  archivado: boolean;
  created_at: string;
  proximo_contacto_at?: string | null;
  proximo_contacto_nota?: string | null;
};
type CierreRow = {
  id: string;
  captacion_id: string | null;
  busqueda_id: string | null;
  property_id: string | null;
  vendedor_contacto_id: string | null;
  comprador_contacto_id: string | null;
  precio_venta: number | string;
  fecha_cierre: string;
  comision_pct: number | string | null;
  comision_pactada: number | string | null;
  comision_cobrada: number | string | null;
  cobrada_at: string | null;
  notas: string | null;
  created_at: string;
};
type CaptacionRow = {
  id: string;
  contacto_id: string;
  property_id: string | null;
  ubicacion: string | null;
  precio_esperado: number | null;
  comision_pct: number | string;
  comision_valor: number | null;
  estatus_pago: Captacion["estatusPago"];
  aprobada: boolean;
  multimedia: Captacion["multimedia"];
  estado: Captacion["estado"];
  notas: string | null;
  created_at: string;
};
type BusquedaRow = {
  id: string;
  contacto_id: string;
  tipo: Busqueda["tipo"];
  ubicacion: string | null;
  precio_max: number | null;
  especificacion: string | null;
  potencial: boolean;
  estado: Busqueda["estado"];
  notas: string | null;
  created_at: string;
};
type PropuestaRow = { busqueda_id: string; property_id: string; estado: EstadoPropuesta; created_at: string };
type ActividadRow = { id: string; contacto_id: string; property_id: string | null; tipo: Actividad["tipo"]; detalle: string; ocurrio_en: string };

const aContacto = (r: ContactoRow): Contacto => ({
  id: r.id,
  nombre: r.nombre,
  ...(r.telefono ? { telefono: r.telefono } : {}),
  ...(r.telefono_e164 ? { telefonoE164: r.telefono_e164 } : {}),
  ...(r.email ? { email: r.email } : {}),
  ...(r.ciudad ? { ciudad: r.ciudad } : {}),
  ...(r.notas ? { notas: r.notas } : {}),
  origen: r.origen,
  archivado: r.archivado,
  creadoEn: r.created_at,
  ...(r.proximo_contacto_at ? { proximoContactoAt: new Date(r.proximo_contacto_at).toISOString() } : {}),
  ...(r.proximo_contacto_nota ? { proximoContactoNota: r.proximo_contacto_nota } : {}),
});

const numero = (v: number | string | null) => (v === null ? undefined : Number(v));
const aCierre = (r: CierreRow): Cierre => {
  const pct = numero(r.comision_pct);
  const pactada = numero(r.comision_pactada);
  const cobrada = numero(r.comision_cobrada);
  return {
    id: r.id,
    ...(r.captacion_id ? { captacionId: r.captacion_id } : {}),
    ...(r.busqueda_id ? { busquedaId: r.busqueda_id } : {}),
    ...(r.property_id ? { propertyId: r.property_id } : {}),
    ...(r.vendedor_contacto_id ? { vendedorContactoId: r.vendedor_contacto_id } : {}),
    ...(r.comprador_contacto_id ? { compradorContactoId: r.comprador_contacto_id } : {}),
    precioVenta: Number(r.precio_venta),
    fechaCierre: r.fecha_cierre.slice(0, 10),
    ...(pct !== undefined ? { comisionPct: pct } : {}),
    ...(pactada !== undefined ? { comisionPactada: pactada } : {}),
    ...(cobrada !== undefined ? { comisionCobrada: cobrada } : {}),
    ...(r.cobrada_at ? { cobradaAt: r.cobrada_at.slice(0, 10) } : {}),
    ...(r.notas ? { notas: r.notas } : {}),
    creadoEn: r.created_at,
  };
};

const aCaptacion = (r: CaptacionRow): Captacion => ({
  id: r.id,
  contactoId: r.contacto_id,
  ...(r.property_id ? { propertyId: r.property_id } : {}),
  ...(r.ubicacion ? { ubicacion: r.ubicacion } : {}),
  ...(r.precio_esperado !== null ? { precioEsperado: Number(r.precio_esperado) } : {}),
  comisionPct: Number(r.comision_pct),
  ...(r.comision_valor !== null ? { comisionValor: Number(r.comision_valor) } : {}),
  estatusPago: r.estatus_pago,
  aprobada: r.aprobada,
  multimedia: r.multimedia,
  estado: r.estado,
  ...(r.notas ? { notas: r.notas } : {}),
  creadoEn: r.created_at,
});

const aBusqueda = (r: BusquedaRow): Busqueda => ({
  id: r.id,
  contactoId: r.contacto_id,
  tipo: r.tipo,
  ...(r.ubicacion ? { ubicacion: r.ubicacion } : {}),
  ...(r.precio_max !== null ? { precioMax: Number(r.precio_max) } : {}),
  ...(r.especificacion ? { especificacion: r.especificacion } : {}),
  potencial: r.potencial,
  estado: r.estado,
  ...(r.notas ? { notas: r.notas } : {}),
  creadoEn: r.created_at,
});

const aPropuesta = (r: PropuestaRow): Propuesta => ({ busquedaId: r.busqueda_id, propertyId: r.property_id, estado: r.estado, creadoEn: r.created_at });
const aActividad = (r: ActividadRow): Actividad => ({
  id: r.id,
  contactoId: r.contacto_id,
  ...(r.property_id ? { propertyId: r.property_id } : {}),
  tipo: r.tipo,
  detalle: r.detalle,
  ocurrioEn: r.ocurrio_en,
});

type ErrorDb = { message: string; code?: string };

/** Tabla o columna que no existe todavía. 42P01 tabla, 42703 columna, PGRST204/205 caché de esquema de PostgREST. */
function faltaEsquema(error: ErrorDb | null): boolean {
  return Boolean(error && (["42P01", "42703", "PGRST204", "PGRST205"].includes(error.code ?? "") || /schema cache|does not exist/i.test(error.message)));
}

/** Lo que agrega 0010 (columnas de próximo contacto y tabla cierres). */
function esDe0010(error: ErrorDb | null): boolean {
  return Boolean(error && faltaEsquema(error) && /proximo_contacto|cierres/i.test(error.message));
}

/** Lo que agrega 0013 (vista contactos_resumen, llaves lead_id / servicio_id / cita_id y suprimido_at). */
function esDe0013(error: ErrorDb | null): boolean {
  return Boolean(error && faltaEsquema(error) && /contactos_resumen|lead_id|servicio_id|cita_id|suprimido_at/i.test(error.message));
}

/** Choque con un índice único concreto (23505). */
const choca = (error: ErrorDb | null, indice: string) => Boolean(error && error.code === "23505" && error.message.includes(indice));

function falla(op: string, error: ErrorDb | null): never {
  const msg = error?.message ?? "error desconocido";
  if (faltaEsquema(error)) {
    const migracion = esDe0013(error) ? "0013" : esDe0010(error) ? "0010" : "0007";
    throw new CrmNoDisponibleError(`[crm] ${op}: falta aplicar la migración ${migracion} (${msg})`, migracion);
  }
  throw new CrmStoreError(`[crm] ${op}: ${msg}`);
}

const COLS_CONTACTO = "id, nombre, telefono, telefono_e164, email, ciudad, notas, origen, archivado, created_at";
/** Con las columnas de 0010. Mientras la migración no esté aplicada se lee sin ellas (ver `leerContactos`). */
const COLS_CONTACTO_0010 = `${COLS_CONTACTO}, proximo_contacto_at, proximo_contacto_nota`;
const COLS_CIERRE =
  "id, captacion_id, busqueda_id, property_id, vendedor_contacto_id, comprador_contacto_id, precio_venta, fecha_cierre, comision_pct, comision_pactada, comision_cobrada, cobrada_at, notas, created_at";
const UUID_DB = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;

function filaDeCierre(i: CierreInput): Record<string, unknown> {
  return {
    captacion_id: i.captacionId ?? null,
    busqueda_id: i.busquedaId ?? null,
    property_id: i.propertyId ?? null,
    vendedor_contacto_id: i.vendedorContactoId ?? null,
    comprador_contacto_id: i.compradorContactoId ?? null,
    precio_venta: i.precioVenta,
    fecha_cierre: i.fechaCierre,
    comision_pct: i.comisionPct ?? null,
    comision_pactada: i.comisionPactada ?? null,
    notas: i.notas ?? null,
  };
}
const COLS_CAPTACION =
  "id, contacto_id, property_id, ubicacion, precio_esperado, comision_pct, comision_valor, estatus_pago, aprobada, multimedia, estado, notas, created_at";
const COLS_BUSQUEDA = "id, contacto_id, tipo, ubicacion, precio_max, especificacion, potencial, estado, notas, created_at";
const COLS_ACTIVIDAD = "id, contacto_id, property_id, tipo, detalle, ocurrio_en";
/** Vista contactos_resumen (0013): el contacto con sus conteos. */
const COLS_RESUMEN = `${COLS_CONTACTO_0010}, captaciones, busquedas, ultima_actividad`;
/** La persona embebida en una consulta (llave foránea contacto_id). `!inner` deja fuera las filas cuyo contacto no pasa el filtro. */
const PERSONA = "contactos!inner(id, nombre, telefono, email, archivado)";
const COL_LLAVE: Record<LlaveActividad["tipo"], string> = { lead: "lead_id", servicio: "servicio_id", cita: "cita_id" };

type BreveRow = { id: string; nombre: string; telefono: string | null; email: string | null; archivado: boolean };
const aBreve = (r: BreveRow): ContactoBreve => breve({ id: r.id, nombre: r.nombre, archivado: r.archivado, ...(r.telefono ? { telefono: r.telefono } : {}), ...(r.email ? { email: r.email } : {}) });
/** PostgREST devuelve la relación embebida como objeto (muchos a uno); algunos clientes la tipan como lista. */
const una = <T,>(v: T | T[] | null | undefined): T | undefined => (Array.isArray(v) ? v[0] : (v ?? undefined));
/** Contacto embebido (PostgREST lo entrega como objeto o lista). */
type ConPersona = { contactos: BreveRow | BreveRow[] | null };

function grupo(total: number | null, filas: ConPersona[] | null): GrupoPendiente {
  return { total: total ?? 0, items: (filas ?? []).map((f) => una(f.contactos)).filter((c): c is BreveRow => Boolean(c)).map(aBreve) };
}

/** Texto de búsqueda seguro para el filtro `or` de PostgREST (sin comas ni paréntesis que lo rompan). */
const patron = (q: string) => `%${q.replace(/[%,()*\\]/g, " ").trim()}%`;

function filaDeCaptacion(i: Partial<CaptacionInput>): Record<string, unknown> {
  const f: Record<string, unknown> = {};
  if (i.contactoId !== undefined) f.contacto_id = i.contactoId;
  if ("propertyId" in i) f.property_id = i.propertyId ?? null;
  if ("ubicacion" in i) f.ubicacion = i.ubicacion ?? null;
  if ("precioEsperado" in i) f.precio_esperado = i.precioEsperado ?? null;
  if (i.comisionPct !== undefined) f.comision_pct = i.comisionPct;
  if (i.estatusPago !== undefined) f.estatus_pago = i.estatusPago;
  if (i.aprobada !== undefined) f.aprobada = i.aprobada;
  if (i.multimedia !== undefined) f.multimedia = i.multimedia;
  if (i.estado !== undefined) f.estado = i.estado;
  if ("notas" in i) f.notas = i.notas ?? null;
  return f;
}

function filaDeBusqueda(i: Partial<BusquedaInput>): Record<string, unknown> {
  const f: Record<string, unknown> = {};
  if (i.contactoId !== undefined) f.contacto_id = i.contactoId;
  if (i.tipo !== undefined) f.tipo = i.tipo;
  if ("ubicacion" in i) f.ubicacion = i.ubicacion ?? null;
  if ("precioMax" in i) f.precio_max = i.precioMax ?? null;
  if ("especificacion" in i) f.especificacion = i.especificacion ?? null;
  if (i.potencial !== undefined) f.potencial = i.potencial;
  if (i.estado !== undefined) f.estado = i.estado;
  if ("notas" in i) f.notas = i.notas ?? null;
  return f;
}

function filaDeContacto(i: Partial<ContactoInput>): Record<string, unknown> {
  const f: Record<string, unknown> = {};
  if (i.nombre !== undefined) f.nombre = i.nombre;
  if ("telefono" in i) f.telefono = i.telefono ?? null;
  if ("telefonoE164" in i) f.telefono_e164 = i.telefonoE164 ?? null;
  if ("email" in i) f.email = i.email ?? null;
  if ("ciudad" in i) f.ciudad = i.ciudad ?? null;
  if ("notas" in i) f.notas = i.notas ?? null;
  if (i.origen !== undefined) f.origen = i.origen;
  return f;
}

class SupabaseCrmStore implements CrmStore {
  private db() {
    return getSupabaseAdmin();
  }

  /** false cuando la base aún no tiene las columnas de 0010: se deja de pedirlas hasta el próximo arranque. */
  private con0010 = true;

  /**
   * Lee contactos pidiendo las columnas de 0010 y, si la migración no está aplicada, repite sin ellas:
   * así el CRM sigue funcionando entre el despliegue y el momento en que se corre la migración.
   * PostgREST valida las columnas antes de ejecutar, así que el primer intento no deja nada a medias.
   */
  private async leerContactos(op: string, consulta: (cols: string) => PromiseLike<{ data: unknown; error: ErrorDb | null }>): Promise<unknown> {
    if (this.con0010) {
      const r = await consulta(COLS_CONTACTO_0010);
      if (!r.error) return r.data;
      if (!esDe0010(r.error)) falla(op, r.error);
      console.warn("[crm] falta la migración 0010: se lee sin el próximo contacto");
      this.con0010 = false;
    }
    const r = await consulta(COLS_CONTACTO);
    if (r.error) falla(op, r.error);
    return r.data;
  }

  async disponible(): Promise<boolean> {
    try {
      const { error } = await this.db().from("contactos").select("id").limit(1);
      return !error;
    } catch {
      return false;
    }
  }

  async listarContactos(opts: { q?: string; incluirArchivados?: boolean } = {}): Promise<ContactoResumen[]> {
    const q = opts.q?.trim();
    const data = await this.leerContactos("listarContactos", (cols) => {
      let consulta = this.db().from("contactos").select(cols).order("created_at", { ascending: false }).limit(1000);
      if (!opts.incluirArchivados) consulta = consulta.eq("archivado", false);
      if (q) {
        const p = patron(q);
        consulta = consulta.or(`nombre.ilike.${p},telefono.ilike.${p},email.ilike.${p},ciudad.ilike.${p}`);
      }
      return consulta;
    });
    const contactos = ((data ?? []) as ContactoRow[]).map(aContacto);
    if (!contactos.length) return [];

    const ids = contactos.map((c) => c.id);
    const [caps, buscs, acts] = await Promise.all([
      this.db().from("captaciones").select("contacto_id").in("contacto_id", ids).neq("estado", "descartada"),
      this.db().from("busquedas").select("contacto_id").in("contacto_id", ids).neq("estado", "descartada"),
      this.db().from("actividades").select("contacto_id, ocurrio_en").in("contacto_id", ids).order("ocurrio_en", { ascending: false }).limit(5000),
    ]);
    if (caps.error) falla("listarContactos/captaciones", caps.error);
    if (buscs.error) falla("listarContactos/busquedas", buscs.error);
    if (acts.error) falla("listarContactos/actividades", acts.error);
    const cuenta = (filas: { contacto_id: string }[] | null) => {
      const m = new Map<string, number>();
      for (const f of filas ?? []) m.set(f.contacto_id, (m.get(f.contacto_id) ?? 0) + 1);
      return m;
    };
    const nCap = cuenta(caps.data);
    const nBus = cuenta(buscs.data);
    const ultima = new Map<string, string>();
    for (const a of (acts.data ?? []) as { contacto_id: string; ocurrio_en: string }[]) if (!ultima.has(a.contacto_id)) ultima.set(a.contacto_id, a.ocurrio_en);
    return contactos.map((c) => ({ ...c, captaciones: nCap.get(c.id) ?? 0, busquedas: nBus.get(c.id) ?? 0, ...(ultima.has(c.id) ? { ultimaActividad: ultima.get(c.id) } : {}) }));
  }

  /** false cuando la base no tiene lo de 0013: se usa el método anterior hasta el próximo arranque. */
  private con0013 = true;

  private sin0013(op: string) {
    if (this.con0013) console.warn(`[crm] falta la migración 0013 (${op}): se usa el método anterior`);
    this.con0013 = false;
  }

  async paginaContactos(filtro: FiltroContactos = {}): Promise<Pagina<ContactoResumen>> {
    const { pagina, porPagina, desde } = paginaYTamano(filtro);
    if (this.con0013) {
      const q = filtro.q?.trim();
      const consulta = (cols: string, head = false) => {
        let c = this.db().from("contactos_resumen").select(cols, { count: "exact", head });
        if (!filtro.incluirArchivados) c = c.eq("archivado", false);
        if (q) {
          const p = patron(q);
          c = c.or(`nombre.ilike.${p},telefono.ilike.${p},email.ilike.${p},ciudad.ilike.${p}`);
        }
        if (filtro.tipo === "vendedor") c = c.gt("captaciones", 0);
        if (filtro.tipo === "comprador") c = c.gt("busquedas", 0);
        if (filtro.origen) c = c.eq("origen", filtro.origen);
        if (filtro.sinProximo) c = c.is("proximo_contacto_at", null);
        return c;
      };
      const r = await consulta(COLS_RESUMEN).order("created_at", { ascending: false }).order("id").range(desde, desde + porPagina - 1);
      if (!r.error) {
        const filas = ((r.data ?? []) as unknown as (ContactoRow & { captaciones: number; busquedas: number; ultima_actividad: string | null })[]).map((f) => ({
          ...aContacto(f),
          captaciones: Number(f.captaciones ?? 0),
          busquedas: Number(f.busquedas ?? 0),
          ...(f.ultima_actividad ? { ultimaActividad: f.ultima_actividad } : {}),
        }));
        return { filas, total: r.count ?? filas.length, pagina, porPagina };
      }
      // Página más allá del final (PGRST103): se devuelve vacía con el total real.
      if (r.error.code === "PGRST103") {
        const t = await consulta("id", true);
        return { filas: [], total: t.count ?? 0, pagina, porPagina };
      }
      if (!esDe0013(r.error)) falla("paginaContactos", r.error);
      this.sin0013("paginaContactos");
    }
    const filtrados = filtrarContactos(await this.listarContactos({ q: filtro.q, incluirArchivados: filtro.incluirArchivados }), filtro);
    return { filas: filtrados.slice(desde, desde + porPagina), total: filtrados.length, pagina, porPagina };
  }

  async contactosPorId(ids: string[]): Promise<ContactoBreve[]> {
    const unicos = [...new Set(ids.filter((id) => UUID_DB.test(id)))];
    const out: ContactoBreve[] = [];
    // Trozos de 100: la lista va en la URL de PostgREST.
    for (let i = 0; i < unicos.length; i += 100) {
      const { data, error } = await this.db().from("contactos").select("id, nombre, telefono, email, archivado").in("id", unicos.slice(i, i + 100));
      if (error) falla("contactosPorId", error);
      out.push(...((data ?? []) as BreveRow[]).map(aBreve));
    }
    return out;
  }

  async pendientes(muestra = 3): Promise<PendientesCrm> {
    const db = this.db();
    // Captaciones vigentes (ni descartadas ni vendidas) de contactos no archivados.
    const vigentes = (head = false) =>
      db
        .from("captaciones")
        .select(`contacto_id, ${PERSONA}`, { count: "exact", head })
        .eq("contactos.archivado", false)
        .not("estado", "in", "(descartada,vendida)")
        .order("created_at", { ascending: false })
        .limit(muestra);
    const activas = (head = false) =>
      db
        .from("busquedas")
        .select(`contacto_id, ${PERSONA}${head ? "" : ", busqueda_inmuebles(busqueda_id)"}`, { count: "exact", head })
        .eq("contactos.archivado", false)
        .in("estado", ["activa", "en_visitas"])
        .order("created_at", { ascending: false })
        .limit(muestra);
    const [porAprobar, pagoPendiente, multimedia, sinPropuestas, sinSeguimiento, nContactos, nVendedores, nCompradores] = await Promise.all([
      vigentes().eq("aprobada", false),
      vigentes().eq("estatus_pago", "pendiente"),
      vigentes().neq("multimedia", "listo"),
      // Anti-join de PostgREST: solo las búsquedas sin ninguna fila en busqueda_inmuebles.
      activas().is("busqueda_inmuebles", null),
      db.from("contactos").select("id, nombre, telefono, email, archivado, actividades(id)", { count: "exact" }).eq("archivado", false).is("actividades", null).order("created_at", { ascending: false }).limit(muestra),
      db.from("contactos").select("id", { count: "exact", head: true }).eq("archivado", false),
      vigentes(true),
      activas(true),
    ]);
    for (const [op, r] of [
      ["porAprobar", porAprobar],
      ["pagoPendiente", pagoPendiente],
      ["multimedia", multimedia],
      ["sinPropuestas", sinPropuestas],
      ["sinSeguimiento", sinSeguimiento],
      ["contactos", nContactos],
      ["vendedores", nVendedores],
      ["compradores", nCompradores],
    ] as const) {
      if (r.error) falla(`pendientes/${op}`, r.error);
    }
    return {
      porAprobar: grupo(porAprobar.count, porAprobar.data as unknown as ConPersona[]),
      pagoPendiente: grupo(pagoPendiente.count, pagoPendiente.data as unknown as ConPersona[]),
      multimedia: grupo(multimedia.count, multimedia.data as unknown as ConPersona[]),
      sinPropuestas: grupo(sinPropuestas.count, sinPropuestas.data as unknown as ConPersona[]),
      sinSeguimiento: { total: sinSeguimiento.count ?? 0, items: ((sinSeguimiento.data ?? []) as unknown as BreveRow[]).map(aBreve) },
      totales: { contactos: nContactos.count ?? 0, vendedores: nVendedores.count ?? 0, compradores: nCompradores.count ?? 0 },
    };
  }

  async obtenerContacto(id: string): Promise<Contacto | null> {
    const data = await this.leerContactos("obtenerContacto", (cols) => this.db().from("contactos").select(cols).eq("id", id).maybeSingle());
    return data ? aContacto(data as ContactoRow) : null;
  }

  async crearContacto(input: ContactoInput): Promise<{ contacto: Contacto; creado: boolean }> {
    if (input.telefonoE164) {
      const previo = await this.db().from("contactos").select(COLS_CONTACTO).eq("telefono_e164", input.telefonoE164).maybeSingle();
      if (previo.error) falla("crearContacto/buscar", previo.error);
      if (previo.data) return { contacto: aContacto(previo.data as ContactoRow), creado: false };
    }
    const ins = await this.db().from("contactos").insert(filaDeContacto(input)).select(COLS_CONTACTO).single();
    if (ins.error) {
      if (ins.error.code === "23505" && input.telefonoE164) {
        const otra = await this.db().from("contactos").select(COLS_CONTACTO).eq("telefono_e164", input.telefonoE164).single();
        if (otra.error) falla("crearContacto/releer", otra.error);
        return { contacto: aContacto(otra.data as ContactoRow), creado: false };
      }
      falla("crearContacto", ins.error);
    }
    return { contacto: aContacto(ins.data as ContactoRow), creado: true };
  }

  async actualizarContacto(id: string, patch: Partial<ContactoInput>): Promise<Contacto | null> {
    const data = await this.leerContactos("actualizarContacto", (cols) => this.db().from("contactos").update(filaDeContacto(patch)).eq("id", id).select(cols).maybeSingle());
    return data ? aContacto(data as ContactoRow) : null;
  }

  async archivarContacto(id: string, archivado: boolean): Promise<void> {
    const { error } = await this.db().from("contactos").update({ archivado }).eq("id", id);
    if (error) falla("archivarContacto", error);
  }

  async buscarPorEmail(email: string): Promise<Contacto | null> {
    // Comodines de ILIKE escapados: el correo se compara completo (un "_" de juan_villa@… es literal).
    const limpio = email.trim().replace(/[%_\\]/g, "\\$&");
    if (!limpio) return null;
    const data = await this.leerContactos("buscarPorEmail", (cols) => this.db().from("contactos").select(cols).ilike("email", limpio).order("created_at").limit(1));
    const fila = ((data ?? []) as ContactoRow[])[0];
    return fila ? aContacto(fila) : null;
  }

  async listarCaptaciones(contactoId?: string): Promise<Captacion[]> {
    let c = this.db().from("captaciones").select(COLS_CAPTACION).order("created_at", { ascending: false }).limit(1000);
    if (contactoId) c = c.eq("contacto_id", contactoId);
    const { data, error } = await c;
    if (error) falla("listarCaptaciones", error);
    return ((data ?? []) as CaptacionRow[]).map(aCaptacion);
  }

  async captacionVigenteDe(propertyId: string): Promise<Captacion | null> {
    const { data, error } = await this.db()
      .from("captaciones")
      .select(COLS_CAPTACION)
      .eq("property_id", propertyId)
      .neq("estado", "descartada")
      .limit(1);
    if (error) falla("captacionVigenteDe", error);
    const fila = (data ?? [])[0] as CaptacionRow | undefined;
    return fila ? aCaptacion(fila) : null;
  }

  /**
   * Inserta en `tabla` con la llave del lead (0013) y, si ese lead ya tiene su fila (índice único), devuelve
   * esa en vez de duplicarla. Sin la columna, inserta sin llave (como antes de la 0013).
   */
  private async insertarConLead(tabla: "captaciones" | "busquedas", fila: Record<string, unknown>, cols: string, leadId: string | undefined): Promise<unknown> {
    if (leadId && this.con0013 && UUID_DB.test(leadId)) {
      const ins = await this.db().from(tabla).insert({ ...fila, lead_id: leadId }).select(cols).single();
      if (!ins.error) return ins.data;
      if (choca(ins.error, `${tabla}_lead_uk`)) {
        const previa = await this.db().from(tabla).select(cols).eq("lead_id", leadId).single();
        if (previa.error) falla(`${tabla}/releer`, previa.error);
        return previa.data;
      }
      if (!esDe0013(ins.error)) falla(`crear/${tabla}`, ins.error);
      this.sin0013(`crear/${tabla}`);
    }
    const { data, error } = await this.db().from(tabla).insert(fila).select(cols).single();
    if (error) falla(`crear/${tabla}`, error);
    return data;
  }

  async crearCaptacion(input: CaptacionInput, origen: { leadId?: string } = {}): Promise<Captacion> {
    return aCaptacion((await this.insertarConLead("captaciones", filaDeCaptacion(input), COLS_CAPTACION, origen.leadId)) as CaptacionRow);
  }

  async paginaCaptaciones(opts: { pagina?: number; porPagina?: number } = {}): Promise<Pagina<CaptacionConContacto>> {
    const { pagina, porPagina, desde } = paginaYTamano(opts);
    const { data, error, count } = await this.db()
      .from("captaciones")
      .select(`${COLS_CAPTACION}, ${PERSONA}`, { count: "exact" })
      .eq("contactos.archivado", false)
      .order("created_at", { ascending: false })
      .order("id")
      .range(desde, desde + porPagina - 1);
    if (error) {
      if (error.code === "PGRST103") return { filas: [], total: 0, pagina, porPagina };
      falla("paginaCaptaciones", error);
    }
    const filas = ((data ?? []) as unknown as (CaptacionRow & ConPersona)[]).flatMap((r) => {
      const p = una(r.contactos);
      return p ? [{ ...aCaptacion(r), contacto: aBreve(p) }] : [];
    });
    return { filas, total: count ?? filas.length, pagina, porPagina };
  }

  async actualizarCaptacion(id: string, patch: Partial<CaptacionInput>): Promise<Captacion | null> {
    const { data, error } = await this.db().from("captaciones").update(filaDeCaptacion(patch)).eq("id", id).select(COLS_CAPTACION).maybeSingle();
    if (error) falla("actualizarCaptacion", error);
    return data ? aCaptacion(data as CaptacionRow) : null;
  }

  async listarBusquedas(contactoId?: string): Promise<Busqueda[]> {
    let c = this.db().from("busquedas").select(COLS_BUSQUEDA).order("created_at", { ascending: false }).limit(1000);
    if (contactoId) c = c.eq("contacto_id", contactoId);
    const { data, error } = await c;
    if (error) falla("listarBusquedas", error);
    return ((data ?? []) as BusquedaRow[]).map(aBusqueda);
  }

  async crearBusqueda(input: BusquedaInput, origen: { leadId?: string } = {}): Promise<Busqueda> {
    return aBusqueda((await this.insertarConLead("busquedas", filaDeBusqueda(input), COLS_BUSQUEDA, origen.leadId)) as BusquedaRow);
  }

  async paginaBusquedas(opts: { pagina?: number; porPagina?: number } = {}): Promise<Pagina<BusquedaConContacto>> {
    const { pagina, porPagina, desde } = paginaYTamano(opts);
    const { data, error, count } = await this.db()
      .from("busquedas")
      .select(`${COLS_BUSQUEDA}, ${PERSONA}, busqueda_inmuebles(count)`, { count: "exact" })
      .eq("contactos.archivado", false)
      .order("created_at", { ascending: false })
      .order("id")
      .range(desde, desde + porPagina - 1);
    if (error) {
      if (error.code === "PGRST103") return { filas: [], total: 0, pagina, porPagina };
      falla("paginaBusquedas", error);
    }
    const filas = ((data ?? []) as unknown as (BusquedaRow & ConPersona & { busqueda_inmuebles: { count: number }[] | null })[]).flatMap((r) => {
      const p = una(r.contactos);
      return p ? [{ ...aBusqueda(r), contacto: aBreve(p), propuestas: Number(r.busqueda_inmuebles?.[0]?.count ?? 0) }] : [];
    });
    return { filas, total: count ?? filas.length, pagina, porPagina };
  }

  async actualizarBusqueda(id: string, patch: Partial<BusquedaInput>): Promise<Busqueda | null> {
    const { data, error } = await this.db().from("busquedas").update(filaDeBusqueda(patch)).eq("id", id).select(COLS_BUSQUEDA).maybeSingle();
    if (error) falla("actualizarBusqueda", error);
    return data ? aBusqueda(data as BusquedaRow) : null;
  }

  async listarPropuestas(busquedaIds?: string[]): Promise<Propuesta[]> {
    let c = this.db().from("busqueda_inmuebles").select("busqueda_id, property_id, estado, created_at").limit(5000);
    if (busquedaIds) {
      if (!busquedaIds.length) return [];
      c = c.in("busqueda_id", busquedaIds);
    }
    const { data, error } = await c;
    if (error) falla("listarPropuestas", error);
    return ((data ?? []) as PropuestaRow[]).map(aPropuesta);
  }

  async propuestasDeInmuebles(propertyIds: string[]): Promise<PropuestaDeInmueble[]> {
    const ids = [...new Set(propertyIds)].filter(Boolean);
    if (!ids.length) return [];
    const { data, error } = await this.db()
      .from("busqueda_inmuebles")
      .select(`busqueda_id, property_id, estado, created_at, busquedas!inner(estado, ${PERSONA})`)
      .in("property_id", ids)
      .order("created_at", { ascending: false })
      .limit(1000);
    if (error) falla("propuestasDeInmuebles", error);
    type Fila = PropuestaRow & { busquedas: { estado: EstadoBusqueda; contactos: BreveRow | BreveRow[] | null } | { estado: EstadoBusqueda; contactos: BreveRow | BreveRow[] | null }[] | null };
    return ((data ?? []) as unknown as Fila[]).flatMap((r) => {
      const b = una(r.busquedas);
      const p = b ? una(b.contactos) : undefined;
      return b && p ? [{ ...aPropuesta(r), contacto: aBreve(p), estadoBusqueda: b.estado }] : [];
    });
  }

  async proponer(busquedaId: string, propertyId: string): Promise<Propuesta> {
    const { error } = await this.db().from("busqueda_inmuebles").upsert({ busqueda_id: busquedaId, property_id: propertyId }, { onConflict: "busqueda_id,property_id", ignoreDuplicates: true });
    if (error) falla("proponer", error);
    const { data, error: e2 } = await this.db().from("busqueda_inmuebles").select("busqueda_id, property_id, estado, created_at").eq("busqueda_id", busquedaId).eq("property_id", propertyId).single();
    if (e2) falla("proponer/releer", e2);
    return aPropuesta(data as PropuestaRow);
  }

  async cambiarEstadoPropuesta(busquedaId: string, propertyId: string, estado: EstadoPropuesta): Promise<void> {
    const { error } = await this.db().from("busqueda_inmuebles").update({ estado }).eq("busqueda_id", busquedaId).eq("property_id", propertyId);
    if (error) falla("cambiarEstadoPropuesta", error);
  }

  async quitarPropuesta(busquedaId: string, propertyId: string): Promise<void> {
    const { error } = await this.db().from("busqueda_inmuebles").delete().eq("busqueda_id", busquedaId).eq("property_id", propertyId);
    if (error) falla("quitarPropuesta", error);
  }

  async listarActividades(contactoId: string): Promise<Actividad[]> {
    const { data, error } = await this.db().from("actividades").select("id, contacto_id, property_id, tipo, detalle, ocurrio_en").eq("contacto_id", contactoId).order("ocurrio_en", { ascending: false }).limit(500);
    if (error) falla("listarActividades", error);
    return ((data ?? []) as ActividadRow[]).map(aActividad);
  }

  async registrarActividad(input: ActividadInput): Promise<Actividad> {
    const fila = {
      contacto_id: input.contactoId,
      property_id: input.propertyId ?? null,
      tipo: input.tipo,
      detalle: input.detalle,
      ...(input.ocurrioEn ? { ocurrio_en: input.ocurrioEn } : {}),
    };
    const { data, error } = await this.db().from("actividades").insert(fila).select(COLS_ACTIVIDAD).single();
    if (error) falla("registrarActividad", error);
    return aActividad(data as ActividadRow);
  }

  /** La actividad con esa llave (0013), o `undefined` si la base no tiene la columna. */
  private async porLlave(llave: LlaveActividad): Promise<Actividad | null | undefined> {
    if (!this.con0013 || !UUID_DB.test(llave.id)) return undefined;
    const { data, error } = await this.db().from("actividades").select(COLS_ACTIVIDAD).eq(COL_LLAVE[llave.tipo], llave.id).limit(1);
    if (error) {
      if (!esDe0013(error)) falla("porLlave", error);
      this.sin0013("porLlave");
      return undefined;
    }
    const fila = (data ?? [])[0] as ActividadRow | undefined;
    return fila ? aActividad(fila) : null;
  }

  async existeActividad(llave: LlaveActividad, contactoId: string): Promise<boolean> {
    const previa = await this.porLlave(llave);
    if (previa !== undefined) return previa !== null;
    const marca = marcaDe(llave);
    return (await this.listarActividades(contactoId)).some((a) => a.detalle.includes(marca));
  }

  async registrarActividadUnica(input: ActividadInput, llave: LlaveActividad): Promise<{ actividad: Actividad; nueva: boolean }> {
    const previa = await this.porLlave(llave);
    if (previa) return { actividad: previa, nueva: false };
    if (previa === null) {
      const col = COL_LLAVE[llave.tipo];
      const fila = {
        contacto_id: input.contactoId,
        property_id: input.propertyId ?? null,
        tipo: input.tipo,
        detalle: input.detalle,
        [col]: llave.id,
        ...(input.ocurrioEn ? { ocurrio_en: input.ocurrioEn } : {}),
      };
      const ins = await this.db().from("actividades").insert(fila).select(COLS_ACTIVIDAD).single();
      if (!ins.error) return { actividad: aActividad(ins.data as ActividadRow), nueva: true };
      // Dos envíos a la vez: el otro ganó el índice único.
      if (choca(ins.error, `actividades_${col.replace("_id", "")}_uk`)) {
        const otra = await this.porLlave(llave);
        if (otra) return { actividad: otra, nueva: false };
      }
      falla("registrarActividadUnica", ins.error);
    }
    // Sin la 0013: la marca en el texto.
    const marca = marcaDe(llave);
    const ya = (await this.listarActividades(input.contactoId)).find((a) => a.detalle.includes(marca));
    if (ya) return { actividad: ya, nueva: false };
    return { actividad: await this.registrarActividad(input), nueva: true };
  }

  async enlazarLead(leadId: string, contactoId: string): Promise<void> {
    const { error } = await this.db().from("leads").update({ contacto_id: contactoId }).eq("id", leadId);
    // Sin la columna (migración 0008 sin aplicar) el lead entra al CRM igual, solo sin la llave.
    if (error && !/contacto_id|schema cache|does not exist/i.test(error.message)) falla("enlazarLead", error);
  }

  async leadsDeContacto(contactoId: string): Promise<string[]> {
    const { data, error } = await this.db().from("leads").select("id").eq("contacto_id", contactoId).limit(500);
    if (error) return [];
    return ((data ?? []) as { id: string }[]).map((l) => l.id);
  }

  async fijarProximoContacto(contactoId: string, at: string | null, nota?: string): Promise<void> {
    const { data, error } = await this.db()
      .from("contactos")
      .update({ proximo_contacto_at: at, proximo_contacto_nota: at ? (nota?.trim() || null) : null })
      .eq("id", contactoId)
      .select("id");
    if (error) falla("fijarProximoContacto", error);
    if (!(data ?? []).length) throw new CrmStoreError("llave foránea: el contacto no existe");
  }

  async listarSeguimientos(hasta: string): Promise<Contacto[]> {
    const { data, error } = await this.db()
      .from("contactos")
      .select(COLS_CONTACTO_0010)
      .eq("archivado", false)
      .not("proximo_contacto_at", "is", null)
      .lte("proximo_contacto_at", hasta)
      .order("proximo_contacto_at", { ascending: true })
      .limit(500);
    if (error) {
      if (esDe0010(error)) return []; // sin la migración no hay fechas que mostrar
      falla("listarSeguimientos", error);
    }
    return ((data ?? []) as ContactoRow[]).map(aContacto);
  }

  async registrarCierre(input: CierreInput): Promise<Cierre> {
    const { data, error } = await this.db().from("cierres").insert(filaDeCierre(input)).select(COLS_CIERRE).single();
    if (error) falla("registrarCierre", error);
    return aCierre(data as CierreRow);
  }

  async listarCierres(filtro: { contactoId?: string; propertyId?: string } = {}): Promise<Cierre[]> {
    let c = this.db().from("cierres").select(COLS_CIERRE).order("fecha_cierre", { ascending: false }).order("created_at", { ascending: false }).limit(1000);
    if (filtro.contactoId) {
      // Va dentro del filtro `or` de PostgREST: solo se acepta un uuid.
      if (!UUID_DB.test(filtro.contactoId)) return [];
      c = c.or(`vendedor_contacto_id.eq.${filtro.contactoId},comprador_contacto_id.eq.${filtro.contactoId}`);
    }
    if (filtro.propertyId) c = c.eq("property_id", filtro.propertyId);
    const { data, error } = await c;
    if (error) {
      if (esDe0010(error)) return [];
      falla("listarCierres", error);
    }
    return ((data ?? []) as CierreRow[]).map(aCierre);
  }

  async marcarComisionCobrada(id: string, monto: number, fecha: string): Promise<Cierre | null> {
    const { data, error } = await this.db().from("cierres").update({ comision_cobrada: monto, cobrada_at: fecha }).eq("id", id).select(COLS_CIERRE).maybeSingle();
    if (error) falla("marcarComisionCobrada", error);
    return data ? aCierre(data as CierreRow) : null;
  }

  async datosEmbudo(desde: string, hasta: string): Promise<DatosEmbudo> {
    const [caps, buscs] = await Promise.all([
      this.db().from("captaciones").select("estado").gte("created_at", desde).lt("created_at", hasta).neq("estado", "descartada").limit(5000),
      this.db().from("busquedas").select("estado, busqueda_inmuebles(estado)").gte("created_at", desde).lt("created_at", hasta).neq("estado", "descartada").limit(5000),
    ]);
    if (caps.error) falla("datosEmbudo/captaciones", caps.error);
    if (buscs.error) falla("datosEmbudo/busquedas", buscs.error);
    return {
      captaciones: ((caps.data ?? []) as { estado: Captacion["estado"] }[]).map((c) => ({ estado: c.estado })),
      busquedas: ((buscs.data ?? []) as unknown as { estado: EstadoBusqueda; busqueda_inmuebles: { estado: EstadoPropuesta }[] | null }[]).map((b) => ({
        estado: b.estado,
        propuestas: (b.busqueda_inmuebles ?? []).map((p) => p.estado),
      })),
    };
  }

  async suprimirContacto(contactoId: string, at: string): Promise<ResumenSupresion> {
    // Va dentro del filtro `or` de PostgREST: solo se acepta un uuid.
    if (!UUID_DB.test(contactoId)) throw new CrmStoreError("llave foránea: el contacto no existe");
    const db = this.db();
    const base = { nombre: NOMBRE_SUPRIMIDO, telefono: null, telefono_e164: null, email: null, ciudad: null, notas: null, archivado: true };
    // Con todo lo de 0010 y 0013; si falta alguna columna se repite sin ella (la supresión no espera a una migración).
    const intentos: Record<string, unknown>[] = [
      { ...base, proximo_contacto_at: null, proximo_contacto_nota: null, suprimido_at: at },
      { ...base, proximo_contacto_at: null, proximo_contacto_nota: null },
      base,
    ];
    let hecho = false;
    for (const patch of intentos) {
      const { data, error } = await db.from("contactos").update(patch).eq("id", contactoId).select("id");
      if (!error) {
        if (!(data ?? []).length) throw new CrmStoreError("llave foránea: el contacto no existe");
        hecho = true;
        break;
      }
      if (!faltaEsquema(error)) falla("suprimirContacto", error);
    }
    if (!hecho) throw new CrmStoreError("[crm] suprimirContacto: no se pudo anonimizar el contacto");

    const acts = await db.from("actividades").update({ detalle: TEXTO_SUPRIMIDO }).eq("contacto_id", contactoId).select("id");
    if (acts.error) falla("suprimirContacto/actividades", acts.error);
    const caps = await db.from("captaciones").update({ notas: null }).eq("contacto_id", contactoId);
    if (caps.error) falla("suprimirContacto/captaciones", caps.error);
    const buscs = await db.from("busquedas").update({ notas: null, especificacion: null }).eq("contacto_id", contactoId);
    if (buscs.error) falla("suprimirContacto/busquedas", buscs.error);
    // Las ventas conservan precio y comisiones; solo se borran las notas. Sin la 0010 no hay ventas.
    const cierres = await db.from("cierres").update({ notas: null }).or(`vendedor_contacto_id.eq.${contactoId},comprador_contacto_id.eq.${contactoId}`);
    if (cierres.error && !esDe0010(cierres.error)) falla("suprimirContacto/cierres", cierres.error);
    return { actividades: (acts.data ?? []).length };
  }
}

// ---------------------------------------------------------------- Memoria

/** Misma semántica en memoria: pruebas y desarrollo sin Supabase. */
export class MemoryCrmStore implements CrmStore {
  contactos: Contacto[] = [];
  captaciones: Captacion[] = [];
  busquedas: Busqueda[] = [];
  propuestas: Propuesta[] = [];
  actividades: Actividad[] = [];
  leadsEnlazados = new Map<string, string>();
  private seq = 1;
  now = () => Date.now();
  /** Inmuebles que existen (para simular la llave foránea). Si es null no se valida. */
  propiedadesValidas: Set<string> | null = null;

  private id(): string {
    return `00000000-0000-4000-8000-${String(this.seq++).padStart(12, "0")}`;
  }
  private ahora(): string {
    return new Date(this.now()).toISOString();
  }
  private exigirContacto(id: string) {
    if (!this.contactos.some((c) => c.id === id)) throw new CrmStoreError("llave foránea: el contacto no existe");
  }
  private exigirInmueble(id: string | undefined) {
    if (id && this.propiedadesValidas && !this.propiedadesValidas.has(id)) throw new CrmStoreError("llave foránea: el inmueble no existe");
  }

  async disponible(): Promise<boolean> {
    return true;
  }

  async listarContactos(opts: { q?: string; incluirArchivados?: boolean } = {}): Promise<ContactoResumen[]> {
    const q = opts.q?.trim().toLowerCase();
    return this.contactos
      .filter((c) => (opts.incluirArchivados ? true : !c.archivado))
      .filter((c) => !q || [c.nombre, c.telefono, c.email, c.ciudad].some((v) => v?.toLowerCase().includes(q)))
      .map((c) => {
        const acts = this.actividades.filter((a) => a.contactoId === c.id).map((a) => a.ocurrioEn).sort().reverse();
        return {
          ...c,
          captaciones: this.captaciones.filter((x) => x.contactoId === c.id && x.estado !== "descartada").length,
          busquedas: this.busquedas.filter((x) => x.contactoId === c.id && x.estado !== "descartada").length,
          ...(acts[0] ? { ultimaActividad: acts[0] } : {}),
        };
      })
      .sort((a, b) => b.creadoEn.localeCompare(a.creadoEn));
  }

  /** true simula una base sin la migración 0013 (sin llaves por lead, plan o cita: se usan las marcas de texto). */
  sin0013 = false;
  /** Llaves de 0013: lead → captación / búsqueda y `tipo:id` → actividad. */
  private leadCaptacion = new Map<string, string>();
  private leadBusqueda = new Map<string, string>();
  private llaves = new Map<string, string>();

  private activo(contactoId: string): Contacto | undefined {
    const c = this.contactos.find((x) => x.id === contactoId);
    return c && !c.archivado ? c : undefined;
  }
  /** Más nuevo primero; a igual fecha, el último creado primero (los ids son secuenciales). */
  private static recientes<T extends { creadoEn: string; id?: string }>(a: T, b: T): number {
    return b.creadoEn.localeCompare(a.creadoEn) || (b.id ?? "").localeCompare(a.id ?? "");
  }

  async paginaContactos(filtro: FiltroContactos = {}): Promise<Pagina<ContactoResumen>> {
    const { pagina, porPagina, desde } = paginaYTamano(filtro);
    const filtrados = filtrarContactos(await this.listarContactos({ q: filtro.q, incluirArchivados: filtro.incluirArchivados }), filtro);
    return { filas: filtrados.slice(desde, desde + porPagina), total: filtrados.length, pagina, porPagina };
  }

  async contactosPorId(ids: string[]): Promise<ContactoBreve[]> {
    const set = new Set(ids);
    return this.contactos.filter((c) => set.has(c.id)).map(breve);
  }

  async pendientes(muestra = 3): Promise<PendientesCrm> {
    const g = (items: ContactoBreve[]): GrupoPendiente => ({ total: items.length, items: items.slice(0, muestra) });
    const vigentes = this.captaciones
      .filter((c) => c.estado !== "descartada" && c.estado !== "vendida" && this.activo(c.contactoId))
      .sort(MemoryCrmStore.recientes);
    const activas = this.busquedas.filter((b) => (b.estado === "activa" || b.estado === "en_visitas") && this.activo(b.contactoId)).sort(MemoryCrmStore.recientes);
    const persona = (id: string) => breve(this.activo(id)!);
    const contactosActivos = this.contactos.filter((c) => !c.archivado).sort(MemoryCrmStore.recientes);
    return {
      porAprobar: g(vigentes.filter((c) => !c.aprobada).map((c) => persona(c.contactoId))),
      pagoPendiente: g(vigentes.filter((c) => c.estatusPago === "pendiente").map((c) => persona(c.contactoId))),
      multimedia: g(vigentes.filter((c) => c.multimedia !== "listo").map((c) => persona(c.contactoId))),
      sinPropuestas: g(activas.filter((b) => !this.propuestas.some((p) => p.busquedaId === b.id)).map((b) => persona(b.contactoId))),
      sinSeguimiento: g(contactosActivos.filter((c) => !this.actividades.some((a) => a.contactoId === c.id)).map(breve)),
      totales: { contactos: contactosActivos.length, vendedores: vigentes.length, compradores: activas.length },
    };
  }

  async obtenerContacto(id: string): Promise<Contacto | null> {
    return this.contactos.find((c) => c.id === id) ?? null;
  }

  async crearContacto(input: ContactoInput): Promise<{ contacto: Contacto; creado: boolean }> {
    if (input.telefonoE164) {
      const previo = this.contactos.find((c) => c.telefonoE164 === input.telefonoE164);
      if (previo) return { contacto: previo, creado: false };
    }
    const contacto: Contacto = { ...input, id: this.id(), archivado: false, creadoEn: this.ahora() };
    this.contactos.push(contacto);
    return { contacto, creado: true };
  }

  async actualizarContacto(id: string, patch: Partial<ContactoInput>): Promise<Contacto | null> {
    const c = this.contactos.find((x) => x.id === id);
    if (!c) return null;
    if (patch.telefonoE164 && this.contactos.some((x) => x.id !== id && x.telefonoE164 === patch.telefonoE164)) {
      throw new CrmStoreError("ya existe otro contacto con ese teléfono");
    }
    for (const k of ["telefono", "telefonoE164", "email", "ciudad", "notas"] as const) {
      if (k in patch) {
        if (patch[k] === undefined) delete c[k];
        else c[k] = patch[k];
      }
    }
    if (patch.nombre !== undefined) c.nombre = patch.nombre;
    if (patch.origen !== undefined) c.origen = patch.origen;
    return c;
  }

  async archivarContacto(id: string, archivado: boolean): Promise<void> {
    const c = this.contactos.find((x) => x.id === id);
    if (c) c.archivado = archivado;
  }

  async buscarPorEmail(email: string): Promise<Contacto | null> {
    const e = email.trim().toLowerCase();
    return (e && this.contactos.find((c) => c.email?.toLowerCase() === e)) || null;
  }

  private conComision(c: Omit<Captacion, "comisionValor"> & { comisionValor?: number }): Captacion {
    const v = comisionValor(c.precioEsperado, c.comisionPct);
    const { comisionValor: _viejo, ...resto } = c;
    return { ...resto, ...(v !== undefined ? { comisionValor: v } : {}) };
  }

  async listarCaptaciones(contactoId?: string): Promise<Captacion[]> {
    return this.captaciones.filter((c) => !contactoId || c.contactoId === contactoId);
  }

  async captacionVigenteDe(propertyId: string): Promise<Captacion | null> {
    return this.captaciones.find((c) => c.propertyId === propertyId && c.estado !== "descartada") ?? null;
  }

  async crearCaptacion(input: CaptacionInput, origen: { leadId?: string } = {}): Promise<Captacion> {
    // Índice único captaciones_lead_uk (0013): el mismo lead no abre dos captaciones.
    const previa = origen.leadId && !this.sin0013 ? this.captaciones.find((c) => c.id === this.leadCaptacion.get(origen.leadId!)) : undefined;
    if (previa) return previa;
    const c = await this.crearCaptacionSinLlave(input);
    if (origen.leadId && !this.sin0013) this.leadCaptacion.set(origen.leadId, c.id);
    return c;
  }

  async paginaCaptaciones(opts: { pagina?: number; porPagina?: number } = {}): Promise<Pagina<CaptacionConContacto>> {
    const { pagina, porPagina, desde } = paginaYTamano(opts);
    const todas = this.captaciones
      .filter((c) => this.activo(c.contactoId))
      .sort(MemoryCrmStore.recientes)
      .map((c) => ({ ...c, contacto: breve(this.activo(c.contactoId)!) }));
    return { filas: todas.slice(desde, desde + porPagina), total: todas.length, pagina, porPagina };
  }

  private async crearCaptacionSinLlave(input: CaptacionInput): Promise<Captacion> {
    this.exigirContacto(input.contactoId);
    this.exigirInmueble(input.propertyId);
    if (input.propertyId && this.captaciones.some((c) => c.propertyId === input.propertyId && c.estado !== "descartada") && input.estado !== "descartada") {
      throw new CrmStoreError("ese inmueble ya tiene una captación vigente");
    }
    const c = this.conComision({ ...input, id: this.id(), creadoEn: this.ahora() });
    this.captaciones.push(c);
    return c;
  }

  async actualizarCaptacion(id: string, patch: Partial<CaptacionInput>): Promise<Captacion | null> {
    const i = this.captaciones.findIndex((c) => c.id === id);
    if (i < 0) return null;
    const nuevo = { ...this.captaciones[i], ...patch };
    for (const k of Object.keys(patch) as (keyof CaptacionInput)[]) if (patch[k] === undefined) delete (nuevo as Record<string, unknown>)[k];
    this.exigirInmueble(nuevo.propertyId);
    if (nuevo.propertyId && nuevo.estado !== "descartada" && this.captaciones.some((c) => c.id !== id && c.propertyId === nuevo.propertyId && c.estado !== "descartada")) {
      throw new CrmStoreError("ese inmueble ya tiene una captación vigente");
    }
    this.captaciones[i] = this.conComision(nuevo);
    return this.captaciones[i];
  }

  async listarBusquedas(contactoId?: string): Promise<Busqueda[]> {
    return this.busquedas.filter((b) => !contactoId || b.contactoId === contactoId);
  }

  async crearBusqueda(input: BusquedaInput, origen: { leadId?: string } = {}): Promise<Busqueda> {
    const previa = origen.leadId && !this.sin0013 ? this.busquedas.find((b) => b.id === this.leadBusqueda.get(origen.leadId!)) : undefined;
    if (previa) return previa;
    this.exigirContacto(input.contactoId);
    const b: Busqueda = { ...input, id: this.id(), creadoEn: this.ahora() };
    this.busquedas.push(b);
    if (origen.leadId && !this.sin0013) this.leadBusqueda.set(origen.leadId, b.id);
    return b;
  }

  async paginaBusquedas(opts: { pagina?: number; porPagina?: number } = {}): Promise<Pagina<BusquedaConContacto>> {
    const { pagina, porPagina, desde } = paginaYTamano(opts);
    const todas = this.busquedas
      .filter((b) => this.activo(b.contactoId))
      .sort(MemoryCrmStore.recientes)
      .map((b) => ({ ...b, contacto: breve(this.activo(b.contactoId)!), propuestas: this.propuestas.filter((p) => p.busquedaId === b.id).length }));
    return { filas: todas.slice(desde, desde + porPagina), total: todas.length, pagina, porPagina };
  }

  async actualizarBusqueda(id: string, patch: Partial<BusquedaInput>): Promise<Busqueda | null> {
    const b = this.busquedas.find((x) => x.id === id);
    if (!b) return null;
    Object.assign(b, patch);
    for (const k of Object.keys(patch) as (keyof BusquedaInput)[]) if (patch[k] === undefined) delete (b as unknown as Record<string, unknown>)[k];
    return b;
  }

  async listarPropuestas(busquedaIds?: string[]): Promise<Propuesta[]> {
    return this.propuestas.filter((p) => !busquedaIds || busquedaIds.includes(p.busquedaId));
  }

  async propuestasDeInmuebles(propertyIds: string[]): Promise<PropuestaDeInmueble[]> {
    const ids = new Set(propertyIds);
    return this.propuestas
      .filter((p) => ids.has(p.propertyId))
      .sort((a, b) => b.creadoEn.localeCompare(a.creadoEn))
      .flatMap((p) => {
        const b = this.busquedas.find((x) => x.id === p.busquedaId);
        const c = b ? this.contactos.find((x) => x.id === b.contactoId) : undefined;
        return b && c ? [{ ...p, contacto: breve(c), estadoBusqueda: b.estado }] : [];
      });
  }

  async proponer(busquedaId: string, propertyId: string): Promise<Propuesta> {
    if (!this.busquedas.some((b) => b.id === busquedaId)) throw new CrmStoreError("llave foránea: la búsqueda no existe");
    this.exigirInmueble(propertyId);
    const previa = this.propuestas.find((p) => p.busquedaId === busquedaId && p.propertyId === propertyId);
    if (previa) return previa;
    const p: Propuesta = { busquedaId, propertyId, estado: "propuesto", creadoEn: this.ahora() };
    this.propuestas.push(p);
    return p;
  }

  async cambiarEstadoPropuesta(busquedaId: string, propertyId: string, estado: EstadoPropuesta): Promise<void> {
    const p = this.propuestas.find((x) => x.busquedaId === busquedaId && x.propertyId === propertyId);
    if (p) p.estado = estado;
  }

  async quitarPropuesta(busquedaId: string, propertyId: string): Promise<void> {
    this.propuestas = this.propuestas.filter((p) => !(p.busquedaId === busquedaId && p.propertyId === propertyId));
  }

  async listarActividades(contactoId: string): Promise<Actividad[]> {
    return this.actividades.filter((a) => a.contactoId === contactoId).sort((a, b) => b.ocurrioEn.localeCompare(a.ocurrioEn));
  }

  async registrarActividad(input: ActividadInput): Promise<Actividad> {
    this.exigirContacto(input.contactoId);
    this.exigirInmueble(input.propertyId);
    const a: Actividad = { ...input, id: this.id(), ocurrioEn: input.ocurrioEn ?? this.ahora() };
    this.actividades.push(a);
    return a;
  }

  async existeActividad(llave: LlaveActividad, contactoId: string): Promise<boolean> {
    if (!this.sin0013) return this.llaves.has(`${llave.tipo}:${llave.id}`);
    const marca = marcaDe(llave);
    return this.actividades.some((a) => a.contactoId === contactoId && a.detalle.includes(marca));
  }

  async registrarActividadUnica(input: ActividadInput, llave: LlaveActividad): Promise<{ actividad: Actividad; nueva: boolean }> {
    if (!this.sin0013) {
      const clave = `${llave.tipo}:${llave.id}`;
      const previa = this.actividades.find((a) => a.id === this.llaves.get(clave));
      if (previa) return { actividad: previa, nueva: false };
      const actividad = await this.registrarActividad(input);
      this.llaves.set(clave, actividad.id);
      return { actividad, nueva: true };
    }
    const marca = marcaDe(llave);
    const ya = (await this.listarActividades(input.contactoId)).find((a) => a.detalle.includes(marca));
    if (ya) return { actividad: ya, nueva: false };
    return { actividad: await this.registrarActividad(input), nueva: true };
  }

  async enlazarLead(leadId: string, contactoId: string): Promise<void> {
    this.exigirContacto(contactoId);
    this.leadsEnlazados.set(leadId, contactoId);
  }

  async leadsDeContacto(contactoId: string): Promise<string[]> {
    return [...this.leadsEnlazados].filter(([, c]) => c === contactoId).map(([l]) => l);
  }

  async fijarProximoContacto(contactoId: string, at: string | null, nota?: string): Promise<void> {
    const c = this.contactos.find((x) => x.id === contactoId);
    if (!c) throw new CrmStoreError("llave foránea: el contacto no existe");
    delete c.proximoContactoAt;
    delete c.proximoContactoNota;
    if (at) {
      c.proximoContactoAt = new Date(at).toISOString();
      if (nota?.trim()) c.proximoContactoNota = nota.trim();
    }
  }

  async listarSeguimientos(hasta: string): Promise<Contacto[]> {
    const tope = new Date(hasta).getTime();
    return this.contactos
      .filter((c) => !c.archivado && c.proximoContactoAt && new Date(c.proximoContactoAt).getTime() <= tope)
      .sort((a, b) => a.proximoContactoAt!.localeCompare(b.proximoContactoAt!));
  }

  cierres: Cierre[] = [];

  async registrarCierre(input: CierreInput): Promise<Cierre> {
    // Los mismos chequeos que la tabla: precio > 0, porcentaje 0 a 100, montos no negativos y llaves que existan.
    if (!(input.precioVenta > 0)) throw new CrmStoreError("cierres_precio_venta_check: el precio debe ser mayor que cero");
    if (input.comisionPct !== undefined && (input.comisionPct < 0 || input.comisionPct > 100)) throw new CrmStoreError("cierres_comision_pct_check");
    if (input.comisionPactada !== undefined && input.comisionPactada < 0) throw new CrmStoreError("cierres_comision_pactada_check");
    for (const id of [input.vendedorContactoId, input.compradorContactoId]) if (id) this.exigirContacto(id);
    this.exigirInmueble(input.propertyId);
    if (input.captacionId && !this.captaciones.some((c) => c.id === input.captacionId)) throw new CrmStoreError("llave foránea: la captación no existe");
    if (input.busquedaId && !this.busquedas.some((b) => b.id === input.busquedaId)) throw new CrmStoreError("llave foránea: la búsqueda no existe");
    // Índice único parcial cierres_captacion_unica: una captación se vende una sola vez.
    if (input.captacionId && this.cierres.some((x) => x.captacionId === input.captacionId)) {
      throw new CrmStoreError('duplicate key value violates unique constraint "cierres_captacion_unica"');
    }
    const c: Cierre = { ...input, id: this.id(), creadoEn: this.ahora() };
    for (const k of Object.keys(c) as (keyof Cierre)[]) if (c[k] === undefined) delete (c as unknown as Record<string, unknown>)[k];
    this.cierres.push(c);
    return { ...c };
  }

  async listarCierres(filtro: { contactoId?: string; propertyId?: string } = {}): Promise<Cierre[]> {
    return this.cierres
      .filter((c) => !filtro.contactoId || c.vendedorContactoId === filtro.contactoId || c.compradorContactoId === filtro.contactoId)
      .filter((c) => !filtro.propertyId || c.propertyId === filtro.propertyId)
      .sort((a, b) => b.fechaCierre.localeCompare(a.fechaCierre) || b.creadoEn.localeCompare(a.creadoEn))
      .map((c) => ({ ...c }));
  }

  async marcarComisionCobrada(id: string, monto: number, fecha: string): Promise<Cierre | null> {
    if (monto < 0) throw new CrmStoreError("cierres_comision_cobrada_check");
    const c = this.cierres.find((x) => x.id === id);
    if (!c) return null;
    c.comisionCobrada = monto;
    c.cobradaAt = fecha.slice(0, 10);
    return { ...c };
  }

  async datosEmbudo(desde: string, hasta: string): Promise<DatosEmbudo> {
    const dentro = (iso: string) => iso >= desde && iso < hasta;
    return {
      captaciones: this.captaciones.filter((c) => dentro(c.creadoEn) && c.estado !== "descartada").map((c) => ({ estado: c.estado })),
      busquedas: this.busquedas
        .filter((b) => dentro(b.creadoEn) && b.estado !== "descartada")
        .map((b) => ({ estado: b.estado, propuestas: this.propuestas.filter((p) => p.busquedaId === b.id).map((p) => p.estado) })),
    };
  }

  /** Fecha de supresión de cada contacto (columna contactos.suprimido_at de 0013). */
  suprimidos = new Map<string, string>();

  async suprimirContacto(contactoId: string, at: string): Promise<ResumenSupresion> {
    const c = this.contactos.find((x) => x.id === contactoId);
    if (!c) throw new CrmStoreError("llave foránea: el contacto no existe");
    for (const k of ["telefono", "telefonoE164", "email", "ciudad", "notas", "proximoContactoAt", "proximoContactoNota"] as const) delete c[k];
    c.nombre = NOMBRE_SUPRIMIDO;
    c.archivado = true;
    if (!this.sin0013) this.suprimidos.set(contactoId, at);
    const suyas = this.actividades.filter((a) => a.contactoId === contactoId);
    for (const a of suyas) a.detalle = TEXTO_SUPRIMIDO;
    for (const x of this.captaciones.filter((y) => y.contactoId === contactoId)) delete x.notas;
    for (const b of this.busquedas.filter((y) => y.contactoId === contactoId)) {
      delete b.notas;
      delete b.especificacion;
    }
    for (const ci of this.cierres.filter((y) => y.vendedorContactoId === contactoId || y.compradorContactoId === contactoId)) delete ci.notas;
    return { actividades: suyas.length };
  }
}

// Guardado en globalThis para que, sin Supabase (desarrollo), páginas y acciones compartan el mismo almacén en memoria.
const global = globalThis as typeof globalThis & { __crmStore?: CrmStore };

export function getCrmStore(): CrmStore {
  if (!global.__crmStore) global.__crmStore = isSupabaseConfigured() ? new SupabaseCrmStore() : new MemoryCrmStore();
  return global.__crmStore;
}
