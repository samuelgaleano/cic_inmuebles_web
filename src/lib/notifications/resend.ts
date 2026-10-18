/**
 * Envío de correo con Resend (capa gratuita). Sin RESEND_API_KEY no se envía
 * nada y se devuelve false: los llamadores deciden si eso es un error o no.
 * Nunca se registra el cuerpo ni el destinatario en consola.
 */
export interface CorreoResend {
  to: string;
  subject: string;
  text: string;
  /** Versión con diseño; el texto sigue yendo como respaldo (correo multiparte). */
  html?: string;
  /** A dónde llegan las respuestas (el remitente de Resend no tiene buzón). */
  replyTo?: string | null;
  /** Clave de idempotencia de Resend: el mismo envío repetido no genera un segundo correo. */
  idempotencyKey?: string;
}

export async function sendEmail(msg: CorreoResend): Promise<boolean> {
  const apiKey = process.env.RESEND_API_KEY;
  if (!apiKey) {
    console.warn(`[correo] no enviado: falta RESEND_API_KEY (asunto: ${msg.subject.slice(0, 60)})`);
    return false;
  }

  try {
    const res = await fetch("https://api.resend.com/emails", {
      method: "POST",
      headers: {
        Authorization: `Bearer ${apiKey}`,
        "Content-Type": "application/json",
        ...(msg.idempotencyKey ? { "Idempotency-Key": msg.idempotencyKey.slice(0, 256) } : {}),
      },
      signal: AbortSignal.timeout(8_000),
      body: JSON.stringify({
        from: process.env.RESEND_FROM ?? "CIC Inmuebles <onboarding@resend.dev>",
        to: [msg.to],
        subject: msg.subject,
        text: msg.text,
        ...(msg.html ? { html: msg.html } : {}),
        ...(msg.replyTo ? { reply_to: msg.replyTo } : {}),
      }),
    });
    if (!res.ok) {
      console.error("[correo] Resend respondió", res.status, (await res.text()).slice(0, 200));
      return false;
    }
    return true;
  } catch (err) {
    console.error("[correo] no se pudo enviar:", err instanceof Error ? err.message : err);
    return false;
  }
}
