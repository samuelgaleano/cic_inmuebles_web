import { getSupabaseAdmin, isSupabaseConfigured } from "@/lib/data/supabase/client";
import type { EstadoServicio, Periodo, Servicio, TipoAviso, TipoPeriodo } from "./vigencia";

export interface NuevoServicio {
  txId: string;
  reference: string | null;
  planId: string;
  dias: number;
  clienteEmail: string | null;
  clienteNombre: string | null;
  clienteTelefono: string | null;
  /** Cuándo aprobó Wompi el pago, si se conoce. */
  pagadoAt?: string | null;
}

/** La tabla no existe todavía (falta aplicar supabase/migrations/0004). */
export class ServiciosNoDisponibleError extends Error {}
export class ServiciosStoreError extends Error {}

/** Resultado de aplicar una renovación pagada (ver `aplicarRenovacion`). */
export type ResultadoRenovacion =
  | { resultado: "aplicada"; servicio: Servicio }
  /** Otra llamada ya aplicó esta transacción. */
  | { resultado: "ya_aplicada" }
  /** El vencimiento cambió entre la lectura y la escritura: no queda nada reclamado y el siguiente intento la retoma. */
  | { resultado: "conflicto" };

/** Ficha que ocupa un espacio de un paquete. `slug` es null si el inmueble ya no tiene dirección conocida. */
export interface FichaDePaquete {
  propertyId: string;
  slug: string | null;
}

/** Lo que el cliente deja en /publica/agente/datos sobre el inmueble a publicar. */
export interface DatosInmueble {
  tipo: string;
  ciudad: string;
  sector: string | null;
  /** Pesos colombianos. */
  precio: number | null;
  descripcion: string | null;
  /** Contacto que irá en la ficha pública (no necesariamente quien pagó). */
  contactoNombre: string;
  contactoWhatsapp: string;
}

export interface DatosInmuebleGuardados extends DatosInmueble {
  id: number;
  servicioId: string;
  createdAt: string;
}

export interface ServiciosStore {
  /** true si la tabla existe (migración 0004 aplicada). Nunca lanza. */
  disponible(): Promise<boolean>;
  /** Reclama la aplicación de una renovación pagada: true solo la primera vez para ese tx_id. */
  registrarRenovacion(txId: string, servicioId: string): Promise<boolean>;
  /** Deshace el reclamo si la renovación no se pudo aplicar, para que el siguiente intento la retome. */
  liberarRenovacion(txId: string): Promise<void>;
  /**
   * Renovación pagada en un solo paso: reclama el tx_id, extiende la vigencia solo si sigue siendo
   * `venceEsperado` y anota el tramo. Si la extensión no aplica, el reclamo no queda hecho.
   * Lanza si la base falla (sin dejar el reclamo hecho).
   */
  aplicarRenovacion(txId: string, servicioId: string, v: { inicioAt: string | null; venceAt: string }, venceEsperado: string | null): Promise<ResultadoRenovacion>;
  /** De esos tx_id, los que ya abrieron un servicio o aplicaron una renovación. */
  txIdsRegistrados(txIds: string[]): Promise<Set<string>>;
  /** Fichas que cubre cada paquete, en el orden en que se asignaron. Sin la tabla (0011), vacío. */
  fichasDePaquetes(servicioIds: string[]): Promise<Map<string, FichaDePaquete[]>>;
  /** Ocupa un espacio del paquete con esa ficha; false si ya estaba. El límite lo decide quien llama. */
  agregarFichaAPaquete(servicioId: string, ficha: FichaDePaquete): Promise<boolean>;
  quitarFichaDePaquete(servicioId: string, propertyId: string): Promise<void>;
  /** Guarda los datos del inmueble que dejó el cliente después de pagar. */
  guardarDatos(servicioId: string, d: DatosInmueble): Promise<void>;
  /** Datos enviados por servicio, del más reciente al más antiguo. Sin la tabla (0011), vacío. */
  datosDeServicios(servicioIds: string[]): Promise<Map<string, DatosInmuebleGuardados[]>>;
  /** Idempotente por tx_id: repetir el pago aprobado no crea otro servicio. */
  registrar(n: NuevoServicio): Promise<{ servicio: Servicio; creado: boolean }>;
  listar(): Promise<Servicio[]>;
  /** Solo lo que el cron diario necesita mirar: activos y vencidos sin su aviso de vencimiento (sin el tope del panel). */
  listarParaRevision(): Promise<Servicio[]>;
  obtener(id: string): Promise<Servicio | null>;
  /** Fija la ventana de vigencia y deja el servicio activo. Solo si sigue pendiente: un doble clic no activa dos veces. */
  activar(id: string, v: { propertySlug?: string | null; propertyId?: string | null; inicioAt: string; venceAt: string }): Promise<Servicio | null>;
  /**
   * Extiende la vigencia y limpia los avisos para que se vuelvan a enviar. Solo si el vencimiento sigue
   * siendo `venceEsperado` (el que se leyó antes de calcular): así un doble envío no suma dos periodos.
   * `origen` y `txId` quedan en el libro de periodos (por defecto, una renovación pagada).
   */
  renovar(
    id: string,
    v: { inicioAt: string | null; venceAt: string },
    venceEsperado: string | null,
    origen?: { tipo?: Extract<TipoPeriodo, "renovacion" | "suma_manual">; txId?: string | null },
  ): Promise<Servicio | null>;
  /**
   * Pasa a vencido. Sin `forzar` solo si la fecha de vencimiento ya pasó (así una renovación
   * hecha mientras corría el cron no se pisa). Con `forzar` vence ya y recorta vence_at a ahora,
   * y deja en el libro de periodos el tiempo que se quitó (salvo con `sinPeriodo`).
   */
  marcarVencido(id: string, opts?: { forzar?: boolean; ahora?: Date; sinPeriodo?: boolean }): Promise<void>;
  marcarAviso(id: string, tipo: TipoAviso): Promise<void>;
  asignarFicha(id: string, propertySlug: string | null, propertyId?: string | null): Promise<void>;
  /** Un inmueble cambió de dirección (se renombró): sus planes siguen la ficha nueva. Devuelve cuántos movió. */
  renombrarFicha(slugAnterior: string, slugNuevo: string): Promise<number>;
  /** Persona del CRM dueña del plan. */
  asignarContacto(id: string, contactoId: string): Promise<void>;
  /** Momento en que Wompi aprobó el pago (solo si todavía no se conocía). */
  fijarPagadoAt(id: string, pagadoAt: string): Promise<void>;
  /** Tramos de vigencia del plan, en el orden en que ocurrieron. */
  periodos(servicioId: string): Promise<Periodo[]>;
  /** Saca de la lista un servicio sin reloj corriendo (pendiente o vencido); true si lo descartó. No borra nada. */
  descartar(id: string): Promise<boolean>;
  /** Deshace un descarte: vuelve a «pendiente» si nunca corrió su vigencia y a «vencido» si ya había corrido. */
  restaurar(id: string): Promise<boolean>;
}

