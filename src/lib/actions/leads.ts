"use server";

import { z } from "zod";
import { getRepository } from "@/lib/data";
import { sendLeadNotification } from "@/lib/notifications/email";
import type { LeadInput } from "@/lib/domain";

/**
 * Acción de servidor para crear leads desde los formularios públicos.
 *
 * Principio de diseño: MÍNIMA FRICCIÓN. Solo nombre y teléfono son
 * obligatorios; el resto del contexto (inmueble, intención, ciudad...) viaja
 * en campos ocultos para concretar en un solo paso.
 */

const phoneRegex = /^[+()0-9\s-]{7,20}$/;

const leadSchema = z.object({
  tipo: z.enum(["comprador", "vendedor"]),
  nombre: z.string().trim().min(2, "Ingresa tu nombre"),
  telefono: z
    .string()
    .trim()
    .regex(phoneRegex, "Ingresa un teléfono válido"),
  email: z
    .union([z.string().trim().email("Correo inválido"), z.literal("")])
    .optional(),
  mensaje: z.string().trim().max(1000).optional(),
  intencion: z.enum(["visita", "info"]).optional(),
  propertyId: z.string().optional(),
  propertySlug: z.string().optional(),
  preferencia: z.string().trim().max(200).optional(),
  tipoInmueble: z.string().trim().max(120).optional(),
  ciudad: z.string().trim().max(120).optional(),
  fuente: z.enum(["web", "whatsapp"]).default("web"),
  // Honeypot anti-spam: debe llegar vacío.
  website: z.string().max(0).optional(),
});

export interface LeadFormState {
  status: "idle" | "success" | "error";
  message?: string;
  errors?: Record<string, string>;
}

export async function createLeadAction(
  _prevState: LeadFormState,
  formData: FormData,
): Promise<LeadFormState> {
  const raw = Object.fromEntries(formData.entries());
  const parsed = leadSchema.safeParse(raw);

  if (!parsed.success) {
    const errors: Record<string, string> = {};
    for (const issue of parsed.error.issues) {
      const key = issue.path[0];
      if (typeof key === "string" && !errors[key]) errors[key] = issue.message;
    }
    return {
      status: "error",
      message: "Revisa los datos del formulario.",
      errors,
    };
  }

  const data = parsed.data;

  // Honeypot: si viene relleno, simulamos éxito sin guardar (probable bot).
  if (data.website) {
    return { status: "success", message: "¡Gracias! Te contactaremos pronto." };
  }

  const input: LeadInput = {
    tipo: data.tipo,
    nombre: data.nombre,
    telefono: data.telefono,
    email: data.email || undefined,
    mensaje: data.mensaje || undefined,
    intencion: data.intencion,
    propertyId: data.propertyId || undefined,
    propertySlug: data.propertySlug || undefined,
    preferencia: data.preferencia || undefined,
    tipoInmueble: data.tipoInmueble || undefined,
    ciudad: data.ciudad || undefined,
    fuente: data.fuente,
  };

  try {
    const lead = await getRepository().leads.create(input);
    await sendLeadNotification(lead);
  } catch (err) {
    console.error("[leads] Error al crear lead:", err);
    return {
      status: "error",
      message: "No pudimos registrar tu solicitud. Intenta de nuevo o escríbenos por WhatsApp.",
    };
  }

  return {
    status: "success",
    message:
      data.tipo === "vendedor"
        ? "¡Gracias! Recibimos los datos de tu inmueble y te contactaremos muy pronto."
        : "¡Listo! Recibimos tu solicitud. Te contactaremos muy pronto.",
  };
}
