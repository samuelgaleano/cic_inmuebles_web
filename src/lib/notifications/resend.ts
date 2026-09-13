/**
 * Envío de correo con Resend (capa gratuita). Sin RESEND_API_KEY no se envía
 * nada y se devuelve false: los llamadores deciden si eso es un error o no.
 * Nunca se registra el cuerpo ni el destinatario en consola.
 */
export async function sendEmail(msg: { to: string; subject: string; text: string }): Promise<boolean> {
  const apiKey = process.env.RESEND_API_KEY;
  if (!apiKey) {
    console.warn(`[correo] no enviado: falta RESEND_API_KEY (asunto: ${msg.subject.slice(0, 60)})`);
    return false;
  }

  try {
    const res = await fetch("https://api.resend.com/emails", {
      method: "POST",
      headers: { Authorization: `Bearer ${apiKey}`, "Content-Type": "application/json" },
      signal: AbortSignal.timeout(8_000),
      body: JSON.stringify({
        from: process.env.RESEND_FROM ?? "CIC Inmuebles <onboarding@resend.dev>",
        to: [msg.to],
        subject: msg.subject,
        text: msg.text,
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