type Row = {
  id: string;
  tx_id: string;
  reference: string | null;
  plan_id: string;
  dias: number;
  cliente_email: string | null;
  cliente_nombre: string | null;
  cliente_telefono: string | null;
  estado: EstadoServicio;
  property_slug: string | null;
  inicio_at: string | null;
  vence_at: string | null;
  aviso_7d_at: string | null;
  aviso_1d_at: string | null;
  aviso_vencido_at: string | null;
  created_at: string;
  contacto_id?: string | null;
  property_id?: string | null;
  pagado_at?: string | null;
};

type PeriodoRow = { id: number; servicio_id: string; tipo: TipoPeriodo; desde: string; hasta: string; tx_id: string | null; created_at: string };

function aPeriodo(r: PeriodoRow): Periodo {
  return { id: Number(r.id), servicioId: r.servicio_id, tipo: r.tipo, desde: r.desde, hasta: r.hasta, txId: r.tx_id, createdAt: r.created_at };
}

const COLUMNAS =
  "id, tx_id, reference, plan_id, dias, cliente_email, cliente_nombre, cliente_telefono, estado, property_slug, inicio_at, vence_at, aviso_7d_at, aviso_1d_at, aviso_vencido_at, created_at, contacto_id, property_id, pagado_at";

function aServicio(r: Row): Servicio {
  return {
    id: r.id,
    txId: r.tx_id,
    reference: r.reference,
    planId: r.plan_id,
    dias: Number(r.dias),
    clienteEmail: r.cliente_email,
    clienteNombre: r.cliente_nombre,
    clienteTelefono: r.cliente_telefono,
    estado: r.estado,
    propertySlug: r.property_slug,
    inicioAt: r.inicio_at,
    venceAt: r.vence_at,
    aviso7dAt: r.aviso_7d_at,
    aviso1dAt: r.aviso_1d_at,
    avisoVencidoAt: r.aviso_vencido_at,
    createdAt: r.created_at,
    contactoId: r.contacto_id ?? null,
    propertyId: r.property_id ?? null,
    pagadoAt: r.pagado_at ?? null,
  };
}

function falla(op: string, error: { message: string; code?: string } | null): never {
  const msg = error?.message ?? "error desconocido";
  // 42P01: la tabla no existe. PGRST205/"schema cache": PostgREST aún no la ve.
  if (error?.code === "42P01" || error?.code === "PGRST205" || /schema cache|does not exist/i.test(msg)) {
    throw new ServiciosNoDisponibleError(`[servicios] ${op}: falta aplicar la migración 0004 (${msg})`);
  }
  throw new ServiciosStoreError(`[servicios] ${op}: ${msg}`);
}

