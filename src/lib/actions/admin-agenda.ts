"use server";

import { revalidatePath } from "next/cache";
import { redirect } from "next/navigation";
import { exigirAdmin } from "@/lib/auth";
import { getCrmStore } from "@/lib/crm/store";
import { registrarVisitaRealizada } from "@/lib/crm/visitas";
import { getRepository } from "@/lib/data";
import { desdeHoraBogota } from "@/lib/utils/hora-bogota";
import {
  AGENT_ROLES,
  APPOINTMENT_STATUSES,
  type AgentRole,
  type AppointmentStatus,
  type AvailabilitySlot,
} from "@/lib/domain";

const str = (v: FormDataEntryValue | null) => String(v ?? "").trim();

function revalidate() {
  revalidatePath("/admin/agenda");
  revalidatePath("/admin");
}

// --- Agentes -----------------------------------------------------------------
export async function createAgentAction(formData: FormData): Promise<void> {
  await exigirAdmin();
  const nombre = str(formData.get("nombre"));
  const email = str(formData.get("email"));
  const rol = str(formData.get("rol")) as AgentRole;
  if (!nombre || !email) return;
  await getRepository().agents.create({
    nombre,
    email,
    telefono: str(formData.get("telefono")) || undefined,
    rol: AGENT_ROLES.includes(rol) ? rol : "agente",
    activo: true,
  });
  revalidate();
}

export async function deleteAgentAction(formData: FormData): Promise<void> {
  await exigirAdmin();
  const id = str(formData.get("id"));
  if (id) {
    await getRepository().agents.remove(id);
    revalidate();
  }
}

export async function setAvailabilityAction(formData: FormData): Promise<void> {
  await exigirAdmin();
  const agentId = str(formData.get("agentId"));
  if (!agentId) return;
  const slots: AvailabilitySlot[] = [];
  for (let dia = 0; dia <= 6; dia++) {
    if (formData.get(`dia_${dia}`) !== "on") continue;
    const inicio = str(formData.get(`inicio_${dia}`)) || "09:00";
    const fin = str(formData.get(`fin_${dia}`)) || "18:00";
    slots.push({ diaSemana: dia, horaInicio: inicio, horaFin: fin });
  }
  await getRepository().agents.setAvailability(agentId, slots);
  revalidate();
}

// --- Citas -------------------------------------------------------------------
const UUID = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;

export async function createAppointmentAction(formData: FormData): Promise<void> {
  await exigirAdmin();
  const propertyId = str(formData.get("propertyId"));
  const clienteNombre = str(formData.get("clienteNombre"));
  const clienteTelefono = str(formData.get("clienteTelefono"));
  const inicioEn = str(formData.get("inicioEn"));
  if (!propertyId || !clienteNombre || !clienteTelefono || !inicioEn) return;
  // El campo es de hora de Bogotá; el servidor corre en UTC.
  const inicioUtc = desdeHoraBogota(inicioEn);
  if (!inicioUtc) return;
  // Agendada desde la ficha del contacto o desde una propuesta: la cita queda enlazada a esa persona.
  const crudo = str(formData.get("contactoId"));
  const contactoId = UUID.test(crudo) && (await getCrmStore().obtenerContacto(crudo).catch(() => null)) ? crudo : undefined;

  await getRepository().appointments.create({
    propertyId,
    agentId: str(formData.get("agentId")) || undefined,
    leadId: str(formData.get("leadId")) || undefined,
    ...(contactoId ? { contactoId } : {}),
    clienteNombre,
    clienteTelefono,
    clienteEmail: str(formData.get("clienteEmail")) || undefined,
    inicioEn: inicioUtc,
    duracionMin: Number(str(formData.get("duracionMin"))) || 60,
    notas: str(formData.get("notas")) || undefined,
    estado: "confirmada",
  });
  revalidate();
  if (contactoId) {
    revalidatePath(`/admin/crm/contactos/${contactoId}`);
    // Vuelve a la ficha desde la que se agendó.
    if (str(formData.get("volver")) === "ficha") redirect(`/admin/crm/contactos/${contactoId}`);
  }
}

export async function setAppointmentStatusAction(formData: FormData): Promise<void> {
  await exigirAdmin();
  const id = str(formData.get("id"));
  const estado = str(formData.get("estado")) as AppointmentStatus;
  if (id && APPOINTMENT_STATUSES.includes(estado)) {
    const repo = getRepository();
    const cita = await repo.appointments.updateStatus(id, estado);
    // Realizada: queda como actividad «visita» de la persona y su propuesta de ese inmueble pasa a «visitó».
    if (cita && estado === "realizada") {
      try {
        const inmueble = await repo.properties.getById(cita.propertyId).catch(() => null);
        const r = await registrarVisitaRealizada(getCrmStore(), cita, inmueble);
        if (r) {
          revalidatePath(`/admin/crm/contactos/${r.contactoId}`);
          revalidatePath("/admin/crm");
        }
      } catch (err) {
        // La cita ya quedó realizada; el CRM se puede poner al día marcándola de nuevo.
        console.error("[agenda] no se pudo registrar la visita en el CRM:", err instanceof Error ? err.message : err);
      }
    }
    revalidate();
  }
}

export async function deleteAppointmentAction(formData: FormData): Promise<void> {
  await exigirAdmin();
  const id = str(formData.get("id"));
  if (id) {
    await getRepository().appointments.remove(id);
    revalidate();
  }
}
