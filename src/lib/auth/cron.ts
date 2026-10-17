import crypto from "node:crypto";

/**
 * Autoriza una llamada de cron: Vercel envia `Authorization: Bearer <CRON_SECRET>`
 * cuando la variable CRON_SECRET existe. Sin la variable no pasa nadie.
 *
 * La comparacion es en tiempo constante: se comparan las huellas sha256 (mismo
 * largo siempre) con `crypto.timingSafeEqual`, asi el tiempo de respuesta no
 * delata cuantos caracteres del secreto acerto quien prueba.
 */
export function autorizadoCron(req: Request): boolean {
  const secret = process.env.CRON_SECRET;
  if (!secret) return false;
  const recibido = req.headers.get("authorization") ?? "";
  const esperado = `Bearer ${secret}`;
  const a = crypto.createHash("sha256").update(recibido).digest();
  const b = crypto.createHash("sha256").update(esperado).digest();
  return crypto.timingSafeEqual(a, b);
}
