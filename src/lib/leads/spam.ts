/**
 * Detección de spam en los formularios públicos. Conservadora a propósito: perder un lead real cuesta más que
 * recibir un spam, así que solo se descarta con DOS señales a la vez. El spam típico que llegó al sitio eran
 * ofertas de SEO, videos o «indexar tu dominio en Google», casi siempre en inglés y mencionando el dominio.
 */

export interface DatosLead {
  nombre: string;
  email?: string;
  mensaje?: string;
  /** "internacional" si el teléfono no es colombiano (ver normalizarTelefono). */
  tipoTelefono?: string;
}

const ENLACE = /(https?:\/\/|www\.|\b[a-z0-9-]{2,}\.(com|net|org|live|pro|info|biz|xyz|online|site|shop|top)\b)/i;
const DOMINIO_PROPIO = /cicinmuebles/i;
const OFERTA_EN_INGLES =
  /\b(seo|backlinks?|google'?s? (search )?index|first page|1st page|search results|promotional videos?|voice-?over|pricing|packages|dear sir|hello|howdy|regards)\b/i;
const OFERTA_EN_ESPANOL = /\b(posicionamiento web|posicionar (tu|su) (sitio|p[aá]gina)|backlinks?|dise[nñ]o gr[aá]fico|renovaci[oó]n de marca|paquetes seo|tr[aá]fico web)\b/i;
const PRECIO_EN_DOLARES = /\b(usd|dollars?)\b|\bus ?\$/i;
const CORREO_RARO = /^([a-z]\.){3,}/i; // p.r.a.n.a.b…

/** Cuántas señales de spam tiene el envío (0 a 6). */
export function senalesDeSpam(d: DatosLead): number {
  const texto = `${d.nombre} ${d.mensaje ?? ""}`;
  let n = 0;
  if (ENLACE.test(texto)) n += 1;
  if (DOMINIO_PROPIO.test(texto)) n += 1;
  if (OFERTA_EN_INGLES.test(texto) || OFERTA_EN_ESPANOL.test(texto)) n += 1;
  if (PRECIO_EN_DOLARES.test(texto)) n += 1;
  if (d.tipoTelefono === "internacional") n += 1;
  if (d.email && CORREO_RARO.test(d.email)) n += 1;
  return n;
}

/** Se descarta con dos o más señales. */
export function esSpamProbable(d: DatosLead): boolean {
  return senalesDeSpam(d) >= 2;
}