const AVISO_COLUMNA: Record<TipoAviso, string> = { "7d": "aviso_7d_at", "1d": "aviso_1d_at", vencido: "aviso_vencido_at" };

/** La tabla todavía no existe o PostgREST aún no la ve (migración sin aplicar). */
function sinTabla(error: { message: string; code?: string }): boolean {
  return error.code === "42P01" || error.code === "PGRST205" || /schema cache|does not exist/i.test(error.message);
}

/** La función SQL no existe (migración 0011 sin aplicar): PostgREST responde PGRST202 y Postgres 42883. */
function sinFuncion(error: { message: string; code?: string }): boolean {
  return error.code === "PGRST202" || error.code === "42883";
}

/**
 * Renovación por pasos (camino anterior a 0011 y semántica del store en memoria): reclamo, extensión
 * condicionada y, si no se aplicó, se deshace el reclamo para que el siguiente intento la retome.
 */
async function renovacionPorPasos(
  store: Pick<ServiciosStore, "registrarRenovacion" | "renovar" | "liberarRenovacion">,
  txId: string,
  servicioId: string,
  v: { inicioAt: string | null; venceAt: string },
  venceEsperado: string | null,
): Promise<ResultadoRenovacion> {
  if (!(await store.registrarRenovacion(txId, servicioId))) return { resultado: "ya_aplicada" };
  let renovado: Servicio | null;
  try {
    renovado = await store.renovar(servicioId, v, venceEsperado, { tipo: "renovacion", txId });
  } catch (err) {
    await store.liberarRenovacion(txId).catch(() => undefined);
    throw err;
  }
  if (!renovado) {
    await store.liberarRenovacion(txId).catch(() => undefined);
    return { resultado: "conflicto" };
  }
  return { resultado: "aplicada", servicio: renovado };
}

type DatosRow = {
  id: number;
  servicio_id: string;
  tipo: string;
  ciudad: string;
  sector: string | null;
  precio: number | null;
  descripcion: string | null;
  contacto_nombre: string;
  contacto_whatsapp: string;
  created_at: string;
};

function aDatos(r: DatosRow): DatosInmuebleGuardados {
  return {
    id: Number(r.id),
    servicioId: r.servicio_id,
    tipo: r.tipo,
    ciudad: r.ciudad,
    sector: r.sector,
    precio: r.precio == null ? null : Number(r.precio),
    descripcion: r.descripcion,
    contactoNombre: r.contacto_nombre,
    contactoWhatsapp: r.contacto_whatsapp,
    createdAt: r.created_at,
  };
}

function agrupar<T>(filas: T[], clave: (f: T) => string): Map<string, T[]> {
  const m = new Map<string, T[]>();
  for (const f of filas) {
    const k = clave(f);
    const lista = m.get(k);
    if (lista) lista.push(f);
    else m.set(k, [f]);
  }
  return m;
}

class SupabaseServiciosStore implements ServiciosStore {
  async disponible(): Promise<boolean> {
    try {
      const { error } = await getSupabaseAdmin().from("servicios_publicacion").select("id").limit(1);
      return !error;
    } catch {
      return false;
    }
  }

  async registrarRenovacion(txId: string, servicioId: string): Promise<boolean> {
    const { error } = await getSupabaseAdmin().from("servicios_renovaciones").insert({ tx_id: txId, servicio_id: servicioId });
    if (!error) return true;
    if (error.code === "23505") return false; // ya aplicada por otro intento
    falla("registrarRenovacion", error);
  }

  async liberarRenovacion(txId: string): Promise<void> {
    const { error } = await getSupabaseAdmin().from("servicios_renovaciones").delete().eq("tx_id", txId);
    if (error) falla("liberarRenovacion", error);
  }

  async aplicarRenovacion(txId: string, servicioId: string, v: { inicioAt: string | null; venceAt: string }, venceEsperado: string | null): Promise<ResultadoRenovacion> {
    const { data, error } = await getSupabaseAdmin().rpc("aplicar_renovacion", {
      p_tx_id: txId,
      p_servicio_id: servicioId,
      p_vence_esperado: venceEsperado,
      p_inicio_at: v.inicioAt,
      p_vence_at: v.venceAt,
    });
    if (error) {
      // Sin la función (0011 sin aplicar) se sigue por el camino anterior, que no es atómico pero sí idempotente.
      if (sinFuncion(error)) return renovacionPorPasos(this, txId, servicioId, v, venceEsperado);
      falla("aplicarRenovacion", error);
    }
    const r = (data ?? {}) as { resultado?: string; servicio?: Row };
    if (r.resultado === "aplicada" && r.servicio) return { resultado: "aplicada", servicio: aServicio(r.servicio) };
    if (r.resultado === "ya_aplicada") return { resultado: "ya_aplicada" };
    return { resultado: "conflicto" };
  }

