import {
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
  COLUMNAS_0012_LEADS,
  COLUMNAS_0012_PROPERTIES,
  faltaColumna,
  sinColumnas,
  leadInputToRow,
  leadRowToDomain,
  mediaInputToRows,
  propertyInputToRow,
  propertyRowToDomain,
  templateInputToRow,
  templateRowToDomain,
} from "./supabase/mappers";
import {
  SELECT_AGENTE,
  SELECT_CITA,
  SELECT_DISPONIBILIDAD,
  SELECT_INMUEBLE,
  SELECT_INMUEBLE_PUBLICO,
  SELECT_LEAD,
  SELECT_PLANTILLA,
  type AgentRow,
  type AppointmentRow,
  type AvailabilityInsert,
  type AvailabilityRow,
  type LeadRow,
  type PropertyRow,
  type PropertyRowLectura,
  type TemplateRow,
} from "./supabase/filas";
import { matchesFilters, sortByRelevance } from "./filtering";
import {
  LEADS_LIMITE_POR_DEFECTO,
  type AgentRepository,
  type AppointmentRepository,
  type LeadRepository,
  type ListarLeadsOpciones,
  type PropertyRepository,
  type Repository,
  type TemplateRepository,
} from "./repository";

/** Filas por pagina al listar leads: el tope por respuesta de la API de Supabase ("Max rows", 1.000 por defecto). */
const PAGINA_LEADS = 1000;

/**
 * Codigos con los que PostgREST/Postgres dicen que una funcion RPC no existe: la migracion 0014 aun no
 * se aplico en esa base. Solo en ese caso se usa el camino de respaldo; cualquier otro error se lanza.
 */
const CODIGOS_FUNCION_INEXISTENTE = new Set(["PGRST202", "42883"]);

export function esFuncionInexistente(error: { code?: string } | null | undefined): boolean {
  return Boolean(error?.code && CODIGOS_FUNCION_INEXISTENTE.has(error.code));
}

const avisadas = new Set<string>();
function avisarRespaldo(funcion: string): void {
  if (avisadas.has(funcion)) return;
  avisadas.add(funcion);
  console.warn(`[datos] la funcion ${funcion}() no existe en la base (falta aplicar 0014_infra.sql): se usa el camino sin transaccion.`);
}

type Resultado<T> = { data: T | null; error: unknown };

/**
 * Escribe una fila con las columnas de la migración 0012 y, si la base todavía no las tiene, repite la
 * escritura sin ellas: desplegar el código antes de aplicar la migración no debe frenar un lead ni el panel.
 */
async function escribirConRespaldo<T>(
  fila: Record<string, unknown>,
  columnas: readonly string[],
  escribir: (f: Record<string, unknown>) => PromiseLike<Resultado<T>>,
): Promise<Resultado<T>> {
  const r = await escribir(fila);
  if (!r.error || !faltaColumna(r.error, columnas)) return r;
  console.warn("[datos] la migración 0012 no está aplicada: se guarda sin sus columnas nuevas");
  return escribir(sinColumnas(fila, columnas));
}


/**
 * Implementación del repositorio sobre Supabase (PostgreSQL).
 *
 * Mantiene paridad con la versión en memoria. Para el volumen esperado
 * (decenas de inmuebles) el filtrado se hace en memoria tras traer el
 * catálogo, reutilizando exactamente la misma lógica.
 *
 * Cada consulta pide columnas explícitas (ver `supabase/filas.ts`): la lectura
 * pública no trae al servidor propietario, dirección, notas ni carpeta de Drive.
 */
class SupabasePropertyRepository implements PropertyRepository {
  private async fetchAll(soloPublicados = false): Promise<Property[]> {
    let q = getSupabaseAdmin().from("properties").select(soloPublicados ? SELECT_INMUEBLE_PUBLICO : SELECT_INMUEBLE);
    // El filtro viaja en la consulta: la lectura pública no trae borradores ni sus fotos.
    if (soloPublicados) q = q.eq("publicado", true);
    const { data, error } = await q.overrideTypes<PropertyRowLectura[], { merge: false }>();
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
      .select(SELECT_INMUEBLE)
      .eq("slug", slug)
      .maybeSingle()
      .overrideTypes<PropertyRow, { merge: false }>();
    if (error) throw error;
    return data ? propertyRowToDomain(data) : null;
  }

