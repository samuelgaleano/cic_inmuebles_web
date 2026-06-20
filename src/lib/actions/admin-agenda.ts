"use server";

import { revalidatePath } from "next/cache";
import { getRepository } from "@/lib/data";
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
  const id = str(formData.get("id"));
  if (id) {
    await getRepository().agents.remove(id);
    revalidate();
  }
}

export async function setAvailabilityAction(formData: FormData): Promise<void> {
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
export async function createAppointmentAction(formData: FormData): Promise<void> {
  const propertyId = str(formData.get("propertyId"));
  const clienteNombre = str(formData.get("clienteNombre"));
  const clienteTelefono = str(formData.get("clienteTelefono"));
  const inicioEn = str(formData.get("inicioEn"));
  if (!propertyId || !clienteNombre || !clienteTelefono || !inicioEn) return;

  await getRepository().appointments.create({
    propertyId,
    agentId: str(formData.get("agentId")) || undefined,
    leadId: str(formData.get("leadId")) || undefined,
    clienteNombre,
    clienteTelefono,
    clienteEmail: str(formData.get("clienteEmail")) || undefined,
    inicioEn: new Date(inicioEn).toISOString(),
    duracionMin: Number(str(formData.get("duracionMin"))) || 60,
    notas: str(formData.get("notas")) || undefined,
    estado: "confirmada",
  });
  revalidate();
}

export async function setAppointmentStatusAction(formData: FormData): Promise<void> {
  const id = str(formData.get("id"));
  const estado = str(formData.get("estado")) as AppointmentStatus;
  if (id && APPOINTMENT_STATUSES.includes(estado)) {
    await getRepository().appointments.updateStatus(id, estado);
    revalidate();
  }
}

export async function deleteAppointmentAction(formData: FormData): Promise<void> {
  const id = str(formData.get("id"));
  if (id) {
    await getRepository().appointments.remove(id);
    revalidate();
  }
}
