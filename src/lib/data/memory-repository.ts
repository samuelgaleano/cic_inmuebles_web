import { randomUUID } from "node:crypto";
import { normalizarInmueble } from "@/lib/domain/normalizar";
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
  type PublicProperty,
  type Template,
  type TemplateInput,
} from "@/lib/domain";
import { slugify } from "@/lib/utils/slug";
import { seedProperties } from "./seed";
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

/**
 * Implementación en memoria del repositorio.
 *
 * Pensada para desarrollo y demostración: el catálogo arranca con los datos de
 * ejemplo y las mutaciones (crear/editar inmuebles, leads) viven en memoria
 * (se pierden al reiniciar el servidor). En producción se reemplaza por
 * SupabaseRepository, que implementa las mismas interfaces.
 */

class MemoryPropertyRepository implements PropertyRepository {
  constructor(private readonly properties: Property[]) {}

  async list(filters?: PropertyFilters): Promise<Property[]> {
    return this.properties.filter((p) => matchesFilters(p, filters)).sort(sortByRelevance);
  }

  async listPublic(filters?: PropertyFilters): Promise<PublicProperty[]> {
    const items = await this.list(filters);
    return items.filter((p) => p.publicado).map(toPublicProperty);
  }

  async getBySlug(slug: string): Promise<Property | null> {
    return this.properties.find((p) => p.slug === slug) ?? null;
  }

  async getById(id: string): Promise<Property | null> {
    return this.properties.find((p) => p.id === id) ?? null;
  }

  async getPublicBySlug(slug: string): Promise<PublicProperty | null> {
    const p = await this.getBySlug(slug);
    if (!p || !p.publicado) return null;
    return toPublicProperty(p);
  }

  async listCities(): Promise<string[]> {
    return [...new Set(this.properties.map((p) => p.ubicacion.ciudad))].sort();
  }

  private nextCodigo(): string {
    const max = this.properties.reduce((acc, p) => {
      const n = Number(p.codigo.replace(/\D/g, ""));
      return Number.isFinite(n) && n > acc ? n : acc;
    }, 0);
    return `CIC-${String(max + 1).padStart(4, "0")}`;
  }

  private uniqueSlug(base: string, ignoreId?: string): string {
    let slug = base || "inmueble";
    let i = 2;
    while (this.properties.some((p) => p.slug === slug && p.id !== ignoreId)) {
      slug = `${base}-${i++}`;
    }
    return slug;
  }

  async create(input: PropertyInput): Promise<Property> {
    const now = new Date().toISOString();
    const slug = this.uniqueSlug(input.slug ? slugify(input.slug) : slugify(input.titulo));
    const property: Property = normalizarInmueble({
      ...input,
      id: randomUUID(),
      codigo: input.codigo ?? this.nextCodigo(),
      slug,
      creadoEn: now,
      actualizadoEn: now,
    });
    this.properties.unshift(property);
    return property;
  }

  async update(id: string, patch: Partial<PropertyInput>): Promise<Property | null> {
    const idx = this.properties.findIndex((p) => p.id === id);
    if (idx === -1) return null;
    const prev = this.properties[idx];
    const slug = patch.slug
      ? this.uniqueSlug(slugify(patch.slug), id)
      : patch.titulo
        ? this.uniqueSlug(slugify(patch.titulo), id)
        : prev.slug;
    const updated: Property = normalizarInmueble({
      ...prev,
      ...patch,
      slug,
      id: prev.id,
      codigo: patch.codigo ?? prev.codigo,
      creadoEn: prev.creadoEn,
      actualizadoEn: new Date().toISOString(),
    });
    this.properties[idx] = updated;
    return updated;
  }

  async remove(id: string): Promise<boolean> {
    const idx = this.properties.findIndex((p) => p.id === id);
    if (idx === -1) return false;
    this.properties.splice(idx, 1);
    return true;
  }
}

class MemoryLeadRepository implements LeadRepository {
  private readonly leads: Lead[] = [];

  async create(input: LeadInput): Promise<Lead> {
    const lead: Lead = {
      ...input,
      id: randomUUID(),
      estado: "nuevo",
      creadoEn: new Date().toISOString(),
    };
    this.leads.unshift(lead);
    return lead;
  }

  async list(opciones?: ListarLeadsOpciones): Promise<Lead[]> {
    return this.ordenados().slice(0, Math.max(1, opciones?.limite ?? LEADS_LIMITE_POR_DEFECTO));
  }

