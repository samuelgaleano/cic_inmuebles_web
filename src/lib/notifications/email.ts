import type { Lead } from "@/lib/domain";
import { LEAD_INTENT_LABELS } from "@/lib/domain";
import { siteConfig } from "@/lib/config/site";

/**
 * Notificación por correo de nuevos leads.
 *
 * Estrategia híbrida de costo cero: si existe RESEND_API_KEY se enviará el
 * correo con Resend (capa gratuita); de lo contrario se registra en consola
 * para no bloquear el flujo en desarrollo. La integración real con Resend se
 * conecta en el siguiente paso de Fase 1 (requiere la API key).
 */
export async function sendLeadNotification(lead: Lead): Promise<void> {
  const subject =
    lead.tipo === "vendedor"
      ? `🏷️ Nuevo lead VENDEDOR: ${lead.nombre}`
      : `📩 Nuevo lead ${lead.intencion ? `(${LEAD_INTENT_LABELS[lead.intencion]})` : ""}: ${lead.nombre}`;

  const body = renderLeadEmail(lead);
  const to = process.env.LEADS_NOTIFICATION_EMAIL ?? siteConfig.email;

  const apiKey = process.env.RESEND_API_KEY;
  if (!apiKey) {
    console.info(`[leads] (correo no enviado: falta RESEND_API_KEY) -> ${to}\n${subject}\n${body}`);
    return;
  }

  try {
    const res = await fetch("https://api.resend.com/emails", {
      method: "POST",
      headers: {
        Authorization: `Bearer ${apiKey}`,
        "Content-Type": "application/json",
      },
      body: JSON.stringify({
        from: process.env.RESEND_FROM ?? "CIC Inmuebles <onboarding@resend.dev>",
        to: [to],
        subject,
        text: body,
      }),
    });
    if (!res.ok) {
      console.error("[leads] Error al enviar correo:", res.status, await res.text());
    }
  } catch (err) {
    console.error("[leads] Excepción al enviar correo:", err);
  }
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
