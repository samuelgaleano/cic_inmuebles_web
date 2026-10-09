/**
 * Estado de la búsqueda ⇄ URL del catálogo. Las URL existentes siguen
 * funcionando (?tipo=…&habitacionesMin=…&precioMax=…&q=…) y las nuevas son
 * compartibles: quien recibe el enlace ve exactamente la misma búsqueda.
 */
import { PROPERTY_STATUSES, PROPERTY_TYPES, type PropertyStatus, type PropertyType } from "@/lib/domain";
import { ESTADO_VACIO, ORDENES, type EstadoBusqueda, type Manual, type Orden } from "./motor";

export type ParamsEntrada = URLSearchParams | Record<string, string | string[] | undefined>;

const MAX_TEXTO = 200;

function lector(sp: ParamsEntrada) {
  if (sp instanceof URLSearchParams) {
    return {
      uno: (k: string) => sp.get(k) ?? undefined,
      varios: (k: string) => sp.getAll(k),
    };
  }
  return {
    uno: (k: string) => (Array.isArray(sp[k]) ? sp[k]![0] : sp[k]),
    varios: (k: string) => {
      const v = sp[k];
      return Array.isArray(v) ? v : v ? [v] : [];
    },
  };
}

function natural(v: string | undefined): number | undefined {
  if (!v) return undefined;
  const n = Number(v);
  return Number.isFinite(n) && n > 0 ? Math.floor(n) : undefined;
}

export function leerParams(sp: ParamsEntrada): EstadoBusqueda {
  const { uno, varios } = lector(sp);
  const tipo = uno("tipo");
  const estado = uno("estado");
  const orden = uno("orden");

  const manual: Manual = {};
  if (PROPERTY_TYPES.includes(tipo as PropertyType)) manual.tipo = tipo as PropertyType;
  if (PROPERTY_STATUSES.includes(estado as PropertyStatus)) manual.estado = estado as PropertyStatus;
  const ciudad = uno("ciudad")?.trim();
  if (ciudad) manual.ciudad = ciudad.slice(0, 80);
  const sectores = varios("sector").map((s) => s.trim().slice(0, 80)).filter(Boolean).slice(0, 8);
  if (sectores.length) manual.sectores = sectores;
  const terminos = varios("termino").map((s) => s.trim().slice(0, 40)).filter(Boolean).slice(0, 6);
  if (terminos.length) manual.terminos = terminos;

  const numeros = ["habitacionesMin", "banosMin", "parqueaderosMin", "precioMin", "precioMax", "areaMin", "areaMax"] as const;
  for (const k of numeros) {
    const n = natural(uno(k));
    if (n !== undefined) manual[k] = n;
  }

  return {
    texto: (uno("q") ?? "").slice(0, MAX_TEXTO),
    manual,
    orden: ORDENES.includes(orden as Orden) ? (orden as Orden) : ESTADO_VACIO.orden,
  };
}

export function escribirParams(e: EstadoBusqueda): URLSearchParams {
  const sp = new URLSearchParams();
  const texto = e.texto.trim();
  if (texto) sp.set("q", texto);
  const m = e.manual;
  if (m.tipo) sp.set("tipo", m.tipo);
  if (m.estado) sp.set("estado", m.estado);
  if (m.ciudad) sp.set("ciudad", m.ciudad);
  for (const s of m.sectores ?? []) sp.append("sector", s);
  for (const t of m.terminos ?? []) sp.append("termino", t);
  const numeros = ["habitacionesMin", "banosMin", "parqueaderosMin", "precioMin", "precioMax", "areaMin", "areaMax"] as const;
  for (const k of numeros) if (m[k] !== undefined) sp.set(k, String(m[k]));
  if (e.orden !== "relevancia") sp.set("orden", e.orden);
  return sp;
}

/** "?q=…&precioMax=…" o "" si no hay nada que escribir. */
export function aQuery(e: EstadoBusqueda): string {
  const s = escribirParams(e).toString();
  return s ? `?${s}` : "";
}
