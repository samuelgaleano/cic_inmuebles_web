import { siteConfig } from "@/lib/config/site";

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
 * Aviso por correo cuando un pago de publicación es aprobado (u otro estado).
 * Mismo enfoque de costo cero que los leads: usa Resend si hay RESEND_API_KEY;
 * de lo contrario registra en consola sin bloquear el webhook.
 */
export async function sendPaymentNotification(p: PaymentNotice): Promise<void> {
  const pesos = p.amountInCents != null ? p.amountInCents / 100 : undefined;
  const monto = pesos != null ? `$${pesos.toLocaleString("es-CO")}` : "—";
  // El aviso se marca, nunca se descarta: perder la notificación de un pago
  // real sería peor que recibirla con una advertencia.
  const sospechoso = p.montoCoincide === false;
  const subject = `${sospechoso ? "⚠️ REVISAR — " : ""}💳 Pago ${p.status} · ${p.planNombre ?? "plan"} (${p.reference})`;
  const body = [
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

  const to = process.env.LEADS_NOTIFICATION_EMAIL ?? siteConfig.email;
  const apiKey = process.env.RESEND_API_KEY;
  if (!apiKey) {
    console.info(`[pago] (correo no enviado: falta RESEND_API_KEY) -> ${to}\n${subject}\n${body}`);
    return;
  }

  try {
    const res = await fetch("https://api.resend.com/emails", {
      method: "POST",
      headers: { Authorization: `Bearer ${apiKey}`, "Content-Type": "application/json" },
      body: JSON.stringify({
        from: process.env.RESEND_FROM ?? "CIC Inmuebles <onboarding@resend.dev>",
        to,
        subject,
        text: body,
      }),
    });
    if (!res.ok) console.error("[pago] Resend respondió", res.status, await res.text());
  } catch (err) {
    console.error("[pago] no se pudo enviar el aviso:", err);
  }
}
