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
  return (await sendEmailConEstado(msg)).ok;
}

/**
 * Igual que `sendEmail`, pero devuelve también el estado HTTP de Resend (0 si no hubo respuesta).
 * Sirve para distinguir un 409 de idempotencia (esa clave ya se usó: el correo ya salió) de un fallo real.
 */
export async function sendEmailConEstado(msg: CorreoResend): Promise<{ ok: boolean; status: number }> {
  const apiKey = process.env.RESEND_API_KEY;
  if (!apiKey) {
    // Sin el asunto: el de un lead lleva el nombre de la persona (Ley 1581).
    console.warn("[correo] no enviado: falta RESEND_API_KEY");
    return { ok: false, status: 0 };
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
      // Solo el estado: el cuerpo del error puede repetir la dirección de destino.
      console.error("[correo] Resend respondió", res.status);
      return { ok: false, status: res.status };
    }
    return { ok: true, status: res.status };
  } catch (err) {
    console.error("[correo] no se pudo enviar:", err instanceof Error ? err.message : err);
    return { ok: false, status: 0 };
  }
}
