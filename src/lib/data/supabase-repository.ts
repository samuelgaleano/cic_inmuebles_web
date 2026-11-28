import {
  NOMBRE_SUPRIMIDO,
  toPublicProperty,
  type Agent,
  type AgentAvailability,
  type AgentInput,
  type Appointment,
  type AppointmentInput,
  type AppointmentStatus,
  type AvailabilitySlot,
  type Lead,
  type LeadInput,
  type LeadStatus,
  type Property,
  type PropertyFilters,
  type PropertyInput,
  type PropertyMedia,
  type PublicProperty,
  type Template,
  type TemplateInput,
} from "@/lib/domain";
import { formatLugar } from "@/lib/utils/lugar";
import { slugify } from "@/lib/utils/slug";
import { getSupabaseAdmin } from "./supabase/client";
import {
  agentInputToRow,
  agentRowToDomain,
  appointmentInputToRow,
  appointmentRowToDomain,
  availabilityRowToDomain,
  leadInputToRow,
  leadRowToDomain,
  mediaInputToRows,
  propertyInputToRow,
  propertyRowToDomain,
  templateInputToRow,
  templateRowToDomain,
} from "./supabase/mappers";
import { matchesFilters, sortByRelevance } from "./filtering";
import type {
  AgentRepository,
  AppointmentRepository,
  LeadRepository,
  PropertyRepository,
  Repository,
  TemplateRepository,
} from "./repository";

const PROPERTY_SELECT = "*, property_media(*)";

const UUID = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;
const NOMBRE_SUPRIMIDO_LEAD = NOMBRE_SUPRIMIDO;

/** La columna todavía no existe (migración sin aplicar): 42703 de Postgres o PGRST204 de la caché de PostgREST. */
function faltaColumna(error: { message: string; code?: string }, columna: string): boolean {
  return (error.code === "42703" || error.code === "PGRST204" || /schema cache|does not exist/i.test(error.message)) && error.message.includes(columna);
}

/**
 * Implementación del repositorio sobre Supabase (PostgreSQL).
 *
 * Mantiene paridad con la versión en memoria. Para el volumen esperado
 * (decenas de inmuebles) el filtrado se hace en memoria tras traer el
 * catálogo, reutilizando exactamente la misma lógica.
 */
class SupabasePropertyRepository implements PropertyRepository {
  private async fetchAll(soloPublicados = false): Promise<Property[]> {
    let q = getSupabaseAdmin().from("properties").select(PROPERTY_SELECT);
    // El filtro viaja en la consulta: la lectura pública no trae borradores ni sus fotos.
    if (soloPublicados) q = q.eq("publicado", true);
    const { data, error } = await q;
    if (error) throw error;
    return (data ?? []).map(propertyRowToDomain);
  }

  async list(filters?: PropertyFilters): Promise<Property[]> {
    const all = await this.fetchAll();
    return all.filter((p) => matchesFilters(p, filters)).sort(sortByRelevance);
  }

  async listPublic(filters?: PropertyFilters): Promise<PublicProperty[]> {
    const items = (await this.fetchAll(true)).filter((p) => matchesFilters(p, filters)).sort(sortByRelevance);
    return items.filter((p) => p.publicado).map(toPublicProperty);
  }

  async getBySlug(slug: string): Promise<Property | null> {
    const { data, error } = await getSupabaseAdmin()
      .from("properties")
      .select(PROPERTY_SELECT)
      .eq("slug", slug)
      .maybeSingle();
    if (error) throw error;
    return data ? propertyRowToDomain(data) : null;
  }

  async getById(id: string): Promise<Property | null> {
    const { data, error } = await getSupabaseAdmin()
      .from("properties")
      .select(PROPERTY_SELECT)
      .eq("id", id)
      .maybeSingle();
    if (error) throw error;
    return data ? propertyRowToDomain(data) : null;
  }

  async getPublicBySlug(slug: string): Promise<PublicProperty | null> {
    const p = await this.getBySlug(slug);
    if (!p || !p.publicado) return null;
    return toPublicProperty(p);
  }

  async listCities(): Promise<string[]> {
    const { data, error } = await getSupabaseAdmin().from("properties").select("ciudad");
    if (error) throw error;
    // Misma corrección que el mapper: "BogotÁ" y "Bogotá" son una sola ciudad en el filtro.
    return [...new Set((data ?? []).map((r) => formatLugar(r.ciudad as string) ?? ""))].filter(Boolean).sort();
  }