  /** Más nuevos primero (como `order by created_at desc` en Supabase). */
  private ordenados(): Lead[] {
    return [...this.leads].sort((a, b) => b.creadoEn.localeCompare(a.creadoEn));
  }

  async getById(id: string): Promise<Lead | null> {
    return this.leads.find((l) => l.id === id) ?? null;
  }

  async listPage(opts: { pagina: number; porPagina: number; estado?: LeadStatus }): Promise<{ leads: Lead[]; total: number }> {
    const todos = this.ordenados().filter((l) => !opts.estado || l.estado === opts.estado);
    const desde = (Math.max(1, opts.pagina) - 1) * opts.porPagina;
    return { leads: todos.slice(desde, desde + opts.porPagina), total: todos.length };
  }

  async listarDeContacto(c: { contactoId: string; ids?: string[]; telefonos: string[]; email?: string }): Promise<Lead[]> {
    const ids = new Set(c.ids ?? []);
    const tels = new Set(c.telefonos.map((t) => t.trim()).filter(Boolean));
    const email = c.email?.trim().toLowerCase();
    return this.ordenados().filter((l) => ids.has(l.id) || tels.has(l.telefono.trim()) || Boolean(email && l.email?.toLowerCase() === email));
  }

  async listarDeInmueble(propertyId: string, slug: string): Promise<Lead[]> {
    return this.ordenados().filter((l) => l.propertyId === propertyId || Boolean(slug && l.propertySlug === slug));
  }

  async listarEntre(desde: string, hasta: string): Promise<Lead[]> {
    return this.ordenados().filter((l) => l.creadoEn >= desde && l.creadoEn < hasta);
  }

  async countSince(iso: string): Promise<number> {
    return this.leads.filter((l) => l.creadoEn >= iso).length;
  }

  async updateStatus(id: string, estado: LeadStatus): Promise<Lead | null> {
    const lead = this.leads.find((l) => l.id === id);
    if (!lead) return null;
    lead.estado = estado;
    return lead;
  }

  async marcarPrimerContacto(ids: string[], at: string): Promise<number> {
    let n = 0;
    for (const l of this.leads) {
      if (ids.includes(l.id) && !l.primerContactoAt) {
        l.primerContactoAt = new Date(at).toISOString();
        n += 1;
      }
    }
    return n;
  }

  async suprimir(ids: string[], at: string): Promise<number> {
    let n = 0;
    for (const l of this.leads) {
      if (!ids.includes(l.id)) continue;
      l.nombre = NOMBRE_SUPRIMIDO;
      l.telefono = "";
      for (const k of ["email", "mensaje", "preferencia", "ciudad"] as const) delete l[k];
      l.suprimidoAt = new Date(at).toISOString();
      n += 1;
    }
    return n;
  }

  async remove(id: string): Promise<boolean> {
    const idx = this.leads.findIndex((l) => l.id === id);
    if (idx === -1) return false;
    this.leads.splice(idx, 1);
    return true;
  }
}

class MemoryAgentRepository implements AgentRepository {
  private readonly agents: Agent[] = [
    {
      id: "a1",
      nombre: "Agente Master",
      email: "agente@cicinmuebles.com",
      telefono: "+57 300 000 0000",
      rol: "agente_master",
      activo: true,
      creadoEn: new Date().toISOString(),
    },
  ];
  private availability: AgentAvailability[] = [];

  async list(): Promise<Agent[]> {
    return [...this.agents];
  }

  async getById(id: string): Promise<Agent | null> {
    return this.agents.find((a) => a.id === id) ?? null;
  }

  async create(input: AgentInput): Promise<Agent> {
    const agent: Agent = { ...input, id: randomUUID(), creadoEn: new Date().toISOString() };
    this.agents.push(agent);
    return agent;
  }

  async update(id: string, patch: Partial<AgentInput>): Promise<Agent | null> {
    const agent = this.agents.find((a) => a.id === id);
    if (!agent) return null;
    Object.assign(agent, patch);
    return agent;
  }

  async remove(id: string): Promise<boolean> {
    const idx = this.agents.findIndex((a) => a.id === id);
    if (idx === -1) return false;
    this.agents.splice(idx, 1);
    this.availability = this.availability.filter((s) => s.agentId !== id);
    return true;
  }

  async listAvailability(agentId: string): Promise<AgentAvailability[]> {
    return this.availability.filter((s) => s.agentId === agentId);
  }