  async txIdsRegistrados(txIds: string[]): Promise<Set<string>> {
    if (txIds.length === 0) return new Set();
    const db = getSupabaseAdmin();
    const [servicios, renovaciones] = await Promise.all([
      db.from("servicios_publicacion").select("tx_id").in("tx_id", txIds),
      db.from("servicios_renovaciones").select("tx_id").in("tx_id", txIds),
    ]);
    if (servicios.error) falla("txIdsRegistrados", servicios.error);
    if (renovaciones.error) falla("txIdsRegistrados", renovaciones.error);
    const filas = [...(servicios.data ?? []), ...(renovaciones.data ?? [])] as { tx_id: string }[];
    return new Set(filas.map((f) => f.tx_id));
  }

  async fichasDePaquetes(servicioIds: string[]): Promise<Map<string, FichaDePaquete[]>> {
    if (servicioIds.length === 0) return new Map();
    const { data, error } = await getSupabaseAdmin()
      .from("servicio_fichas")
      .select("servicio_id, property_id, properties(slug)")
      .in("servicio_id", servicioIds)
      .order("id", { ascending: true });
    if (error) {
      if (sinTabla(error)) return new Map();
      falla("fichasDePaquetes", error);
    }
    type Fila = { servicio_id: string; property_id: string; properties: { slug: string | null } | { slug: string | null }[] | null };
    const filas = (data ?? []) as unknown as Fila[];
    const conSlug = filas.map((f) => {
      const p = Array.isArray(f.properties) ? f.properties[0] : f.properties;
      return { servicioId: f.servicio_id, ficha: { propertyId: f.property_id, slug: p?.slug ?? null } };
    });
    const m = new Map<string, FichaDePaquete[]>();
    for (const [k, v] of agrupar(conSlug, (f) => f.servicioId)) m.set(k, v.map((f) => f.ficha));
    return m;
  }

  async agregarFichaAPaquete(servicioId: string, ficha: FichaDePaquete): Promise<boolean> {
    const { error } = await getSupabaseAdmin().from("servicio_fichas").insert({ servicio_id: servicioId, property_id: ficha.propertyId });
    if (!error) return true;
    if (error.code === "23505") return false; // ya estaba en el paquete
    falla("agregarFichaAPaquete", error);
  }

  async quitarFichaDePaquete(servicioId: string, propertyId: string): Promise<void> {
    const { error } = await getSupabaseAdmin().from("servicio_fichas").delete().eq("servicio_id", servicioId).eq("property_id", propertyId);
    if (error) falla("quitarFichaDePaquete", error);
  }

  async guardarDatos(servicioId: string, d: DatosInmueble): Promise<void> {
    const { error } = await getSupabaseAdmin().from("servicio_datos").insert({
      servicio_id: servicioId,
      tipo: d.tipo,
      ciudad: d.ciudad,
      sector: d.sector,
      precio: d.precio,
      descripcion: d.descripcion,
      contacto_nombre: d.contactoNombre,
      contacto_whatsapp: d.contactoWhatsapp,
    });
    if (error) falla("guardarDatos", error);
  }

  async datosDeServicios(servicioIds: string[]): Promise<Map<string, DatosInmuebleGuardados[]>> {
    if (servicioIds.length === 0) return new Map();
    const { data, error } = await getSupabaseAdmin()
      .from("servicio_datos")
      .select("id, servicio_id, tipo, ciudad, sector, precio, descripcion, contacto_nombre, contacto_whatsapp, created_at")
      .in("servicio_id", servicioIds)
      .order("created_at", { ascending: false })
      .limit(1000);
    if (error) {
      if (sinTabla(error)) return new Map();
      falla("datosDeServicios", error);
    }
    return agrupar(((data ?? []) as DatosRow[]).map(aDatos), (d) => d.servicioId);
  }

  async registrar(n: NuevoServicio): Promise<{ servicio: Servicio; creado: boolean }> {
    const db = getSupabaseAdmin();
    const previo = await db.from("servicios_publicacion").select(COLUMNAS).eq("tx_id", n.txId).maybeSingle();
    if (previo.error) falla("registrar/buscar", previo.error);
    if (previo.data) return { servicio: aServicio(previo.data as Row), creado: false };

    const ins = await db
      .from("servicios_publicacion")
      .insert({
        tx_id: n.txId,
        reference: n.reference,
        plan_id: n.planId,
        dias: n.dias,
        cliente_email: n.clienteEmail,
        cliente_nombre: n.clienteNombre,
        cliente_telefono: n.clienteTelefono,
        ...(n.pagadoAt ? { pagado_at: n.pagadoAt } : {}),
      })
      .select(COLUMNAS)
      .single();
    if (ins.error) {
      // Carrera con otro proceso que insertó el mismo tx_id: se devuelve el existente.
      if (ins.error.code === "23505") {
        const otra = await db.from("servicios_publicacion").select(COLUMNAS).eq("tx_id", n.txId).single();
        if (otra.error) falla("registrar/releer", otra.error);
        return { servicio: aServicio(otra.data as Row), creado: false };
      }
      falla("registrar/insertar", ins.error);
    }
    return { servicio: aServicio(ins.data as Row), creado: true };
  }