  private async nextCodigo(): Promise<string> {
    const { data } = await getSupabaseAdmin()
      .from("properties")
      .select("codigo")
      .order("codigo", { ascending: false })
      .limit(1);
    const last = data?.[0]?.codigo as string | undefined;
    const n = last ? Number(last.replace(/\D/g, "")) || 0 : 0;
    return `CIC-${String(n + 1).padStart(4, "0")}`;
  }

  private async uniqueSlug(base: string, ignoreId?: string): Promise<string> {
    const { data } = await getSupabaseAdmin()
      .from("properties")
      .select("id, slug")
      .like("slug", `${base}%`);
    const taken = new Set((data ?? []).filter((r) => r.id !== ignoreId).map((r) => r.slug));
    if (!taken.has(base)) return base;
    let i = 2;
    while (taken.has(`${base}-${i}`)) i++;
    return `${base}-${i}`;
  }

  private async replaceMedia(propertyId: string, medios: PropertyMedia[]) {
    const db = getSupabaseAdmin();
    await db.from("property_media").delete().eq("property_id", propertyId);
    if (medios.length > 0) {
      const { error } = await db.from("property_media").insert(mediaInputToRows(propertyId, medios));
      if (error) throw error;
    }
  }

  async create(input: PropertyInput): Promise<Property> {
    const db = getSupabaseAdmin();
    const base = slugify(input.slug || input.titulo) || "inmueble";
    const [slug, codigo] = await Promise.all([this.uniqueSlug(base), this.nextCodigo()]);

    const { data, error } = await db
      .from("properties")
      .insert({ ...propertyInputToRow(input), codigo: input.codigo ?? codigo, slug })
      .select("id")
      .single();
    if (error) throw error;

    const id = data.id as string;
    await this.replaceMedia(id, input.medios);

    const created = await this.getById(id);
    if (!created) throw new Error("No se pudo recuperar el inmueble creado.");
    return created;
  }

  async update(id: string, patch: Partial<PropertyInput>): Promise<Property | null> {
    const db = getSupabaseAdmin();
    const current = await this.getById(id);
    if (!current) return null;

    const merged: PropertyInput = {
      ...current,
      ...patch,
      ubicacion: { ...current.ubicacion, ...patch.ubicacion },
      caracteristicas: { ...current.caracteristicas, ...patch.caracteristicas },
    };

    const base = slugify(patch.slug || patch.titulo || current.slug) || current.slug;
    const slug = await this.uniqueSlug(base, id);

    const { error } = await db
      .from("properties")
      .update({ ...propertyInputToRow(merged), slug })
      .eq("id", id);
    if (error) throw error;

    if (patch.medios) await this.replaceMedia(id, patch.medios);

    return this.getById(id);
  }

  async remove(id: string): Promise<boolean> {
    const { error } = await getSupabaseAdmin().from("properties").delete().eq("id", id);
    if (error) throw error;
    return true;
  }
}

class SupabaseLeadRepository implements LeadRepository {
  async create(input: LeadInput): Promise<Lead> {
    const { data, error } = await getSupabaseAdmin()
      .from("leads")
      .insert(leadInputToRow(input))
      .select("*")
      .single();
    if (error) throw error;
    return leadRowToDomain(data);
  }

  async list(opts: { limite?: number } = {}): Promise<Lead[]> {
    const { data, error } = await getSupabaseAdmin()
      .from("leads")
      .select("*")
      .order("created_at", { ascending: false })
      .limit(Math.max(1, opts.limite ?? 1000));
    if (error) throw error;
    return (data ?? []).map(leadRowToDomain);
  }

  async getById(id: string): Promise<Lead | null> {
    if (!UUID.test(id)) return null;
    const { data, error } = await getSupabaseAdmin().from("leads").select("*").eq("id", id).maybeSingle();
    if (error) throw error;
    return data ? leadRowToDomain(data) : null;
  }

