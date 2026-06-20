import {
  toPublicProperty,
  type Lead,
  type LeadInput,
  type LeadStatus,
  type Property,
  type PropertyFilters,
  type PropertyInput,
  type PropertyMedia,
  type PublicProperty,
} from "@/lib/domain";
import { slugify } from "@/lib/utils/slug";
import { getSupabaseAdmin } from "./supabase/client";
import {
  leadInputToRow,
  leadRowToDomain,
  mediaInputToRows,
  propertyInputToRow,
  propertyRowToDomain,
} from "./supabase/mappers";
import { matchesFilters, sortByRelevance } from "./filtering";
import type { LeadRepository, PropertyRepository, Repository } from "./repository";

const PROPERTY_SELECT = "*, property_media(*)";

/**
 * Implementación del repositorio sobre Supabase (PostgreSQL).
 *
 * Mantiene paridad con la versión en memoria. Para el volumen esperado
 * (decenas de inmuebles) el filtrado se hace en memoria tras traer el
 * catálogo, reutilizando exactamente la misma lógica.
 */
class SupabasePropertyRepository implements PropertyRepository {
  private async fetchAll(): Promise<Property[]> {
    const { data, error } = await getSupabaseAdmin()
      .from("properties")
      .select(PROPERTY_SELECT);
    if (error) throw error;
    return (data ?? []).map(propertyRowToDomain);
  }

  async list(filters?: PropertyFilters): Promise<Property[]> {
    const all = await this.fetchAll();
    return all.filter((p) => matchesFilters(p, filters)).sort(sortByRelevance);
  }

  async listPublic(filters?: PropertyFilters): Promise<PublicProperty[]> {
    const items = await this.list(filters);
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
    return [...new Set((data ?? []).map((r) => r.ciudad as string))].sort();
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

  async list(): Promise<Lead[]> {
    const { data, error } = await getSupabaseAdmin()
      .from("leads")
      .select("*")
      .order("created_at", { ascending: false });
    if (error) throw error;
    return (data ?? []).map(leadRowToDomain);
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

export function createSupabaseRepository(): Repository {
  return {
    properties: new SupabasePropertyRepository(),
    leads: new SupabaseLeadRepository(),
  };
}