  async listar(): Promise<Servicio[]> {
    const { data, error } = await getSupabaseAdmin()
      .from("servicios_publicacion")
      .select(COLUMNAS)
      .order("created_at", { ascending: false })
      .limit(500);
    if (error) falla("listar", error);
    return ((data ?? []) as Row[]).map(aServicio);
  }

  async listarParaRevision(): Promise<Servicio[]> {
    const { data, error } = await getSupabaseAdmin()
      .from("servicios_publicacion")
      .select(COLUMNAS)
      .or("estado.eq.activo,and(estado.eq.vencido,aviso_vencido_at.is.null)")
      .order("vence_at", { ascending: true })
      .limit(2000);
    if (error) falla("listarParaRevision", error);
    return ((data ?? []) as Row[]).map(aServicio);
  }

  async obtener(id: string): Promise<Servicio | null> {
    const { data, error } = await getSupabaseAdmin().from("servicios_publicacion").select(COLUMNAS).eq("id", id).maybeSingle();
    if (error) falla("obtener", error);
    return data ? aServicio(data as Row) : null;
  }

  /** El libro de periodos nunca debe impedir la operación que registra (p. ej. si la tabla aún no existe). */
  private async anotarPeriodo(servicioId: string, tipo: TipoPeriodo, desde: string, hasta: string, txId?: string | null): Promise<void> {
    try {
      const { error } = await getSupabaseAdmin().from("servicios_periodos").insert({ servicio_id: servicioId, tipo, desde, hasta, tx_id: txId ?? null });
      if (error) console.error(`[servicios] no se pudo anotar el periodo (${tipo}): ${error.message}`);
    } catch (err) {
      console.error("[servicios] no se pudo anotar el periodo:", err instanceof Error ? err.message : err);
    }
  }

  async activar(id: string, v: { propertySlug?: string | null; propertyId?: string | null; inicioAt: string; venceAt: string }): Promise<Servicio | null> {
    const patch: Record<string, unknown> = {
      estado: "activo",
      inicio_at: v.inicioAt,
      vence_at: v.venceAt,
      aviso_7d_at: null,
      aviso_1d_at: null,
      aviso_vencido_at: null,
    };
    if (v.propertySlug !== undefined) patch.property_slug = v.propertySlug;
    if (v.propertyId !== undefined) patch.property_id = v.propertyId;
    const { data, error } = await getSupabaseAdmin()
      .from("servicios_publicacion")
      .update(patch)
      .eq("id", id)
      .eq("estado", "pendiente_publicar")
      .select(COLUMNAS)
      .maybeSingle();
    if (error) falla("activar", error);
    if (data) await this.anotarPeriodo(id, "activacion", v.inicioAt, v.venceAt, (data as Row).tx_id);
    return data ? aServicio(data as Row) : null;
  }

  async renovar(
    id: string,
    v: { inicioAt: string | null; venceAt: string },
    venceEsperado: string | null,
    origen: { tipo?: Extract<TipoPeriodo, "renovacion" | "suma_manual">; txId?: string | null } = {},
  ): Promise<Servicio | null> {
    const patch: Record<string, unknown> = {
      estado: "activo",
      vence_at: v.venceAt,
      aviso_7d_at: null,
      aviso_1d_at: null,
      aviso_vencido_at: null,
    };
    if (v.inicioAt) patch.inicio_at = v.inicioAt;
    const base = getSupabaseAdmin().from("servicios_publicacion").update(patch).eq("id", id);
    const condicionada = venceEsperado ? base.eq("vence_at", venceEsperado) : base.is("vence_at", null);
    const { data, error } = await condicionada.select(COLUMNAS).maybeSingle();
    if (error) falla("renovar", error);
    // El tramo nuevo empieza donde terminaba el anterior (si seguía vigente) o ahora (si ya había vencido).
    if (data) await this.anotarPeriodo(id, origen.tipo ?? "renovacion", v.inicioAt ?? venceEsperado ?? new Date().toISOString(), v.venceAt, origen.txId);
    return data ? aServicio(data as Row) : null;
  }

