import type { Lead } from "@/lib/domain";
import { LEAD_INTENT_LABELS } from "@/lib/domain";
import { siteConfig } from "@/lib/config/site";
import { sendEmail } from "./resend";

/** Aviso por correo de un lead nuevo. El lead ya está guardado; el correo es best-effort. */
export async function sendLeadNotification(lead: Lead): Promise<boolean> {
  const subject =
    lead.tipo === "vendedor"
      ? `🏷️ Nuevo lead VENDEDOR: ${lead.nombre}`
      : `📩 Nuevo lead ${lead.intencion ? `(${LEAD_INTENT_LABELS[lead.intencion]})` : ""}: ${lead.nombre}`;

  return sendEmail({
    to: process.env.LEADS_NOTIFICATION_EMAIL ?? siteConfig.email,
    subject,
    text: renderLeadEmail(lead),
  });
}

function renderLeadEmail(lead: Lead): string {
  const lines = [
    `Tipo: ${lead.tipo}`,
    `Nombre: ${lead.nombre}`,
    `Teléfono: ${lead.telefono}`,
    lead.email ? `Email: ${lead.email}` : null,
    lead.intencion ? `Intención: ${LEAD_INTENT_LABELS[lead.intencion]}` : null,
    lead.propertySlug ? `Inmueble: ${lead.propertySlug}` : null,
    lead.preferencia ? `Preferencia: ${lead.preferencia}` : null,
    lead.tipoInmueble ? `Tipo de inmueble: ${lead.tipoInmueble}` : null,
    lead.ciudad ? `Ciudad: ${lead.ciudad}` : null,
    lead.mensaje ? `Mensaje: ${lead.mensaje}` : null,
    `Origen: ${lead.fuente}`,
    `Fecha: ${lead.creadoEn}`,
  ].filter(Boolean);
  return lines.join("\n");
}
