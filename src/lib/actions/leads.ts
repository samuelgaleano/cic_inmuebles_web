"use server";

import { z } from "zod";
import { getRepository } from "@/lib/data";
import { sendLeadNotification } from "@/lib/notifications/email";
import { whatsappLink } from "@/lib/config/site";
import type { Lead, LeadInput } from "@/lib/domain";
import { LEAD_INTENT_LABELS } from "@/lib/domain";

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

/** Campos visibles que se devuelven en el estado de error para repoblar el formulario. */
const VISIBLE_FIELDS = ["nombre", "telefono", "email", "ciudad", "tipoInmueble", "preferencia", "mensaje"] as const;
export type LeadFieldName = (typeof VISIBLE_FIELDS)[number];

export interface LeadFormState {
  status: "idle" | "success" | "error";
  message?: string;
  errors?: Record<string, string>;
  /**
   * Lo que el usuario escribió, solo en estado de error. React 19 vacía los
   * campos no controlados al terminar una acción; sin esto, un teléfono mal
   * escrito obliga a reescribir todo el formulario.
   */
  values?: Partial<Record<LeadFieldName, string>>;
  /** Enlace wa.me prellenado para continuar la conversación (click-to-chat). */
  whatsappUrl?: string;
}

function visibleValues(raw: Record<string, FormDataEntryValue>): LeadFormState["values"] {
  const values: Partial<Record<LeadFieldName, string>> = {};
  for (const key of VISIBLE_FIELDS) {
    const v = raw[key];
    if (typeof v === "string" && v !== "") values[key] = v;
  }
  return values;
}

/** Construye el enlace de WhatsApp (click-to-chat) con el resumen del lead. */
async function buildLeadWhatsappUrl(lead: Lead): Promise<string> {
  const partes: string[] = [`Hola, soy ${lead.nombre}.`];

  if (lead.tipo === "vendedor") {
    const detalle = [lead.tipoInmueble, lead.ciudad].filter(Boolean).join(" en ");
    partes.push(
      detalle
        ? `Quiero vender mi inmueble (${detalle}).`
        : "Quiero vender mi inmueble.",
    );
  } else {
    let titulo = lead.propertySlug;
    if (lead.propertySlug) {
      try {
        const prop = await getRepository().properties.getPublicBySlug(lead.propertySlug);
        if (prop) titulo = `${prop.titulo} (${prop.codigo})`;
      } catch {
        // se usa el slug como respaldo
      }
    }
    const accion = lead.intencion ? LEAD_INTENT_LABELS[lead.intencion].toLowerCase() : "más información";
    partes.push(titulo ? `Me interesa "${titulo}" — ${accion}.` : `Quiero ${accion}.`);
  }

  if (lead.preferencia) partes.push(`Preferencia: ${lead.preferencia}.`);
  if (lead.mensaje) partes.push(lead.mensaje);
  partes.push(`Mi teléfono: ${lead.telefono}.`);

  return whatsappLink(partes.join(" "));
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
      message: "Revisa los datos marcados.",
      errors,
      values: visibleValues(raw),
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

  let lead: Lead;
  try {
    lead = await getRepository().leads.create(input);
    await sendLeadNotification(lead);
  } catch (err) {
    console.error("[leads] Error al crear lead:", err);
    return {
      status: "error",
      message: "No pudimos registrar tu solicitud. Intenta de nuevo o escríbenos por WhatsApp.",
      values: visibleValues(raw),
    };
  }

  return {
    status: "success",
    message:
      data.tipo === "vendedor"
        ? "¡Gracias! Recibimos los datos de tu inmueble."
        : "¡Listo! Recibimos tu solicitud.",
    whatsappUrl: await buildLeadWhatsappUrl(lead),
  };
}