  async marcarVencido(id: string, opts: { forzar?: boolean; ahora?: Date; sinPeriodo?: boolean } = {}): Promise<void> {
    const ahora = (opts.ahora ?? new Date()).toISOString();
    const base = getSupabaseAdmin().from("servicios_publicacion");
    if (opts.forzar && !opts.sinPeriodo) {
      // Se anota el tiempo que se quita, leyendo antes cuánto le quedaba.
      const previo = await base.select("vence_at").eq("id", id).maybeSingle();
      const hasta = (previo.data as { vence_at: string | null } | null)?.vence_at;
      if (hasta && new Date(hasta).getTime() > new Date(ahora).getTime()) await this.anotarPeriodo(id, "recorte", ahora, hasta);
    }
    const { error } = opts.forzar
      ? await base.update({ estado: "vencido", vence_at: ahora }).eq("id", id)
      : await base.update({ estado: "vencido" }).eq("id", id).lte("vence_at", ahora);
    if (error) falla("marcarVencido", error);
  }

  async marcarAviso(id: string, tipo: TipoAviso): Promise<void> {
    const { error } = await getSupabaseAdmin()
      .from("servicios_publicacion")
      .update({ [AVISO_COLUMNA[tipo]]: new Date().toISOString() })
      .eq("id", id);
    if (error) falla("marcarAviso", error);
  }

  async asignarFicha(id: string, propertySlug: string | null, propertyId?: string | null): Promise<void> {
    const patch: Record<string, unknown> = { property_slug: propertySlug };
    if (propertyId !== undefined) patch.property_id = propertyId;
    const { error } = await getSupabaseAdmin().from("servicios_publicacion").update(patch).eq("id", id);
    if (error) falla("asignarFicha", error);
  }

  async renombrarFicha(slugAnterior: string, slugNuevo: string): Promise<number> {
    const { data, error } = await getSupabaseAdmin()
      .from("servicios_publicacion")
      .update({ property_slug: slugNuevo })
      .eq("property_slug", slugAnterior)
      .select("id");
    if (error) falla("renombrarFicha", error);
    return data?.length ?? 0;
  }

  async asignarContacto(id: string, contactoId: string): Promise<void> {
    const { error } = await getSupabaseAdmin().from("servicios_publicacion").update({ contacto_id: contactoId }).eq("id", id);
    if (error) falla("asignarContacto", error);
  }

  async fijarPagadoAt(id: string, pagadoAt: string): Promise<void> {
    const { error } = await getSupabaseAdmin().from("servicios_publicacion").update({ pagado_at: pagadoAt }).eq("id", id).is("pagado_at", null);
    if (error) falla("fijarPagadoAt", error);
  }

  async periodos(servicioId: string): Promise<Periodo[]> {
    const { data, error } = await getSupabaseAdmin().from("servicios_periodos").select("id, servicio_id, tipo, desde, hasta, tx_id, created_at").eq("servicio_id", servicioId).order("id", { ascending: true });
    if (error) {
      // Sin la tabla (migración 0008 sin aplicar) la ficha se muestra igual, sin historial de tramos.
      if (error.code === "42P01" || error.code === "PGRST205" || /schema cache|does not exist/i.test(error.message)) return [];
      falla("periodos", error);
    }
    return ((data ?? []) as PeriodoRow[]).map(aPeriodo);
  }

  async descartar(id: string): Promise<boolean> {
    const { data, error } = await getSupabaseAdmin()
      .from("servicios_publicacion")
      .update({ estado: "descartado" })
      .eq("id", id)
      .in("estado", ["pendiente_publicar", "vencido"])
      .select("id")
      .maybeSingle();
    if (error) falla("descartar", error);
    return Boolean(data);
  }

  async restaurar(id: string): Promise<boolean> {
    const db = getSupabaseAdmin().from("servicios_publicacion");
    const previo = await db.select("vence_at").eq("id", id).eq("estado", "descartado").maybeSingle();
    if (previo.error) falla("restaurar/leer", previo.error);
    if (!previo.data) return false;
    const estado = previo.data.vence_at ? "vencido" : "pendiente_publicar";
    const { data, error } = await getSupabaseAdmin().from("servicios_publicacion").update({ estado }).eq("id", id).eq("estado", "descartado").select("id").maybeSingle();
    if (error) falla("restaurar", error);
    return Boolean(data);
  }
}

/** Store en memoria con la misma semántica: pruebas y desarrollo sin Supabase. */
export class MemoryServiciosStore implements ServiciosStore {
  filas: Servicio[] = [];
  renovaciones = new Map<string, string>();
  libro: Periodo[] = [];
  fichas: (FichaDePaquete & { servicioId: string })[] = [];
  datos: DatosInmuebleGuardados[] = [];
  private seq = 1;
  private seqPeriodo = 1;
  private seqDatos = 1;
  now = () => Date.now();

