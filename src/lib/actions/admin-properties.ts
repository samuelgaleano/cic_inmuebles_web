"use server";

import { revalidatePath } from "next/cache";
import { redirect } from "next/navigation";
import { z } from "zod";
import { getRepository } from "@/lib/data";
import { ensurePropertyArchive, isDriveConfigured } from "@/lib/integrations/drive";
import { isSheetsConfigured, syncAllPropertiesToSheet, syncPropertyToSheet } from "@/lib/integrations/sheets";
import {
  PROPERTY_STATUSES,
  PROPERTY_TYPES,
  type MediaProvider,
  type PropertyInput,
  type PropertyMedia,
} from "@/lib/domain";

/** Deduce el proveedor del medio a partir del host de la URL. */
function mediaProviderFor(url: string): MediaProvider {
  if (/res\.cloudinary\.com/i.test(url)) return "cloudinary";
  if (/drive\.google\.com|googleusercontent\.com/i.test(url)) return "drive";
  return "external";
}

/** Revalida las rutas públicas afectadas para mantener el catálogo sincronizado. */
function revalidatePublic(slug?: string) {
  revalidatePath("/");
  revalidatePath("/inmuebles");
  if (slug) revalidatePath(`/inmuebles/${slug}`);
  revalidatePath("/admin/inmuebles");
}

const num = (v: FormDataEntryValue | null): number | undefined => {
  const s = String(v ?? "").trim();
  if (!s) return undefined;
  const n = Number(s.replace(/[^0-9.-]/g, ""));
  return Number.isFinite(n) ? n : undefined;
};

const str = (v: FormDataEntryValue | null): string => String(v ?? "").trim();

const baseSchema = z.object({
  titulo: z.string().trim().min(3, "El título es obligatorio"),
  tipo: z.enum(PROPERTY_TYPES),
  estado: z.enum(PROPERTY_STATUSES),
  precio: z.number().nonnegative("El precio debe ser un número válido"),
  ciudad: z.string().trim().min(2, "La ciudad es obligatoria"),
});

export interface PropertyFormState {
  error?: string;
  errors?: Record<string, string>;
}

/** Construye un PropertyInput a partir del FormData del panel. */
function buildInput(formData: FormData): { input?: PropertyInput; state?: PropertyFormState } {
  const parsed = baseSchema.safeParse({
    titulo: str(formData.get("titulo")),
    tipo: str(formData.get("tipo")),
    estado: str(formData.get("estado")),
    precio: num(formData.get("precio")) ?? -1,
    ciudad: str(formData.get("ciudad")),
  });

  if (!parsed.success) {
    const errors: Record<string, string> = {};
    for (const issue of parsed.error.issues) {
      const key = issue.path[0];
      if (typeof key === "string" && !errors[key]) errors[key] = issue.message;
    }
    return { state: { error: "Revisa los campos obligatorios.", errors } };
  }

  const d = parsed.data;

  // Medios: una URL de imagen por línea + URL de video opcional (YouTube).
  const imagenes = str(formData.get("imagenes"))
    .split(/[\n,]+/)
    .map((u) => u.trim())
    .filter(Boolean);

  const medios: PropertyMedia[] = imagenes.map((url, i) => ({
    id: `img-${i}`,
    type: "image",
    provider: mediaProviderFor(url),
    url,
    order: i,
    isCover: i === 0,
  }));

  const videoUrl = str(formData.get("videoUrl"));
  if (videoUrl) {
    medios.push({
      id: "video-0",
      type: "video",
      provider: "youtube",
      url: videoUrl,
      order: medios.length,
      isCover: false,
    });
  }

  const input: PropertyInput = {
    titulo: d.titulo,
    tipo: d.tipo,
    estado: d.estado,
    precio: d.precio,
    administracion: num(formData.get("administracion")),
    ubicacion: {
      ciudad: d.ciudad,
      sector: str(formData.get("sector")) || undefined,
      conjunto: str(formData.get("conjunto")) || undefined,
      direccion: str(formData.get("direccion")) || undefined,
    },
    caracteristicas: {
      habitaciones: num(formData.get("habitaciones")),
      banos: num(formData.get("banos")),
      area: num(formData.get("area")),
    },
    descripcion: str(formData.get("descripcion")),
    medios,
    propietario: str(formData.get("propietarioNombre"))
      ? {
          nombre: str(formData.get("propietarioNombre")),
          telefono: str(formData.get("propietarioTelefono")),
          email: str(formData.get("propietarioEmail")) || undefined,
        }
      : undefined,
    notasInternas: str(formData.get("notasInternas")) || undefined,
    driveFolderId: str(formData.get("driveFolderId")) || undefined,
    destacado: formData.get("destacado") === "on",
    publicado: formData.get("publicado") === "on",
  };

  return { input };
}

