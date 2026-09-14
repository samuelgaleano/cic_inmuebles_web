import { siteConfig } from "@/lib/config/site";
import { sendEmail } from "./resend";

export interface PaymentNotice {
  reference: string;
  status: string;
  transactionId?: string;
  amountInCents?: number;
  planNombre?: string;
  customerEmail?: string | null;
  /** false si el monto cobrado no corresponde al precio del plan. */
  montoCoincide?: boolean;
}

/**
 * Aviso al negocio cuando un pago de publicación queda aprobado. Devuelve true
 * solo si Resend aceptó el correo: el llamador marca la notificación como
 * hecha únicamente en ese caso, para que un fallo se reintente después.
 */
export async function sendPaymentNotification(p: PaymentNotice): Promise<boolean> {
  const pesos = p.amountInCents != null ? p.amountInCents / 100 : undefined;
  const monto = pesos != null ? `$${pesos.toLocaleString("es-CO")}` : "—";
  // El aviso se marca, nunca se descarta: perder la notificación de un pago
  // real sería peor que recibirla con una advertencia.
  const sospechoso = p.montoCoincide === false;
  const subject = `${sospechoso ? "⚠️ REVISAR — " : ""}💳 Pago ${p.status} · ${p.planNombre ?? "plan"} (${p.reference})`;
  const text = [
    sospechoso
      ? "⚠️ ATENCIÓN: el monto pagado NO corresponde al precio del plan. Verifica la transacción en el panel de Wompi antes de activar la publicación."
      : null,
    `Estado: ${p.status}`,
    `Plan: ${p.planNombre ?? "—"}`,
    `Monto: ${monto}`,
    `Referencia: ${p.reference}`,
    p.transactionId ? `Transacción Wompi: ${p.transactionId}` : null,
    p.customerEmail ? `Cliente: ${p.customerEmail}` : null,
  ]
    .filter(Boolean)
    .join("\n");

  return sendEmail({
    to: process.env.LEADS_NOTIFICATION_EMAIL ?? siteConfig.email,
    subject,
    text,
  });
}

// PORTABLE A OTRO COMERCIO: solo la etiqueta del asunto identifica de qué
// sitio viene la alerta — cámbiala por el nombre del nuevo negocio.
const ALERT_TAG = "CIC pagos";

/**
 * Alerta operativa para Pixies (no para el cliente): referencias sin destino,
 * montos que no cuadran, Resend caído, pendientes en la reconciliación.
 */
export async function sendPagosAlert(subject: string, text: string): Promise<boolean> {
  const to = process.env.PAGOS_ALERT_EMAIL;
  if (!to) {
    console.warn(`[pago] alerta no enviada: falta PAGOS_ALERT_EMAIL (${subject.slice(0, 60)})`);
    return false;
  }
  return sendEmail({ to, subject: `[${ALERT_TAG}] ${subject}`, text });
}