  private anotar(servicioId: string, tipo: TipoPeriodo, desde: string, hasta: string, txId?: string | null): void {
    this.libro.push({ id: this.seqPeriodo++, servicioId, tipo, desde, hasta, txId: txId ?? null, createdAt: new Date(this.now()).toISOString() });
  }

  async disponible(): Promise<boolean> {
    return true;
  }

  async registrarRenovacion(txId: string, servicioId: string): Promise<boolean> {
    if (this.renovaciones.has(txId)) return false;
    this.renovaciones.set(txId, servicioId);
    return true;
  }

  async liberarRenovacion(txId: string): Promise<void> {
    this.renovaciones.delete(txId);
  }

  async aplicarRenovacion(txId: string, servicioId: string, v: { inicioAt: string | null; venceAt: string }, venceEsperado: string | null): Promise<ResultadoRenovacion> {
    // Misma semántica que la función SQL: si no se extiende, el reclamo no queda hecho.
    return renovacionPorPasos(this, txId, servicioId, v, venceEsperado);
  }

  async txIdsRegistrados(txIds: string[]): Promise<Set<string>> {
    const pedidos = new Set(txIds);
    const hay = [...this.filas.map((s) => s.txId), ...this.renovaciones.keys()];
    return new Set(hay.filter((t) => pedidos.has(t)));
  }

  async fichasDePaquetes(servicioIds: string[]): Promise<Map<string, FichaDePaquete[]>> {
    const ids = new Set(servicioIds);
    const m = new Map<string, FichaDePaquete[]>();
    for (const [k, v] of agrupar(this.fichas.filter((f) => ids.has(f.servicioId)), (f) => f.servicioId)) {
      m.set(k, v.map(({ propertyId, slug }) => ({ propertyId, slug })));
    }
    return m;
  }

  async agregarFichaAPaquete(servicioId: string, ficha: FichaDePaquete): Promise<boolean> {
    if (this.fichas.some((f) => f.servicioId === servicioId && f.propertyId === ficha.propertyId)) return false;
    this.fichas.push({ servicioId, ...ficha });
    return true;
  }

  async quitarFichaDePaquete(servicioId: string, propertyId: string): Promise<void> {
    this.fichas = this.fichas.filter((f) => !(f.servicioId === servicioId && f.propertyId === propertyId));
  }

  async guardarDatos(servicioId: string, d: DatosInmueble): Promise<void> {
    this.datos.push({ ...d, id: this.seqDatos++, servicioId, createdAt: new Date(this.now()).toISOString() });
  }

  async datosDeServicios(servicioIds: string[]): Promise<Map<string, DatosInmuebleGuardados[]>> {
    const ids = new Set(servicioIds);
    const filas = this.datos.filter((d) => ids.has(d.servicioId)).sort((a, b) => b.createdAt.localeCompare(a.createdAt) || b.id - a.id);
    return agrupar(filas, (d) => d.servicioId);
  }

  async registrar(n: NuevoServicio): Promise<{ servicio: Servicio; creado: boolean }> {
    const previo = this.filas.find((s) => s.txId === n.txId);
    if (previo) return { servicio: previo, creado: false };
    const id = `00000000-0000-4000-8000-${String(this.seq++).padStart(12, "0")}`;
    const servicio: Servicio = {
      id,
      txId: n.txId,
      reference: n.reference,
      planId: n.planId,
      dias: n.dias,
      clienteEmail: n.clienteEmail,
      clienteNombre: n.clienteNombre,
      clienteTelefono: n.clienteTelefono,
      estado: "pendiente_publicar",
      propertySlug: null,
      inicioAt: null,
      venceAt: null,
      aviso7dAt: null,
      aviso1dAt: null,
      avisoVencidoAt: null,
      createdAt: new Date(this.now()).toISOString(),
      contactoId: null,
      propertyId: null,
      pagadoAt: n.pagadoAt ?? null,
    };
    this.filas.push(servicio);
    return { servicio, creado: true };
  }

  async listar(): Promise<Servicio[]> {
    return [...this.filas].sort((a, b) => b.createdAt.localeCompare(a.createdAt));
  }

  async listarParaRevision(): Promise<Servicio[]> {
    return this.filas.filter((s) => s.estado === "activo" || (s.estado === "vencido" && !s.avisoVencidoAt));
  }

  async obtener(id: string): Promise<Servicio | null> {
    return this.filas.find((s) => s.id === id) ?? null;
  }

