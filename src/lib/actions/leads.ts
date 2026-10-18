"use server";

import { after } from "next/server";
import { z } from "zod";
import { getCrmStore } from "@/lib/crm/store";
import { vincularLead } from "@/lib/crm/vinculos";
import { getRepository } from "@/lib/data";
import { sendLeadNotification } from "@/lib/notifications/email";
import { whatsappLink } from "@/lib/config/site";
import type { Lead, LeadInput } from "@/lib/domain";
import { esSpamProbable } from "@/lib/leads/spam";
import { normalizarTelefono } from "@/lib/utils/telefono";
import { LEAD_INTENT_LABELS } from "@/lib/domain";

/**
 * Acción de servidor para crear leads desde los formularios públicos.
 *
 * Principio de diseño: MÍNIMA FRICCIÓN. Solo nombre y teléfono son
 * obligatorios; el resto del contexto (inmueble, intención, ciudad...) viaja
 * en campos ocultos para concretar en un solo paso.
 */

const leadSchema = z.object({
  tipo: z.enum(["comprador", "vendedor"]),
  nombre: z.string().trim().min(2, "Ingresa tu nombre").max(120),
  // Un teléfono de verdad (celular o fijo de Colombia, o internacional con "+"): "-------" ya no pasa.
  telefono: z
    .string()
    .trim()
    .max(24, "Ingresa un teléfono válido")
    .refine((v) => normalizarTelefono(v) !== null, "Ingresa un celular o teléfono válido, por ejemplo 300 123 4567"),
  email: z
    .union([z.string().trim().email("Correo inválido").max(160), z.literal("")])
    .optional(),
  mensaje: z.string().trim().max(1000).optional(),
  intencion: z.enum(["visita", "info"]).optional(),
  propertyId: z.string().max(80).optional(),
  propertySlug: z.string().max(160).optional(),
  preferencia: z.string().trim().max(200).optional(),
  tipoInmueble: z.string().trim().max(120).optional(),
  ciudad: z.string().trim().max(120).optional(),
  fuente: z.enum(["web", "whatsapp"]).default("web"),
  // El honeypot anti-spam (`website`) se revisa ANTES de validar: ver createLeadAction.
});

/** Mensaje de éxito real; el honeypot devuelve el mismo para que el bot no note la diferencia. */
function mensajeExito(tipo: unknown): string {
  return tipo === "vendedor" ? "¡Gracias! Recibimos los datos de tu inmueble." : "¡Listo! Recibimos tu solicitud.";
}

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

/** Si la base de datos falla, el visitante igual puede llegar a CIC: WhatsApp con lo que ya escribió. */
function respaldoWhatsapp(d: z.infer<typeof leadSchema>): string {
  const detalle = [d.tipoInmueble, d.ciudad].filter(Boolean).join(" en ");
  const partes = [`Hola, soy ${d.nombre}.`];
  if (d.tipo === "vendedor") partes.push(`Quiero vender mi inmueble${detalle ? ` (${detalle})` : ""}.`);
  else partes.push(d.propertySlug ? `Me interesa el inmueble "${d.propertySlug}".` : "Quiero más información.");
  if (d.preferencia) partes.push(`Preferencia: ${d.preferencia}.`);
  partes.push(`Mi teléfono: ${d.telefono}.`);
  return whatsappLink(partes.join(" "));
}

export async function createLeadAction(
  _prevState: LeadFormState,
  formData: FormData,
): Promise<LeadFormState> {
  const raw = Object.fromEntries(formData.entries());

  // Honeypot: el campo `website` está oculto para las personas; si llega con algo, es un bot.
  // Se responde un éxito idéntico al real, sin validar, sin guardar y sin enviar correo, para
  // que el bot no aprenda a esquivarlo. (Antes se validaba primero y el bot recibía un error.)
  const trampa = raw.website;
  if (typeof trampa === "string" ? trampa.trim() !== "" : trampa !== undefined) {
    return { status: "success", message: mensajeExito(raw.tipo) };
  }

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

  // Segunda capa anti-spam: ofertas de SEO, videos o «indexar tu dominio» (dos señales a la vez).
  // Igual que el honeypot: éxito idéntico al real, sin guardar ni avisar, y sin datos personales en el registro.
  if (esSpamProbable({ nombre: data.nombre, email: data.email || undefined, mensaje: data.mensaje, tipoTelefono: normalizarTelefono(data.telefono)?.tipo })) {
    console.warn("[leads] envío descartado por parecer spam");
    return { status: "success", message: mensajeExito(data.tipo) };
  }

  const input: LeadInput = {
    tipo: data.tipo,
    nombre: data.nombre,
    // Guardado en forma legible y única ("+57 300 123 4567") para el panel, el correo y los enlaces.
    telefono: normalizarTelefono(data.telefono)?.legible ?? data.telefono,
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
  } catch (err) {
    console.error("[leads] Error al crear lead:", err);
    return {
      status: "error",
      message: "No pudimos registrar tu solicitud. Intenta de nuevo o escríbenos por WhatsApp.",
      values: visibleValues(raw),
      whatsappUrl: respaldoWhatsapp(data),
    };
  }

  // El aviso por correo sale DESPUÉS de responder (hasta 8 s de espera para el visitante) y un
  // fallo del correo ya no convierte un lead guardado en un error.
  // El lead también entra solo al CRM (persona + vendedor o comprador), por separado del correo: un fallo
  // o una demora de uno no afecta al otro ni al lead ya guardado.
  after(async () => {
    try {
      await vincularLead(getCrmStore(), lead);
    } catch (err) {
      console.error("[leads] No se pudo pasar al CRM:", err instanceof Error ? err.message : err);
    }
  });
  after(async () => {
    try {
      await sendLeadNotification(lead);
    } catch (err) {
      console.error("[leads] Error al avisar por correo:", err);
    }
  });

  return {
    status: "success",
    message: mensajeExito(data.tipo),
    whatsappUrl: await buildLeadWhatsappUrl(lead),
  };
}