  async listPage(opts: { pagina: number; porPagina: number; estado?: LeadStatus }): Promise<{ leads: Lead[]; total: number }> {
    const desde = (Math.max(1, opts.pagina) - 1) * opts.porPagina;
    let q = getSupabaseAdmin().from("leads").select("*", { count: "exact" });
    if (opts.estado) q = q.eq("estado", opts.estado);
    const { data, error, count } = await q.order("created_at", { ascending: false }).order("id").range(desde, desde + opts.porPagina - 1);
    if (error) {
      // Página más allá del final.
      if (error.code === "PGRST103") return { leads: [], total: 0 };
      throw error;
    }
    return { leads: (data ?? []).map(leadRowToDomain), total: count ?? 0 };
  }

  async listarDeContacto(c: { contactoId: string; ids?: string[]; telefonos: string[]; email?: string }): Promise<Lead[]> {
    const db = getSupabaseAdmin();
    const consultas = [];
    // Tres consultas por llave en vez de leer todos los leads y filtrar.
    if (UUID.test(c.contactoId)) consultas.push(db.from("leads").select("*").eq("contacto_id", c.contactoId).limit(200));
    const ids = (c.ids ?? []).filter((id) => UUID.test(id)).slice(0, 100);
    if (ids.length) consultas.push(db.from("leads").select("*").in("id", ids).limit(200));
    const tels = [...new Set(c.telefonos.map((t) => t.trim()).filter(Boolean))];
    if (tels.length) consultas.push(db.from("leads").select("*").in("telefono", tels).limit(200));
    if (c.email?.trim()) consultas.push(db.from("leads").select("*").ilike("email", c.email.trim().replace(/[%_\\]/g, "\\$&")).limit(200));
    const porId = new Map<string, Lead>();
    for (const r of await Promise.all(consultas)) {
      // Sin leads.contacto_id (0008 sin aplicar) se sigue con teléfono y correo.
      if (r.error) {
        if (/contacto_id/i.test(r.error.message)) continue;
        throw r.error;
      }
      for (const row of r.data ?? []) porId.set(row.id, leadRowToDomain(row));
    }
    return [...porId.values()].sort((a, b) => b.creadoEn.localeCompare(a.creadoEn));
  }

  async listarDeInmueble(propertyId: string, slug: string): Promise<Lead[]> {
    const db = getSupabaseAdmin();
    const [porId, porSlug] = await Promise.all([
      UUID.test(propertyId) ? db.from("leads").select("*").eq("property_id", propertyId).limit(200) : Promise.resolve({ data: [], error: null }),
      slug ? db.from("leads").select("*").eq("property_slug", slug).limit(200) : Promise.resolve({ data: [], error: null }),
    ]);
    if (porId.error) throw porId.error;
    if (porSlug.error) throw porSlug.error;
    const todos = new Map<string, Lead>();
    for (const row of [...(porId.data ?? []), ...(porSlug.data ?? [])]) todos.set(row.id, leadRowToDomain(row));
    return [...todos.values()].sort((a, b) => b.creadoEn.localeCompare(a.creadoEn));
  }

  async listarEntre(desde: string, hasta: string): Promise<Lead[]> {
    const { data, error } = await getSupabaseAdmin()
      .from("leads")
      .select("*")
      .gte("created_at", desde)
      .lt("created_at", hasta)
      .order("created_at", { ascending: false })
      .limit(5000);
    if (error) throw error;
    return (data ?? []).map(leadRowToDomain);
  }

  async marcarPrimerContacto(ids: string[], at: string): Promise<number> {
    const validos = ids.filter((id) => UUID.test(id));
    if (!validos.length) return 0;
    const { data, error } = await getSupabaseAdmin()
      .from("leads")
      .update({ primer_contacto_at: at })
      .in("id", validos)
      .is("primer_contacto_at", null)
      .select("id");
    if (error) {
      // Sin la migración 0012 no hay dónde guardarlo: el panel sigue igual.
      if (faltaColumna(error, "primer_contacto_at")) return 0;
      throw error;
    }
    return (data ?? []).length;
  }

  async suprimir(ids: string[], at: string): Promise<number> {
    const validos = ids.filter((id) => UUID.test(id));
    if (!validos.length) return 0;
    const base = { nombre: NOMBRE_SUPRIMIDO_LEAD, telefono: "", email: null, mensaje: null, preferencia: null, ciudad: null };
    const db = getSupabaseAdmin();
    let r = await db.from("leads").update({ ...base, suprimido_at: at }).in("id", validos).select("id");
    if (r.error && faltaColumna(r.error, "suprimido_at")) {
      r = await db.from("leads").update({ ...base, estado: "descartado" }).in("id", validos).select("id");
    }
    if (r.error) throw r.error;
    return (r.data ?? []).length;
  }

