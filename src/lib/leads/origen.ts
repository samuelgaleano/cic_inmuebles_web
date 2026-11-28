/**
 * Origen de un lead o de un cobro, medido sin terceros: etiquetas de campaña (utm_*), dominio del
 * referente y página de entrada de la primera vista de la sesión. Lo captura el navegador
 * (src/lib/cliente/origen.ts), viaja en campos ocultos y el servidor lo valida y recorta aquí.
 *
 * No guarda la URL completa del referente ni la consulta de la página de entrada: solo el dominio y la
 * ruta. Así no se cuela nada personal que otra página haya puesto en su URL.
 */

export interface OrigenVisita {
  utmSource?: string;
  utmMedium?: string;
  utmCampaign?: string;
  /** Dominio del sitio que trajo a la persona ("instagram.com", "google.com"). */
  referente?: string;
  /** Ruta de la primera página vista en la sesión ("/inmuebles/bella-suiza"). */
  paginaEntrada?: string;
}

/** Nombres de los campos ocultos del formulario (iguales a las columnas de la base). */
export const CAMPOS_ORIGEN = {
  utmSource: "utm_source",
  utmMedium: "utm_medium",
  utmCampaign: "utm_campaign",
  referente: "referente",
  paginaEntrada: "pagina_entrada",
} as const satisfies Record<keyof OrigenVisita, string>;

const MAX_UTM = 100;
const MAX_REFERENTE = 120;
const MAX_PAGINA = 200;

/** Texto corto y limpio: sin caracteres de control ni espacios de sobra, recortado. */
function texto(v: unknown, max: number): string | undefined {
  if (typeof v !== "string") return undefined;
  const limpio = v.replace(/[\u0000-\u001f\u007f]/g, " ").replace(/\s+/g, " ").trim().slice(0, max).trim();
  return limpio || undefined;
}

/** Un dominio de verdad ("l.instagram.com"), en minúsculas y sin "www.". Cualquier otra cosa se descarta. */
export function limpiarDominio(v: unknown): string | undefined {
  const t = texto(v, MAX_REFERENTE)?.toLowerCase().replace(/^www\./, "");
  return t && /^[a-z0-9-]+(\.[a-z0-9-]+)+$/.test(t) ? t : undefined;
}

/** Solo una ruta del propio sitio ("/vender"), sin consulta ni fragmento. */
export function limpiarRuta(v: unknown): string | undefined {
  const t = texto(v, MAX_PAGINA * 2);
  if (!t || !t.startsWith("/") || t.startsWith("//")) return undefined;
  const ruta = t.split(/[?#]/)[0].slice(0, MAX_PAGINA);
  return /^\/[\w\-./~%]*$/.test(ruta) ? ruta : undefined;
}

/** Valida y recorta lo que llegó del navegador. Lo que no cumple se descarta (nunca bloquea el envío). */
export function limpiarOrigen(raw: Partial<Record<keyof OrigenVisita, unknown>> | null | undefined): OrigenVisita | undefined {
  if (!raw || typeof raw !== "object") return undefined;
  const o: OrigenVisita = {
    utmSource: texto(raw.utmSource, MAX_UTM),
    utmMedium: texto(raw.utmMedium, MAX_UTM),
    utmCampaign: texto(raw.utmCampaign, MAX_UTM),
    referente: limpiarDominio(raw.referente),
    paginaEntrada: limpiarRuta(raw.paginaEntrada),
  };
  const lleno = Object.fromEntries(Object.entries(o).filter(([, v]) => v !== undefined)) as OrigenVisita;
  return Object.keys(lleno).length > 0 ? lleno : undefined;
}

/** Lee el origen de un FormData con los nombres de CAMPOS_ORIGEN. */
export function origenDeFormulario(fd: FormData): OrigenVisita | undefined {
  return limpiarOrigen({
    utmSource: fd.get(CAMPOS_ORIGEN.utmSource),
    utmMedium: fd.get(CAMPOS_ORIGEN.utmMedium),
    utmCampaign: fd.get(CAMPOS_ORIGEN.utmCampaign),
    referente: fd.get(CAMPOS_ORIGEN.referente),
    paginaEntrada: fd.get(CAMPOS_ORIGEN.paginaEntrada),
  });
}

/**
 * Lo que el navegador anota en la primera vista de la sesión. `host` es el del propio sitio: venir de una
 * página propia (otra pestaña) no es un referente.
 */
export function origenDePrimeraVista(v: { search: string; referrer: string; pathname: string; host: string }): OrigenVisita {
  const q = new URLSearchParams(v.search);
  let referente: string | undefined;
  try {
    const r = v.referrer ? new URL(v.referrer) : null;
    const propio = v.host.toLowerCase().replace(/^www\./, "");
    const dominio = r && /^https?:$/.test(r.protocol) ? limpiarDominio(r.hostname) : undefined;
    referente = dominio && dominio !== propio ? dominio : undefined;
  } catch {
    referente = undefined;
  }
  return (
    limpiarOrigen({
      utmSource: q.get("utm_source"),
      utmMedium: q.get("utm_medium"),
      utmCampaign: q.get("utm_campaign"),
      referente,
      paginaEntrada: v.pathname,
    }) ?? {}
  );
}

/** Resumen de una línea para el panel ("instagram / social · campaña navidad · desde instagram.com · entró por /vender"). */
export function resumenOrigen(o: OrigenVisita | undefined): string | undefined {
  if (!o) return undefined;
  const partes = [
    [o.utmSource, o.utmMedium].filter(Boolean).join(" / ") || null,
    o.utmCampaign ? `campaña ${o.utmCampaign}` : null,
    o.referente ? `desde ${o.referente}` : null,
    o.paginaEntrada ? `entró por ${o.paginaEntrada}` : null,
  ].filter(Boolean);
  return partes.length > 0 ? partes.join(" · ") : undefined;
}
