import { createHmac, timingSafeEqual } from "node:crypto";

/**
 * Enlace de renovación en un clic. No se guarda nada: el token es el id del
 * servicio más una firma HMAC calculada con un secreto del servidor, así que
 * se puede regenerar para cada correo y nadie puede fabricar uno ajeno. El
 * enlace solo abre la página de planes con el plan y los datos precargados:
 * el pago lo sigue confirmando la persona en la pasarela.
 */

const UUID = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;

function secreto(): string | null {
  return process.env.RENOVACION_SECRET || process.env.CRON_SECRET || null;
}

function firma(id: string, clave: string): string {
  return createHmac("sha256", clave).update(`renovar:${id}`).digest("hex").slice(0, 32);
}

/** null si no hay secreto configurado (entonces no se arman enlaces). */
export function tokenDeRenovacion(servicioId: string): string | null {
  const clave = secreto();
  if (!clave || !UUID.test(servicioId)) return null;
  return `${servicioId}.${firma(servicioId, clave)}`;
}

/** Devuelve el id del servicio si el token es auténtico; null si no. */
export function servicioDeToken(token: string): string | null {
  const clave = secreto();
  if (!clave || typeof token !== "string" || token.length > 100) return null;
  const [id, sig] = token.split(".");
  if (!id || !sig || !UUID.test(id)) return null;
  const esperado = Buffer.from(firma(id, clave));
  const recibido = Buffer.from(sig);
  if (esperado.length !== recibido.length || !timingSafeEqual(esperado, recibido)) return null;
  return id;
}