  async countSince(iso: string): Promise<number> {
    const { count, error } = await getSupabaseAdmin()
      .from("leads")
      .select("id", { count: "exact", head: true })
      .gte("created_at", iso);
    if (error) throw error;
    return count ?? 0;
  }

  async updateStatus(id: string, estado: LeadStatus): Promise<Lead | null> {
    const { data, error } = await getSupabaseAdmin()
      .from("leads")
      .update({ estado })
      .eq("id", id)
      .select("*")
      .maybeSingle();
    if (error) throw error;
    return data ? leadRowToDomain(data) : null;
  }

  async remove(id: string): Promise<boolean> {
    const { error } = await getSupabaseAdmin().from("leads").delete().eq("id", id);
    if (error) throw error;
    return true;
  }
}

class SupabaseAgentRepository implements AgentRepository {
  async list(): Promise<Agent[]> {
    const { data, error } = await getSupabaseAdmin()
      .from("agents")
      .select("*")
      .order("nombre");
    if (error) throw error;
    return (data ?? []).map(agentRowToDomain);
  }

  async getById(id: string): Promise<Agent | null> {
    const { data, error } = await getSupabaseAdmin()
      .from("agents")
      .select("*")
      .eq("id", id)
      .maybeSingle();
    if (error) throw error;
    return data ? agentRowToDomain(data) : null;
  }

  async create(input: AgentInput): Promise<Agent> {
    const { data, error } = await getSupabaseAdmin()
      .from("agents")
      .insert(agentInputToRow(input))
      .select("*")
      .single();
    if (error) throw error;
    return agentRowToDomain(data);
  }

  async update(id: string, patch: Partial<AgentInput>): Promise<Agent | null> {
    const current = await this.getById(id);
    if (!current) return null;
    const { data, error } = await getSupabaseAdmin()
      .from("agents")
      .update(agentInputToRow({ ...current, ...patch }))
      .eq("id", id)
      .select("*")
      .maybeSingle();
    if (error) throw error;
    return data ? agentRowToDomain(data) : null;
  }

  async remove(id: string): Promise<boolean> {
    const { error } = await getSupabaseAdmin().from("agents").delete().eq("id", id);
    if (error) throw error;
    return true;
  }

  async listAvailability(agentId: string): Promise<AgentAvailability[]> {
    const { data, error } = await getSupabaseAdmin()
      .from("agent_availability")
      .select("*")
      .eq("agent_id", agentId)
      .order("dia_semana");
    if (error) throw error;
    return (data ?? []).map(availabilityRowToDomain);
  }

  async setAvailability(agentId: string, slots: AvailabilitySlot[]): Promise<void> {
    const db = getSupabaseAdmin();
    await db.from("agent_availability").delete().eq("agent_id", agentId);
    if (slots.length > 0) {
      const rows = slots.map((s) => ({
        agent_id: agentId,
        dia_semana: s.diaSemana,
        hora_inicio: s.horaInicio,
        hora_fin: s.horaFin,
      }));
      const { error } = await db.from("agent_availability").insert(rows);
      if (error) throw error;
    }
  }
}

class SupabaseAppointmentRepository implements AppointmentRepository {
  async list(): Promise<Appointment[]> {
    const { data, error } = await getSupabaseAdmin()
      .from("appointments")
      .select("*")
      .order("inicio_en");
    if (error) throw error;
    return (data ?? []).map(appointmentRowToDomain);
  }

  async getById(id: string): Promise<Appointment | null> {
    if (!UUID.test(id)) return null;
    const { data, error } = await getSupabaseAdmin().from("appointments").select("*").eq("id", id).maybeSingle();
    if (error) throw error;
    return data ? appointmentRowToDomain(data) : null;
  }

  async create(input: AppointmentInput): Promise<Appointment> {
    const db = getSupabaseAdmin();
    let r = await db.from("appointments").insert(appointmentInputToRow(input)).select("*").single();
    // Sin appointments.contacto_id (0013 sin aplicar) la cita se guarda igual, sin la persona.
    if (r.error && input.contactoId && faltaColumna(r.error, "contacto_id")) {
      r = await db.from("appointments").insert(appointmentInputToRow({ ...input, contactoId: undefined })).select("*").single();
    }
    if (r.error) throw r.error;
    return appointmentRowToDomain(r.data);
  }

