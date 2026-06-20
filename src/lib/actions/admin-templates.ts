"use server";

import { revalidatePath } from "next/cache";
import { redirect } from "next/navigation";
import { getRepository } from "@/lib/data";
import { TEMPLATE_TYPES, type TemplateType } from "@/lib/domain";

const str = (v: FormDataEntryValue | null) => String(v ?? "").trim();

function parseType(v: string): TemplateType {
  return TEMPLATE_TYPES.includes(v as TemplateType) ? (v as TemplateType) : "otro";
}

export async function createTemplateAction(formData: FormData): Promise<void> {
  const nombre = str(formData.get("nombre"));
  const contenido = str(formData.get("contenido"));
  if (!nombre || !contenido) return;
  await getRepository().templates.create({
    nombre,
    tipo: parseType(str(formData.get("tipo"))),
    contenido,
  });
  revalidatePath("/admin/plantillas");
  redirect("/admin/plantillas");
}

export async function updateTemplateAction(id: string, formData: FormData): Promise<void> {
  const nombre = str(formData.get("nombre"));
  const contenido = str(formData.get("contenido"));
  if (!nombre || !contenido) return;
  await getRepository().templates.update(id, {
    nombre,
    tipo: parseType(str(formData.get("tipo"))),
    contenido,
  });
  revalidatePath("/admin/plantillas");
  redirect("/admin/plantillas");
}

export async function deleteTemplateAction(formData: FormData): Promise<void> {
  const id = str(formData.get("id"));
  if (id) {
    await getRepository().templates.remove(id);
    revalidatePath("/admin/plantillas");
  }
}
