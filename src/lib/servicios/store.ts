import { getSupabaseAdmin, isSupabaseConfigured } from "@/lib/data/supabase/client";
import type { EstadoServicio, Servicio, TipoAviso } from "./vigencia";

export interface NuevoServicio {
  txId: string;
  reference: string | null;
  planId: string;
  dias: number;
  clienteEmail: string | null;
  clienteNombre: string | null;
  clienteTelefono: string | null;
}

/** La tabla no existe todavía (falta aplicar supabase/migrations/0004). */
export class ServiciosNoDisponibleError extends Error {}
export class ServiciosStoreError extends Error {}

export interface ServiciosStore {
  /** Idempotente por tx_id: repetir el pago aprobado no crea otro servicio. */
  registrar(n: NuevoServicio): Promise<{ servicio: Servicio; creado: boolean }>;
  listar(): Promise<Servicio[]>;
  /** Solo lo que el cron diario necesita mirar: activos y vencidos sin su aviso de vencimiento (sin el tope del panel). */
  listarParaRevision(): Promise<Servicio[]>;
  obtener(id: string): Promise<Servicio | null>;
  /** Fija la ventana de vigencia y deja el servicio activo (opcionalmente enlazado a una ficha). */
  activar(id: string, v: { propertySlug?: string | null; inicioAt: string; venceAt: string }): Promise<Servicio | null>;
  /** Extiende la vigencia y limpia los avisos para que se vuelvan a enviar. */
  renovar(id: string, v: { inicioAt: string | null; venceAt: string }): Promise<Servicio | null>;
  /**
   * Pasa a vencido. Sin `forzar` solo si la fecha de vencimiento ya pasó (así una renovación
   * hecha mientras corría el cron no se pisa). Con `forzar` vence ya y recorta vence_at a ahora.
   */
  marcarVencido(id: string, opts?: { forzar?: boolean; ahora?: Date }): Promise<void>;
  marcarAviso(id: string, tipo: TipoAviso): Promise<void>;
  asignarFicha(id: string, propertySlug: string | null): Promise<void>;
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
};

const COLUMNAS =
  "id, tx_id, reference, plan_id, dias, cliente_email, cliente_nombre, cliente_telefono, estado, property_slug, inicio_at, vence_at, aviso_7d_at, aviso_1d_at, aviso_vencido_at, created_at";

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

  async activar(id: string, v: { propertySlug?: string | null; inicioAt: string; venceAt: string }): Promise<Servicio | null> {
    const patch: Record<string, unknown> = {
      estado: "activo",
      inicio_at: v.inicioAt,
      vence_at: v.venceAt,
      aviso_7d_at: null,
      aviso_1d_at: null,
      aviso_vencido_at: null,
    };
    if (v.propertySlug !== undefined) patch.property_slug = v.propertySlug;
    const { data, error } = await getSupabaseAdmin().from("servicios_publicacion").update(patch).eq("id", id).select(COLUMNAS).maybeSingle();
    if (error) falla("activar", error);
    return data ? aServicio(data as Row) : null;
  }

  async renovar(id: string, v: { inicioAt: string | null; venceAt: string }): Promise<Servicio | null> {
    const patch: Record<string, unknown> = {
      estado: "activo",
      vence_at: v.venceAt,
      aviso_7d_at: null,
      aviso_1d_at: null,
      aviso_vencido_at: null,
    };
    if (v.inicioAt) patch.inicio_at = v.inicioAt;
    const { data, error } = await getSupabaseAdmin().from("servicios_publicacion").update(patch).eq("id", id).select(COLUMNAS).maybeSingle();
    if (error) falla("renovar", error);
    return data ? aServicio(data as Row) : null;
  }

  async marcarVencido(id: string, opts: { forzar?: boolean; ahora?: Date } = {}): Promise<void> {
    const ahora = (opts.ahora ?? new Date()).toISOString();
    const base = getSupabaseAdmin().from("servicios_publicacion");
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

  async asignarFicha(id: string, propertySlug: string | null): Promise<void> {
    const { error } = await getSupabaseAdmin().from("servicios_publicacion").update({ property_slug: propertySlug }).eq("id", id);
    if (error) falla("asignarFicha", error);
  }
}

/** Store en memoria con la misma semántica: pruebas y desarrollo sin Supabase. */
export class MemoryServiciosStore implements ServiciosStore {
  filas: Servicio[] = [];
  private seq = 1;
  now = () => Date.now();

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

  async activar(id: string, v: { propertySlug?: string | null; inicioAt: string; venceAt: string }): Promise<Servicio | null> {
    const s = this.filas.find((x) => x.id === id);
    if (!s) return null;
    Object.assign(s, { estado: "activo", inicioAt: v.inicioAt, venceAt: v.venceAt, aviso7dAt: null, aviso1dAt: null, avisoVencidoAt: null });
    if (v.propertySlug !== undefined) s.propertySlug = v.propertySlug;
    return s;
  }

  async renovar(id: string, v: { inicioAt: string | null; venceAt: string }): Promise<Servicio | null> {
    const s = this.filas.find((x) => x.id === id);
    if (!s) return null;
    Object.assign(s, { estado: "activo", venceAt: v.venceAt, aviso7dAt: null, aviso1dAt: null, avisoVencidoAt: null });
    if (v.inicioAt) s.inicioAt = v.inicioAt;
    return s;
  }

  async marcarVencido(id: string, opts: { forzar?: boolean; ahora?: Date } = {}): Promise<void> {
    const s = this.filas.find((x) => x.id === id);
    if (!s) return;
    const ahora = opts.ahora ?? new Date(this.now());
    if (opts.forzar) {
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

  async asignarFicha(id: string, propertySlug: string | null): Promise<void> {
    const s = this.filas.find((x) => x.id === id);
    if (s) s.propertySlug = propertySlug;
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
