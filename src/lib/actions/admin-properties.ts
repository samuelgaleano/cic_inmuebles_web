"use server";

import { revalidatePath } from "next/cache";
import { redirect } from "next/navigation";
import { z } from "zod";
import { getRepository } from "@/lib/data";
import {
  OPERATIONS,
  PROPERTY_STATUSES,
  PROPERTY_TYPES,
  type PropertyInput,
  type PropertyMedia,
} from "@/lib/domain";

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
  operacion: z.enum(OPERATIONS),
  estado: z.enum(PROPERTY_STATUSES),
  precio: z.number().nonnegative("El precio debe ser un número válido"),
  ciudad: z.string().trim().min(2, "La ciudad es obligatoria"),
  departamento: z.string().trim().min(2, "El departamento es obligatorio"),
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
    operacion: str(formData.get("operacion")),
    estado: str(formData.get("estado")),
    precio: num(formData.get("precio")) ?? -1,
    ciudad: str(formData.get("ciudad")),
    departamento: str(formData.get("departamento")),
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
    provider: "external",
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

  const amenidades = str(formData.get("amenidades"))
    .split(/[\n,]+/)
    .map((a) => a.trim())
    .filter(Boolean);

  const input: PropertyInput = {
    titulo: d.titulo,
    tipo: d.tipo,
    operacion: d.operacion,
    estado: d.estado,
    precio: d.precio,
    moneda: str(formData.get("moneda")) || "COP",
    ubicacion: {
      departamento: d.departamento,
      ciudad: d.ciudad,
      barrio: str(formData.get("barrio")) || undefined,
      direccion: str(formData.get("direccion")) || undefined,
      lat: num(formData.get("lat")),
      lng: num(formData.get("lng")),
    },
    caracteristicas: {
      habitaciones: num(formData.get("habitaciones")),
      banos: num(formData.get("banos")),
      areaConstruida: num(formData.get("areaConstruida")),
      areaTotal: num(formData.get("areaTotal")),
      parqueaderos: num(formData.get("parqueaderos")),
      estrato: num(formData.get("estrato")),
      piso: num(formData.get("piso")),
      antiguedadAnios: num(formData.get("antiguedadAnios")),
      administracion: num(formData.get("administracion")),
    },
    amenidades,
    descripcion: str(formData.get("descripcion")),
    descripcionCorta: str(formData.get("descripcionCorta")),
    medios,
    propietario: str(formData.get("propietarioNombre"))
      ? {
          nombre: str(formData.get("propietarioNombre")),
          telefono: str(formData.get("propietarioTelefono")),
          email: str(formData.get("propietarioEmail")) || undefined,
        }
      : undefined,
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
  } catch (err) {
    console.error("[admin] Error al actualizar inmueble:", err);
    return { error: "No se pudo actualizar el inmueble." };
  }

  revalidatePublic(slug);
  redirect("/admin/inmuebles");
}

export async function deletePropertyAction(formData: FormData): Promise<void> {
  const id = str(formData.get("id"));
  if (id) {
    await getRepository().properties.remove(id);
    revalidatePublic();
  }
  redirect("/admin/inmuebles");
}