  async listarDe(c: { contactoId: string; leadIds: string[] }): Promise<Appointment[]> {
    const db = getSupabaseAdmin();
    const porId = new Map<string, Appointment>();
    if (UUID.test(c.contactoId)) {
      const r = await db.from("appointments").select("*").eq("contacto_id", c.contactoId).limit(200);
      // Sin la columna (0013 sin aplicar) quedan las de sus leads.
      if (r.error && !faltaColumna(r.error, "contacto_id")) throw r.error;
      for (const row of r.data ?? []) porId.set(row.id, appointmentRowToDomain(row));
    }
    const leads = c.leadIds.filter((id) => UUID.test(id)).slice(0, 100);
    if (leads.length) {
      const r = await db.from("appointments").select("*").in("lead_id", leads).limit(200);
      if (r.error) throw r.error;
      for (const row of r.data ?? []) porId.set(row.id, appointmentRowToDomain(row));
    }
    return [...porId.values()].sort((a, b) => a.inicioEn.localeCompare(b.inicioEn));
  }

  async suprimirDe(c: { contactoId: string; leadIds: string[] }): Promise<number> {
    const db = getSupabaseAdmin();
    const patch = { cliente_nombre: NOMBRE_SUPRIMIDO, cliente_telefono: "", cliente_email: null, notas: null };
    let n = 0;
    if (UUID.test(c.contactoId)) {
      const r = await db.from("appointments").update(patch).eq("contacto_id", c.contactoId).select("id");
      if (r.error && !faltaColumna(r.error, "contacto_id")) throw r.error;
      n += (r.data ?? []).length;
    }
    const leads = c.leadIds.filter((id) => UUID.test(id));
    if (leads.length) {
      const r = await db.from("appointments").update(patch).in("lead_id", leads).select("id");
      if (r.error) throw r.error;
      n += (r.data ?? []).length;
    }
    return n;
  }

  async updateStatus(id: string, estado: AppointmentStatus): Promise<Appointment | null> {
    const { data, error } = await getSupabaseAdmin()
      .from("appointments")
      .update({ estado })
      .eq("id", id)
      .select("*")
      .maybeSingle();
    if (error) throw error;
    return data ? appointmentRowToDomain(data) : null;
  }

  async remove(id: string): Promise<boolean> {
    const { error } = await getSupabaseAdmin().from("appointments").delete().eq("id", id);
    if (error) throw error;
    return true;
  }
}

class SupabaseTemplateRepository implements TemplateRepository {
  async list(): Promise<Template[]> {
    const { data, error } = await getSupabaseAdmin().from("templates").select("*").order("nombre");
    if (error) throw error;
    return (data ?? []).map(templateRowToDomain);
  }

  async getById(id: string): Promise<Template | null> {
    const { data, error } = await getSupabaseAdmin()
      .from("templates")
      .select("*")
      .eq("id", id)
      .maybeSingle();
    if (error) throw error;
    return data ? templateRowToDomain(data) : null;
  }

  async create(input: TemplateInput): Promise<Template> {
    const { data, error } = await getSupabaseAdmin()
      .from("templates")
      .insert(templateInputToRow(input))
      .select("*")
      .single();
    if (error) throw error;
    return templateRowToDomain(data);
  }

  async update(id: string, patch: Partial<TemplateInput>): Promise<Template | null> {
    const current = await this.getById(id);
    if (!current) return null;
    const { data, error } = await getSupabaseAdmin()
      .from("templates")
      .update(templateInputToRow({ ...current, ...patch }))
      .eq("id", id)
      .select("*")
      .maybeSingle();
    if (error) throw error;
    return data ? templateRowToDomain(data) : null;
  }

  async remove(id: string): Promise<boolean> {
    const { error } = await getSupabaseAdmin().from("templates").delete().eq("id", id);
    if (error) throw error;
    return true;
  }
}

export function createSupabaseRepository(): Repository {
  return {
    properties: new SupabasePropertyRepository(),
    leads: new SupabaseLeadRepository(),
    agents: new SupabaseAgentRepository(),
    appointments: new SupabaseAppointmentRepository(),
    templates: new SupabaseTemplateRepository(),
  };
}