  async activar(id: string, v: { propertySlug?: string | null; propertyId?: string | null; inicioAt: string; venceAt: string }): Promise<Servicio | null> {
    const s = this.filas.find((x) => x.id === id);
    if (!s || s.estado !== "pendiente_publicar") return null;
    Object.assign(s, { estado: "activo", inicioAt: v.inicioAt, venceAt: v.venceAt, aviso7dAt: null, aviso1dAt: null, avisoVencidoAt: null });
    if (v.propertySlug !== undefined) s.propertySlug = v.propertySlug;
    if (v.propertyId !== undefined) s.propertyId = v.propertyId;
    this.anotar(id, "activacion", v.inicioAt, v.venceAt, s.txId);
    return s;
  }

  async renovar(
    id: string,
    v: { inicioAt: string | null; venceAt: string },
    venceEsperado: string | null,
    origen: { tipo?: Extract<TipoPeriodo, "renovacion" | "suma_manual">; txId?: string | null } = {},
  ): Promise<Servicio | null> {
    const s = this.filas.find((x) => x.id === id);
    const igual = (a: string | null, b: string | null) => (a && b ? new Date(a).getTime() === new Date(b).getTime() : a === b);
    if (!s || !igual(s.venceAt, venceEsperado)) return null;
    Object.assign(s, { estado: "activo", venceAt: v.venceAt, aviso7dAt: null, aviso1dAt: null, avisoVencidoAt: null });
    if (v.inicioAt) s.inicioAt = v.inicioAt;
    this.anotar(id, origen.tipo ?? "renovacion", v.inicioAt ?? venceEsperado ?? new Date(this.now()).toISOString(), v.venceAt, origen.txId);
    return s;
  }

  async marcarVencido(id: string, opts: { forzar?: boolean; ahora?: Date; sinPeriodo?: boolean } = {}): Promise<void> {
    const s = this.filas.find((x) => x.id === id);
    if (!s) return;
    const ahora = opts.ahora ?? new Date(this.now());
    if (opts.forzar) {
      if (!opts.sinPeriodo && s.venceAt && new Date(s.venceAt).getTime() > ahora.getTime()) this.anotar(id, "recorte", ahora.toISOString(), s.venceAt);
      s.estado = "vencido";
      s.venceAt = ahora.toISOString();
    } else if (s.venceAt && new Date(s.venceAt).getTime() <= ahora.getTime()) {
      s.estado = "vencido";
    }
  }

  async marcarAviso(id: string, tipo: TipoAviso): Promise<void> {
    const s = this.filas.find((x) => x.id === id);
    if (!s) return;
    const ahora = new Date(this.now()).toISOString();
    if (tipo === "7d") s.aviso7dAt = ahora;
    if (tipo === "1d") s.aviso1dAt = ahora;
    if (tipo === "vencido") s.avisoVencidoAt = ahora;
  }

  async asignarFicha(id: string, propertySlug: string | null, propertyId?: string | null): Promise<void> {
    const s = this.filas.find((x) => x.id === id);
    if (!s) return;
    s.propertySlug = propertySlug;
    if (propertyId !== undefined) s.propertyId = propertyId;
  }

  async renombrarFicha(slugAnterior: string, slugNuevo: string): Promise<number> {
    let n = 0;
    for (const s of this.filas) {
      if (s.propertySlug !== slugAnterior) continue;
      s.propertySlug = slugNuevo;
      n++;
    }
    return n;
  }

  async asignarContacto(id: string, contactoId: string): Promise<void> {
    const s = this.filas.find((x) => x.id === id);
    if (s) s.contactoId = contactoId;
  }

  async fijarPagadoAt(id: string, pagadoAt: string): Promise<void> {
    const s = this.filas.find((x) => x.id === id);
    if (s && !s.pagadoAt) s.pagadoAt = pagadoAt;
  }

  async periodos(servicioId: string): Promise<Periodo[]> {
    return this.libro.filter((p) => p.servicioId === servicioId).sort((a, b) => a.id - b.id);
  }

  async descartar(id: string): Promise<boolean> {
    const s = this.filas.find((x) => x.id === id);
    if (!s || (s.estado !== "pendiente_publicar" && s.estado !== "vencido")) return false;
    s.estado = "descartado";
    return true;
  }

  async restaurar(id: string): Promise<boolean> {
    const s = this.filas.find((x) => x.id === id);
    if (!s || s.estado !== "descartado") return false;
    s.estado = s.venceAt ? "vencido" : "pendiente_publicar";
    return true;
  }
}

// Guardado en globalThis para que, sin Supabase (desarrollo), páginas, acciones y rutas compartan el mismo almacén en memoria.
const global = globalThis as typeof globalThis & { __serviciosStore?: ServiciosStore };

export function getServiciosStore(): ServiciosStore {
  if (!global.__serviciosStore) {
    global.__serviciosStore = isSupabaseConfigured() ? new SupabaseServiciosStore() : new MemoryServiciosStore();
  }
  return global.__serviciosStore;
}
