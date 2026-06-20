import { randomUUID } from "node:crypto";
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
  type PublicProperty,
} from "@/lib/domain";
import { slugify } from "@/lib/utils/slug";
import { seedProperties } from "./seed";
import { matchesFilters, sortByRelevance } from "./filtering";
import type {
  AgentRepository,
  AppointmentRepository,
  LeadRepository,
  PropertyRepository,
  Repository,
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
    const property: Property = {
      ...input,
      id: randomUUID(),
      codigo: input.codigo ?? this.nextCodigo(),
      slug,
      creadoEn: now,
      actualizadoEn: now,
    };
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
    const updated: Property = {
      ...prev,
      ...patch,
      slug,
      id: prev.id,
      codigo: patch.codigo ?? prev.codigo,
      creadoEn: prev.creadoEn,
      actualizadoEn: new Date().toISOString(),
    };
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

  async list(): Promise<Lead[]> {
    return [...this.leads];
  }

  async updateStatus(id: string, estado: LeadStatus): Promise<Lead | null> {
    const lead = this.leads.find((l) => l.id === id);
    if (!lead) return null;
    lead.estado = estado;
    return lead;
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

  async updateStatus(id: string, estado: AppointmentStatus): Promise<Appointment | null> {
    const appt = this.appointments.find((a) => a.id === id);
    if (!appt) return null;
    appt.estado = estado;
    return appt;
  }

  async remove(id: string): Promise<boolean> {
    const idx = this.appointments.findIndex((a) => a.id === id);
    if (idx === -1) return false;
    this.appointments.splice(idx, 1);
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
  };
}