export async function createPropertyAction(
  _prev: PropertyFormState,
  formData: FormData,
): Promise<PropertyFormState> {
  const { input, state } = buildInput(formData);
  if (!input) return state!;

  let slug: string;
  try {
    const created = await getRepository().properties.create(input);
    slug = created.slug;

    // Archivo operativo en Google Drive (best-effort, no bloquea la creación).
    if (!created.driveFolderId && isDriveConfigured()) {
      const folderId = await ensurePropertyArchive(created);
      if (folderId) {
        await getRepository().properties.update(created.id, { driveFolderId: folderId });
      }
    }

    // Catálogo en Google Sheets (best-effort).
    if (isSheetsConfigured()) {
      const fresh = await getRepository().properties.getById(created.id);
      await syncPropertyToSheet(fresh ?? created);
    }
  } catch (err) {
    console.error("[admin] Error al crear inmueble:", err);
    return { error: "No se pudo crear el inmueble." };
  }

  revalidatePublic(slug);
  redirect("/admin/inmuebles");
}

export async function updatePropertyAction(
  id: string,
  _prev: PropertyFormState,
  formData: FormData,
): Promise<PropertyFormState> {
  const { input, state } = buildInput(formData);
  if (!input) return state!;

  let slug: string | undefined;
  try {
    const updated = await getRepository().properties.update(id, input);
    if (!updated) return { error: "El inmueble no existe." };
    slug = updated.slug;
    if (isSheetsConfigured()) await syncPropertyToSheet(updated);
  } catch (err) {
    console.error("[admin] Error al actualizar inmueble:", err);
    return { error: "No se pudo actualizar el inmueble." };
  }

  revalidatePublic(slug);
  redirect("/admin/inmuebles");
}

/**
 * Crea (o recrea) la carpeta de archivo en Google Drive para un inmueble
 * existente y guarda su id. Útil para inmuebles creados antes de configurar
 * Drive. Best-effort.
 */
export async function createPropertyArchiveAction(formData: FormData): Promise<void> {
  const id = str(formData.get("id"));
  if (!id || !isDriveConfigured()) {
    redirect(id ? `/admin/inmuebles/${id}` : "/admin/inmuebles");
  }
  try {
    const repo = getRepository();
    const property = await repo.properties.getById(id);
    if (property) {
      const folderId = await ensurePropertyArchive(property);
      if (folderId) {
        const updated = await repo.properties.update(id, { driveFolderId: folderId });
        if (updated && isSheetsConfigured()) await syncPropertyToSheet(updated);
      }
    }
  } catch (err) {
    console.error("[admin] No se pudo crear el archivo en Drive:", err);
  }
  revalidatePath(`/admin/inmuebles/${id}`);
  redirect(`/admin/inmuebles/${id}`);
}

export async function deletePropertyAction(formData: FormData): Promise<void> {
  const id = str(formData.get("id"));
  if (id) {
    const repo = getRepository();
    await repo.properties.remove(id);
    // Reescribe el catálogo de Sheets para reflejar la eliminación (best-effort).
    if (isSheetsConfigured()) await syncAllPropertiesToSheet(await repo.properties.list());
    revalidatePublic();
  }
  redirect("/admin/inmuebles");
}