  async setAvailability(agentId: string, slots: AvailabilitySlot[]): Promise<void> {
    this.availability = this.availability.filter((s) => s.agentId !== agentId);
    for (const slot of slots) {
      this.availability.push({ ...slot, id: randomUUID(), agentId });
    }
  }
}

class MemoryAppointmentRepository implements AppointmentRepository {
  private readonly appointments: Appointment[] = [];

  async list(): Promise<Appointment[]> {
    return [...this.appointments].sort((a, b) => a.inicioEn.localeCompare(b.inicioEn));
  }

  async create(input: AppointmentInput): Promise<Appointment> {
    const appt: Appointment = {
      ...input,
      id: randomUUID(),
      estado: input.estado ?? "solicitada",
      creadoEn: new Date().toISOString(),
    };
    this.appointments.push(appt);
    return appt;
  }

  async getById(id: string): Promise<Appointment | null> {
    return this.appointments.find((a) => a.id === id) ?? null;
  }

  async updateStatus(id: string, estado: AppointmentStatus): Promise<Appointment | null> {
    const appt = this.appointments.find((a) => a.id === id);
    if (!appt) return null;
    appt.estado = estado;
    return appt;
  }

  async listarDe(c: { contactoId: string; leadIds: string[] }): Promise<Appointment[]> {
    return this.appointments
      .filter((a) => a.contactoId === c.contactoId || Boolean(a.leadId && c.leadIds.includes(a.leadId)))
      .sort((a, b) => a.inicioEn.localeCompare(b.inicioEn));
  }

  async suprimirDe(c: { contactoId: string; leadIds: string[] }): Promise<number> {
    let n = 0;
    for (const a of this.appointments) {
      if (a.contactoId !== c.contactoId && !(a.leadId && c.leadIds.includes(a.leadId))) continue;
      a.clienteNombre = NOMBRE_SUPRIMIDO;
      a.clienteTelefono = "";
      delete a.clienteEmail;
      delete a.notas;
      n += 1;
    }
    return n;
  }

  async remove(id: string): Promise<boolean> {
    const idx = this.appointments.findIndex((a) => a.id === id);
    if (idx === -1) return false;
    this.appointments.splice(idx, 1);
    return true;
  }
}

class MemoryTemplateRepository implements TemplateRepository {
  private readonly templates: Template[] = [
    {
      id: "t1",
      nombre: "Promesa de compraventa (ejemplo)",
      tipo: "promesa_compraventa",
      contenido:
        "PROMESA DE COMPRAVENTA\n\nEntre los suscritos, [VENDEDOR], identificado con C.C. [CC], y [COMPRADOR], identificado con C.C. [CC], se celebra la presente promesa de compraventa sobre el inmueble ubicado en [DIRECCIÓN], por valor de [PRECIO]...\n\n(Edita esta plantilla con el formato oficial de la inmobiliaria.)",
      creadoEn: new Date().toISOString(),
      actualizadoEn: new Date().toISOString(),
    },
  ];

  async list(): Promise<Template[]> {
    return [...this.templates].sort((a, b) => a.nombre.localeCompare(b.nombre));
  }

  async getById(id: string): Promise<Template | null> {
    return this.templates.find((t) => t.id === id) ?? null;
  }

  async create(input: TemplateInput): Promise<Template> {
    const now = new Date().toISOString();
    const tpl: Template = { ...input, id: randomUUID(), creadoEn: now, actualizadoEn: now };
    this.templates.push(tpl);
    return tpl;
  }

  async update(id: string, patch: Partial<TemplateInput>): Promise<Template | null> {
    const tpl = this.templates.find((t) => t.id === id);
    if (!tpl) return null;
    Object.assign(tpl, patch, { actualizadoEn: new Date().toISOString() });
    return tpl;
  }

  async remove(id: string): Promise<boolean> {
    const idx = this.templates.findIndex((t) => t.id === id);
    if (idx === -1) return false;
    this.templates.splice(idx, 1);
    return true;
  }
}

export function createMemoryRepository(): Repository {
  return {
    // copia para no mutar el arreglo de seed exportado
    properties: new MemoryPropertyRepository(seedProperties.map((p) => ({ ...p }))),
    leads: new MemoryLeadRepository(),
    agents: new MemoryAgentRepository(),
    appointments: new MemoryAppointmentRepository(),
    templates: new MemoryTemplateRepository(),
  };
}
