import { createHmac, timingSafeEqual } from "node:crypto";

/**
 * Enlace de renovación en un clic. No se guarda nada: el token es el id del
 * servicio, una fecha de caducidad y una firma HMAC calculada con un secreto
 * del servidor, así que nadie puede fabricar uno ajeno ni usar uno viejo. El
 * enlace solo abre la página de planes con el plan y los datos precargados: el
 * pago lo sigue confirmando la persona en la pasarela.
 */

const UUID = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;
const DIA_S = 86_400;
/** El enlace sirve hasta 30 días después del vencimiento (o de hoy, si aún no vence). */
const VALIDEZ_DIAS = 30;

function secreto(): string | null {
  // RENOVACION_SECRET es el propio; CRON_SECRET queda solo como respaldo para no romper enlaces si falta.
  return process.env.RENOVACION_SECRET || process.env.CRON_SECRET || null;
}

function firma(id: string, exp: number, clave: string): string {
  return createHmac("sha256", clave).update(`renovar:${id}:${exp}`).digest("hex").slice(0, 32);
}

/** null si no hay secreto configurado (entonces no se arman enlaces). */
export function tokenDeRenovacion(servicioId: string, opts: { venceAt?: string | null; ahora?: Date } = {}): string | null {
  const clave = secreto();
  if (!clave || !UUID.test(servicioId)) return null;
  const ahora = Math.floor((opts.ahora ?? new Date()).getTime() / 1000);
  const vence = opts.venceAt ? Math.floor(new Date(opts.venceAt).getTime() / 1000) : 0;
  const exp = Math.max(ahora, Number.isFinite(vence) ? vence : 0) + VALIDEZ_DIAS * DIA_S;
  return `${servicioId}.${exp}.${firma(servicioId, exp, clave)}`;
}

/** Devuelve el id del servicio si el token es auténtico y no ha caducado; null si no. */
export function servicioDeToken(token: string, ahora: Date = new Date()): string | null {
  const clave = secreto();
  if (!clave || typeof token !== "string" || token.length > 120) return null;
  const [id, expTxt, sig, ...resto] = token.split(".");
  if (resto.length || !id || !expTxt || !sig || !UUID.test(id) || !/^\d{9,11}$/.test(expTxt)) return null;
  const exp = Number(expTxt);
  const esperado = Buffer.from(firma(id, exp, clave));
  const recibido = Buffer.from(sig);
  if (esperado.length !== recibido.length || !timingSafeEqual(esperado, recibido)) return null;
  if (exp * 1000 < ahora.getTime()) return null;
  return id;
}