  async getById(id: string): Promise<Property | null> {
    const { data, error } = await getSupabaseAdmin()
      .from("properties")
      .select(SELECT_INMUEBLE)
      .eq("id", id)
      .maybeSingle()
      .overrideTypes<PropertyRow, { merge: false }>();
    if (error) throw error;
    return data ? propertyRowToDomain(data) : null;
  }

  async getPublicBySlug(slug: string): Promise<PublicProperty | null> {
    const { data, error } = await getSupabaseAdmin()
      .from("properties")
      .select(SELECT_INMUEBLE_PUBLICO)
      .eq("slug", slug)
      .eq("publicado", true)
      .maybeSingle()
      .overrideTypes<PropertyRowLectura, { merge: false }>();
    if (error) throw error;
    return data ? toPublicProperty(propertyRowToDomain(data)) : null;
  }

  async listCities(): Promise<string[]> {
    const { data, error } = await getSupabaseAdmin()
      .from("properties")
      .select("ciudad")
      .overrideTypes<Pick<PropertyRow, "ciudad">[], { merge: false }>();
    if (error) throw error;
    // Misma corrección que el mapper: "BogotÁ" y "Bogotá" son una sola ciudad en el filtro.
    return [...new Set((data ?? []).map((r) => formatLugar(r.ciudad) ?? ""))].filter(Boolean).sort();
  }

  /**
   * Siguiente código CIC-NNNN. Se calcula con el máximo NUMÉRICO de todos los códigos (son decenas):
   * ordenar el texto daría un máximo equivocado después de CIC-9999.
   */
  private async nextCodigo(): Promise<string> {
    const { data, error } = await getSupabaseAdmin()
      .from("properties")
      .select("codigo")
      .overrideTypes<Pick<PropertyRow, "codigo">[], { merge: false }>();
    if (error) throw error;
    const max = (data ?? []).reduce((acc, r) => {
      const n = Number(String(r.codigo ?? "").replace(/\D/g, ""));
      return Number.isFinite(n) && n > acc ? n : acc;
    }, 0);
    return `CIC-${String(max + 1).padStart(4, "0")}`;
  }

  private async uniqueSlug(base: string, ignoreId?: string): Promise<string> {
    const { data, error } = await getSupabaseAdmin()
      .from("properties")
      .select("id, slug")
      .like("slug", `${base}%`)
      .overrideTypes<Pick<PropertyRow, "id" | "slug">[], { merge: false }>();
    if (error) throw error;
    const taken = new Set((data ?? []).filter((r) => r.id !== ignoreId).map((r) => r.slug));
    if (!taken.has(base)) return base;
    let i = 2;
    while (taken.has(`${base}-${i}`)) i++;
    return `${base}-${i}`;
  }

  /**
   * Reemplaza los medios de un inmueble.
   *
   * Camino normal: la función `reemplazar_medios` (migración 0014) borra e inserta en UNA transacción,
   * así que si algo falla el inmueble conserva sus fotos anteriores.
   * Respaldo (base sin 0014): inserta primero las nuevas y solo después borra las anteriores por id,
   * revisando el error de cada paso. Un fallo a mitad deja fotos de más, nunca un inmueble sin fotos.
   */
  private async replaceMedia(propertyId: string, medios: PropertyMedia[]) {
    const db = getSupabaseAdmin();
    const filas = mediaInputToRows(propertyId, medios);
    const { error } = await db.rpc("reemplazar_medios", {
      p_property: propertyId,
      p_medios: filas.map(({ property_id: _propiedad, ...resto }) => resto),
    });
    if (!error) return;
    if (!esFuncionInexistente(error)) throw error;

    avisarRespaldo("reemplazar_medios");
    const previos = await db
      .from("property_media")
      .select("id")
      .eq("property_id", propertyId)
      .overrideTypes<{ id: string }[], { merge: false }>();
    if (previos.error) throw previos.error;
    if (filas.length > 0) {
      const insertado = await db.from("property_media").insert(filas);
      if (insertado.error) throw insertado.error;
    }
    const ids = (previos.data ?? []).map((r) => r.id);
    if (ids.length > 0) {
      const borrado = await db.from("property_media").delete().in("id", ids);
      if (borrado.error) throw borrado.error;
    }
  }

