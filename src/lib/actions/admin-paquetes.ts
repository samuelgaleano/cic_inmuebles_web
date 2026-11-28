"use server";

import { revalidatePath } from "next/cache";
import { redirect } from "next/navigation";
import { exigirAdmin } from "@/lib/auth";
import { getRepository } from "@/lib/data";
import { puedeAgregarFicha } from "@/lib/servicios/paquetes";
import { getServiciosStore } from "@/lib/servicios/store";

/**
 * Fichas de los paquetes (planes con espacios) desde /admin/vigencias. Toda acción empieza con
 * exigirAdmin: se pueden invocar con un POST a cualquier página. Asignar o quitar una ficha NO la
 * publica ni la despublica: solo deja constancia de qué inmuebles cubre el paquete.
 */

const SLUG = /^[a-z0-9]+(?:-[a-z0-9]+)*$/;
const UUID = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;

function texto(v: FormDataEntryValue | null): string {
  return String(v ?? "").trim();
}

/** Ocupa un espacio del paquete con una ficha existente. Si no hay espacio, vuelve al panel con el motivo. */
export async function asignarFichaAPaqueteAction(formData: FormData): Promise<void> {
  await exigirAdmin();
  const id = texto(formData.get("id"));
  const slug = texto(formData.get("slug")).toLowerCase();
  if (!UUID.test(id) || !SLUG.test(slug)) return;

  const store = getServiciosStore();
  const s = await store.obtener(id);
  if (!s) return;
  const inmueble = await getRepository().properties.getBySlug(slug);
  if (!inmueble) redirect("/admin/vigencias?aviso=ficha_inexistente");

  const fichas = (await store.fichasDePaquetes([id])).get(id) ?? [];
  const decision = puedeAgregarFicha(s, fichas, inmueble.id);
  if (!decision.ok) redirect(`/admin/vigencias?aviso=${decision.motivo}`);

  try {
    await store.agregarFichaAPaquete(id, { propertyId: inmueble.id, slug: inmueble.slug });
  } catch (err) {
    console.error(`[paquetes] no se pudo asignar la ficha al servicio ${id}:`, err instanceof Error ? err.message : err);
    redirect("/admin/vigencias?aviso=sin_tabla");
  }
  revalidatePath("/admin/vigencias");
}

/** Libera el espacio que ocupaba una ficha (vendida o retirada) para poner otra. */
export async function quitarFichaDePaqueteAction(formData: FormData): Promise<void> {
  await exigirAdmin();
  const id = texto(formData.get("id"));
  const propertyId = texto(formData.get("propertyId"));
  if (!UUID.test(id) || !propertyId || propertyId.length > 80) return;
  await getServiciosStore().quitarFichaDePaquete(id, propertyId);
  revalidatePath("/admin/vigencias");
}
