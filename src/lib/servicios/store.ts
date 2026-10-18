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

export interface ServiciosStore {
  /** true si la tabla existe (migración 0004 aplicada). Nunca lanza. */
  disponible(): Promise<boolean>;
  /** Reclama la aplicación de una renovación pagada: true solo la primera vez para ese tx_id. */
  registrarRenovacion(txId: string, servicioId: string): Promise<boolean>;
  /** Deshace el reclamo si la renovación no se pudo aplicar, para que el siguiente intento la retome. */
  liberarRenovacion(txId: string): Promise<void>;
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
  private seq = 1;
  private seqPeriodo = 1;
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
