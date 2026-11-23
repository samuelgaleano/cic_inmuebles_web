import { getSupabaseAdmin, isSupabaseConfigured } from "@/lib/data/supabase/client";
import { comisionValor } from "./reglas";
import type {
  Actividad,
  ActividadInput,
  Busqueda,
  BusquedaInput,
  Captacion,
  CaptacionInput,
  Cierre,
  CierreInput,
  Contacto,
  ContactoInput,
  ContactoResumen,
  EstadoPropuesta,
  Propuesta,
} from "./tipos";

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
  listarContactos(opts?: { q?: string; incluirArchivados?: boolean }): Promise<ContactoResumen[]>;
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
  crearCaptacion(input: CaptacionInput): Promise<Captacion>;
  actualizarCaptacion(id: string, patch: Partial<CaptacionInput>): Promise<Captacion | null>;

  // Compradores
  listarBusquedas(contactoId?: string): Promise<Busqueda[]>;
  crearBusqueda(input: BusquedaInput): Promise<Busqueda>;
  actualizarBusqueda(id: string, patch: Partial<BusquedaInput>): Promise<Busqueda | null>;

  // Inmuebles propuestos a una búsqueda
  listarPropuestas(busquedaIds?: string[]): Promise<Propuesta[]>;
  /** Idempotente: proponer dos veces el mismo inmueble no lo repite. */
  proponer(busquedaId: string, propertyId: string): Promise<Propuesta>;
  cambiarEstadoPropuesta(busquedaId: string, propertyId: string, estado: EstadoPropuesta): Promise<void>;
  quitarPropuesta(busquedaId: string, propertyId: string): Promise<void>;

  // Línea de tiempo
  listarActividades(contactoId: string): Promise<Actividad[]>;
  registrarActividad(input: ActividadInput): Promise<Actividad>;

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

function falla(op: string, error: ErrorDb | null): never {
  const msg = error?.message ?? "error desconocido";
  if (faltaEsquema(error)) {
    const migracion = esDe0010(error) ? "0010" : "0007";
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

  async crearCaptacion(input: CaptacionInput): Promise<Captacion> {
    const { data, error } = await this.db().from("captaciones").insert(filaDeCaptacion(input)).select(COLS_CAPTACION).single();
    if (error) falla("crearCaptacion", error);
    return aCaptacion(data as CaptacionRow);
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

  async crearBusqueda(input: BusquedaInput): Promise<Busqueda> {
    const { data, error } = await this.db().from("busquedas").insert(filaDeBusqueda(input)).select(COLS_BUSQUEDA).single();
    if (error) falla("crearBusqueda", error);
    return aBusqueda(data as BusquedaRow);
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
    const { data, error } = await this.db().from("actividades").insert(fila).select("id, contacto_id, property_id, tipo, detalle, ocurrio_en").single();
    if (error) falla("registrarActividad", error);
    return aActividad(data as ActividadRow);
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

  async crearCaptacion(input: CaptacionInput): Promise<Captacion> {
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

  async crearBusqueda(input: BusquedaInput): Promise<Busqueda> {
    this.exigirContacto(input.contactoId);
    const b: Busqueda = { ...input, id: this.id(), creadoEn: this.ahora() };
    this.busquedas.push(b);
    return b;
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
}

// Guardado en globalThis para que, sin Supabase (desarrollo), páginas y acciones compartan el mismo almacén en memoria.
const global = globalThis as typeof globalThis & { __crmStore?: CrmStore };

export function getCrmStore(): CrmStore {
  if (!global.__crmStore) global.__crmStore = isSupabaseConfigured() ? new SupabaseCrmStore() : new MemoryCrmStore();
  return global.__crmStore;
}