  async create(input: PropertyInput): Promise<Property> {
    const db = getSupabaseAdmin();
    const base = slugify(input.slug || input.titulo) || "inmueble";
    const [slug, codigo] = await Promise.all([this.uniqueSlug(base), this.nextCodigo()]);

    const { data, error } = await escribirConRespaldo<{ id: string }>(
      { ...propertyInputToRow(input), codigo: input.codigo ?? codigo, slug },
      COLUMNAS_0012_PROPERTIES,
      (fila) => db.from("properties").insert(fila).select("id").single(),
    );
    if (error || !data) throw error ?? new Error("No se pudo crear el inmueble.");

    const id = data.id;
    try {
      await this.replaceMedia(id, input.medios);
    } catch (err) {
      // Sin esto quedaría un inmueble creado sin sus fotos. Se deshace el alta (compensación) y se
      // propaga el error: el panel lo muestra y el siguiente intento parte de cero.
      const deshecho = await db.from("properties").delete().eq("id", id);
      if (deshecho.error) console.error("[datos] no se pudo deshacer el alta sin fotos:", deshecho.error.message);
      throw err;
    }

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

    const { error } = await escribirConRespaldo<null>(
      { ...propertyInputToRow(merged), slug },
      COLUMNAS_0012_PROPERTIES,
      (fila) => db.from("properties").update(fila).eq("id", id),
    );
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
    const db = getSupabaseAdmin();
    const { data, error } = await escribirConRespaldo<LeadRow>(leadInputToRow(input), COLUMNAS_0012_LEADS, (fila) =>
      db.from("leads").insert(fila).select(SELECT_LEAD).single().overrideTypes<LeadRow, { merge: false }>(),
    );
    if (error || !data) throw error ?? new Error("No se pudo crear el lead.");
    return leadRowToDomain(data);
  }

  /**
   * Los más recientes primero, hasta `limite`. Pagina de a 1.000 con un orden estable
   * (fecha y luego id) para no cortarse en el tope por respuesta de la API.
   */
  async list(opciones?: ListarLeadsOpciones): Promise<Lead[]> {
    const limite = Math.max(0, Math.floor(opciones?.limite ?? LEADS_LIMITE_POR_DEFECTO));
    const filas: LeadRow[] = [];
    while (filas.length < limite) {
      const desde = filas.length;
      const pedidas = Math.min(PAGINA_LEADS, limite - desde);
      const { data, error } = await getSupabaseAdmin()
        .from("leads")
        .select(SELECT_LEAD)
        .order("created_at", { ascending: false })
        .order("id", { ascending: false })
        .range(desde, desde + pedidas - 1)
        .overrideTypes<LeadRow[], { merge: false }>();
      if (error) throw error;
      const pagina = data ?? [];
      filas.push(...pagina);
      if (pagina.length < pedidas) break;
    }
    if (limite > 0 && filas.length >= limite) {
      console.warn(`[leads] el listado llegó al tope de ${limite}: los más antiguos no se incluyen.`);
    }
    return filas.map(leadRowToDomain);
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
      .select(SELECT_LEAD)
      .maybeSingle()
      .overrideTypes<LeadRow, { merge: false }>();
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
      .select(SELECT_AGENTE)
      .order("nombre")
      .overrideTypes<AgentRow[], { merge: false }>();
    if (error) throw error;
    return (data ?? []).map(agentRowToDomain);
  }

  async getById(id: string): Promise<Agent | null> {
    const { data, error } = await getSupabaseAdmin()
      .from("agents")
      .select(SELECT_AGENTE)
      .eq("id", id)
      .maybeSingle()
      .overrideTypes<AgentRow, { merge: false }>();
    if (error) throw error;
    return data ? agentRowToDomain(data) : null;
  }

