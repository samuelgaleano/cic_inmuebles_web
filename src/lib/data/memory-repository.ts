import { randomUUID } from "node:crypto";
import {
  toPublicProperty,
  type Lead,
  type LeadInput,
  type Property,
  type PropertyFilters,
  type PublicProperty,
} from "@/lib/domain";
import { seedProperties } from "./seed";
import type { LeadRepository, PropertyRepository, Repository } from "./repository";

/**
 * Implementación en memoria del repositorio.
 *
 * Pensada para desarrollo y demostración: el catálogo proviene de los datos
 * de ejemplo y los leads se guardan en un arreglo efímero (se pierden al
 * reiniciar el servidor). En producción se reemplaza por SupabaseRepository.
 */

function matchesFilters(p: Property, f?: PropertyFilters): boolean {
  if (!f) return true;
  if (f.tipo && p.tipo !== f.tipo) return false;
  if (f.operacion && p.operacion !== f.operacion) return false;
  if (f.estado && p.estado !== f.estado) return false;
  if (f.ciudad && p.ubicacion.ciudad.toLowerCase() !== f.ciudad.toLowerCase()) return false;
  if (f.destacado && !p.destacado) return false;
  if (f.precioMin != null && p.precio < f.precioMin) return false;
  if (f.precioMax != null && p.precio > f.precioMax) return false;
  if (f.habitacionesMin != null && (p.caracteristicas.habitaciones ?? 0) < f.habitacionesMin)
    return false;
  if (f.q) {
    const q = f.q.toLowerCase();
    const haystack = [
      p.titulo,
      p.descripcion,
      p.ubicacion.ciudad,
      p.ubicacion.barrio ?? "",
      p.codigo,
    ]
      .join(" ")
      .toLowerCase();
    if (!haystack.includes(q)) return false;
  }
  return true;
}

function sortByRelevance(a: Property, b: Property): number {
  // Disponibles primero, luego destacados, luego más recientes.
  const estadoRank = (p: Property) => (p.estado === "disponible" ? 0 : p.estado === "en_proceso" ? 1 : 2);
  const byEstado = estadoRank(a) - estadoRank(b);
  if (byEstado !== 0) return byEstado;
  if (a.destacado !== b.destacado) return a.destacado ? -1 : 1;
  return b.actualizadoEn.localeCompare(a.actualizadoEn);
}

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

  async getPublicBySlug(slug: string): Promise<PublicProperty | null> {
    const p = await this.getBySlug(slug);
    if (!p || !p.publicado) return null;
    return toPublicProperty(p);
  }

  async listCities(): Promise<string[]> {
    return [...new Set(this.properties.map((p) => p.ubicacion.ciudad))].sort();
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
}

export function createMemoryRepository(): Repository {
  return {
    properties: new MemoryPropertyRepository(seedProperties),
    leads: new MemoryLeadRepository(),
  };
}
