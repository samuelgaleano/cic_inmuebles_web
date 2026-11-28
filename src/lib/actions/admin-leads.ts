"use server";

import { revalidatePath } from "next/cache";
import { exigirAdmin } from "@/lib/auth";
import { getCrmStore } from "@/lib/crm/store";
import { getRepository } from "@/lib/data";
import { LEAD_STATUSES, type LeadStatus } from "@/lib/domain";
import { variantesTelefono } from "@/lib/utils/telefono";

const UUID = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;

export async function setLeadStatusAction(formData: FormData): Promise<void> {
  await exigirAdmin();
  const id = String(formData.get("id") ?? "");
  const estado = String(formData.get("estado") ?? "") as LeadStatus;
  if (id && LEAD_STATUSES.includes(estado)) {
    const repo = getRepository();
    // Se lee antes de cambiarlo (en memoria el objeto es el mismo que se modifica).
    const estabaNuevo = (await repo.leads.getById(id))?.estado === "nuevo";
    await repo.leads.updateStatus(id, estado);
    // Salir de «nuevo» es atenderlo: cuenta como primera respuesta si nadie le había escrito todavía.
    if (estabaNuevo && estado !== "nuevo" && estado !== "descartado") {
      await repo.leads.marcarPrimerContacto([id], new Date().toISOString()).catch((err) => console.error("[leads] primer contacto:", err instanceof Error ? err.message : err));
    }
    revalidatePath("/admin/leads");
    revalidatePath("/admin");
  }
}

/**
 * Lo llaman los botones de WhatsApp y de llamar del panel, justo antes de abrir el chat o el marcador: deja la
 * hora de la primera respuesta en el lead (o en los leads de esa persona del CRM) si todavía no la tenía.
 * Liviano y silencioso: si falla, el enlace se abre igual.
 */
export async function registrarPrimerContactoAction(datos: { leadId?: string; contactoId?: string }): Promise<void> {
  await exigirAdmin();
  const repo = getRepository();
  const at = new Date().toISOString();
  try {
    if (datos.leadId && UUID.test(datos.leadId)) {
      if ((await repo.leads.marcarPrimerContacto([datos.leadId], at)) > 0) revalidatePath("/admin/leads");
      return;
    }
    if (datos.contactoId && UUID.test(datos.contactoId)) {
      const crm = getCrmStore();
      const contacto = await crm.obtenerContacto(datos.contactoId);
      if (!contacto) return;
      const leads = await repo.leads.listarDeContacto({
        contactoId: contacto.id,
        ids: await crm.leadsDeContacto(contacto.id),
        telefonos: variantesTelefono(contacto.telefono, contacto.telefonoE164),
        email: contacto.email,
      });
      const pendientes = leads.filter((l) => !l.primerContactoAt && !l.suprimidoAt).map((l) => l.id);
      if (pendientes.length && (await repo.leads.marcarPrimerContacto(pendientes, at)) > 0) revalidatePath("/admin/leads");
    }
  } catch (err) {
    console.error("[leads] primer contacto:", err instanceof Error ? err.message : err);
  }
}

export async function deleteLeadAction(formData: FormData): Promise<void> {
  await exigirAdmin();
  const id = String(formData.get("id") ?? "");
  if (id) {
    await getRepository().leads.remove(id);
    revalidatePath("/admin/leads");
    revalidatePath("/admin");
  }
}