  async create(input: AgentInput): Promise<Agent> {
    const { data, error } = await getSupabaseAdmin()
      .from("agents")
      .insert(agentInputToRow(input))
      .select(SELECT_AGENTE)
      .single()
      .overrideTypes<AgentRow, { merge: false }>();
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
      .select(SELECT_AGENTE)
      .maybeSingle()
      .overrideTypes<AgentRow, { merge: false }>();
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
      .select(SELECT_DISPONIBILIDAD)
      .eq("agent_id", agentId)
      .order("dia_semana")
      .overrideTypes<AvailabilityRow[], { merge: false }>();
    if (error) throw error;
    return (data ?? []).map(availabilityRowToDomain);
  }

  /**
   * Misma estrategia que los medios: `fijar_disponibilidad` (0014) en una transacción y, si la base
   * aún no la tiene, insertar las nuevas y luego borrar las anteriores por id, revisando cada error.
   */
  async setAvailability(agentId: string, slots: AvailabilitySlot[]): Promise<void> {
    const db = getSupabaseAdmin();
    const filas: AvailabilityInsert[] = slots.map((s) => ({
      agent_id: agentId,
      dia_semana: s.diaSemana,
      hora_inicio: s.horaInicio,
      hora_fin: s.horaFin,
    }));
    const { error } = await db.rpc("fijar_disponibilidad", {
      p_agent: agentId,
      p_slots: filas.map(({ agent_id: _agente, ...resto }) => resto),
    });
    if (!error) return;
    if (!esFuncionInexistente(error)) throw error;

    avisarRespaldo("fijar_disponibilidad");
    const previas = await db
      .from("agent_availability")
      .select("id")
      .eq("agent_id", agentId)
      .overrideTypes<{ id: string }[], { merge: false }>();
    if (previas.error) throw previas.error;
    if (filas.length > 0) {
      const insertado = await db.from("agent_availability").insert(filas);
      if (insertado.error) throw insertado.error;
    }
    const ids = (previas.data ?? []).map((r) => r.id);
    if (ids.length > 0) {
      const borrado = await db.from("agent_availability").delete().in("id", ids);
      if (borrado.error) throw borrado.error;
    }
  }
}

class SupabaseAppointmentRepository implements AppointmentRepository {
  async list(): Promise<Appointment[]> {
    const { data, error } = await getSupabaseAdmin()
      .from("appointments")
      .select(SELECT_CITA)
      .order("inicio_en")
      .overrideTypes<AppointmentRow[], { merge: false }>();
    if (error) throw error;
    return (data ?? []).map(appointmentRowToDomain);
  }

  async create(input: AppointmentInput): Promise<Appointment> {
    const { data, error } = await getSupabaseAdmin()
      .from("appointments")
      .insert(appointmentInputToRow(input))
      .select(SELECT_CITA)
      .single()
      .overrideTypes<AppointmentRow, { merge: false }>();
    if (error) throw error;
    return appointmentRowToDomain(data);
  }

  async updateStatus(id: string, estado: AppointmentStatus): Promise<Appointment | null> {
    const { data, error } = await getSupabaseAdmin()
      .from("appointments")
      .update({ estado })
      .eq("id", id)
      .select(SELECT_CITA)
      .maybeSingle()
      .overrideTypes<AppointmentRow, { merge: false }>();
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
    const { data, error } = await getSupabaseAdmin()
      .from("templates")
      .select(SELECT_PLANTILLA)
      .order("nombre")
      .overrideTypes<TemplateRow[], { merge: false }>();
    if (error) throw error;
    return (data ?? []).map(templateRowToDomain);
  }

  async getById(id: string): Promise<Template | null> {
    const { data, error } = await getSupabaseAdmin()
      .from("templates")
      .select(SELECT_PLANTILLA)
      .eq("id", id)
      .maybeSingle()
      .overrideTypes<TemplateRow, { merge: false }>();
    if (error) throw error;
    return data ? templateRowToDomain(data) : null;
  }

  async create(input: TemplateInput): Promise<Template> {
    const { data, error } = await getSupabaseAdmin()
      .from("templates")
      .insert(templateInputToRow(input))
      .select(SELECT_PLANTILLA)
      .single()
      .overrideTypes<TemplateRow, { merge: false }>();
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
      .select(SELECT_PLANTILLA)
      .maybeSingle()
      .overrideTypes<TemplateRow, { merge: false }>();
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
