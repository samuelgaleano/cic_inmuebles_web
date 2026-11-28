import type { Lead } from "@/lib/domain";
import { diaBogota } from "./reglas";
import type { DatosEmbudo, EstadoBusqueda, EstadoCaptacion, EstadoPropuesta } from "./tipos";

/**
 * Cuentas de /admin/reportes. Todo es puro: la página lee del servidor solo lo del mes (consultas filtradas por
 * fecha) y aquí se cuenta. Lo descartado no entra en ningún embudo.
 */

/** Bogotá no tiene horario de verano: siempre UTC-5. */
const OFFSET_BOGOTA = "-05:00";

/** "2026-11" si es un mes válido (2020 en adelante, hasta el mes actual); si no, null. */
export function leerMes(crudo: string | null | undefined, ahora: Date): string | null {
  const m = /^(\d{4})-(\d{2})$/.exec((crudo ?? "").trim());
  if (!m) return null;
  const anio = Number(m[1]);
  const mes = Number(m[2]);
  if (anio < 2020 || mes < 1 || mes > 12) return null;
  const ym = `${m[1]}-${m[2]}`;
  return ym <= mesDe(ahora) ? ym : null;
}

/** Mes calendario de Bogotá de un instante: "2026-11". */
export function mesDe(instante: Date): string {
  return diaBogota(instante).slice(0, 7);
}

/** [desde, hasta) del mes en hora de Bogotá, como ISO UTC: "2026-11" → 2026-11-01T05:00Z … 2026-12-01T05:00Z. */
export function rangoDeMes(ym: string): { desde: string; hasta: string } {
  const [a, m] = ym.split("-").map(Number);
  const siguiente = m === 12 ? `${a + 1}-01` : `${a}-${String(m + 1).padStart(2, "0")}`;
  return {
    desde: new Date(`${ym}-01T00:00:00${OFFSET_BOGOTA}`).toISOString(),
    hasta: new Date(`${siguiente}-01T00:00:00${OFFSET_BOGOTA}`).toISOString(),
  };
}

/** Los últimos `n` meses hasta el actual, del más nuevo al más viejo (para el selector). */
export function mesesRecientes(ahora: Date, n = 12): string[] {
  const [a, m] = mesDe(ahora).split("-").map(Number);
  return Array.from({ length: n }, (_, i) => new Date(Date.UTC(a, m - 1 - i, 1)).toISOString().slice(0, 7));
}

export interface EtapaEmbudo {
  etapa: string;
  /** Cuántos llegaron al menos a esta etapa. */
  cantidad: number;
  /** Porcentaje sobre la primera etapa (0 a 100, redondeado). */
  pctDelInicio: number;
}

function etapas(nombres: string[], alcance: number[]): EtapaEmbudo[] {
  const total = alcance.length;
  return nombres.map((etapa, i) => {
    const cantidad = alcance.filter((n) => n >= i).length;
    return { etapa, cantidad, pctDelInicio: total ? Math.round((cantidad / total) * 100) : 0 };
  });
}

const ORDEN_CAPTACION: Partial<Record<EstadoCaptacion, number>> = { nueva: 0, en_gestion: 1, publicada: 2, vendida: 3 };

/**
 * Vendedores: nueva → en gestión → publicada → vendida. Cada captación cuenta en su etapa y en las anteriores
 * (una vendida pasó por todas). Solo hay el estado actual, no su historia: es un embudo por cohorte del mes.
 */
export function embudoVendedores(captaciones: DatosEmbudo["captaciones"]): EtapaEmbudo[] {
  const alcance = captaciones.flatMap((c) => (ORDEN_CAPTACION[c.estado] === undefined ? [] : [ORDEN_CAPTACION[c.estado]!]));
  return etapas(["Nuevas", "En gestión", "Publicadas", "Vendidas"], alcance);
}

/** Hasta dónde llegó una búsqueda: 0 activa, 1 con propuesta, 2 visitó, 3 ofertó, 4 cerrada. */
export function alcanceBusqueda(estado: EstadoBusqueda, propuestas: EstadoPropuesta[]): number | null {
  if (estado === "descartada") return null;
  if (estado === "cerrada") return 4;
  const vivas = propuestas.filter((p) => p !== "descartado");
  if (vivas.includes("oferto")) return 3;
  if (vivas.includes("visito")) return 2;
  if (vivas.length) return 1;
  return 0;
}

/** Compradores: activa → con propuesta → visitó → ofertó → cerrada. Las propuestas descartadas no cuentan. */
export function embudoCompradores(busquedas: DatosEmbudo["busquedas"]): EtapaEmbudo[] {
  const alcance = busquedas.flatMap((b) => {
    const n = alcanceBusqueda(b.estado, b.propuestas);
    return n === null ? [] : [n];
  });
  return etapas(["Activas", "Con propuesta", "Visitaron", "Ofertaron", "Cerradas"], alcance);
}

/** De dónde vino un lead: `utm_source` si lo trae; si no, el sitio que lo refirió; si no, «directo». */
export function origenDeLead(l: Pick<Lead, "utmSource" | "referente">): string {
  const utm = l.utmSource?.trim().toLowerCase();
  if (utm) return utm;
  const ref = l.referente?.trim();
  if (ref) {
    try {
      return new URL(ref.includes("://") ? ref : `https://${ref}`).hostname.replace(/^www\./, "") || "directo";
    } catch {
      return ref.toLowerCase().slice(0, 60);
    }
  }
  return "directo";
}

export interface Conteo {
  clave: string;
  cantidad: number;
}

const ordenar = (m: Map<string, number>): Conteo[] =>
  [...m].map(([clave, cantidad]) => ({ clave, cantidad })).sort((a, b) => b.cantidad - a.cantidad || a.clave.localeCompare(b.clave));

/** Leads no descartados por origen, del que más trae al que menos. */
export function leadsPorOrigen(leads: Pick<Lead, "estado" | "utmSource" | "referente">[]): Conteo[] {
  const m = new Map<string, number>();
  for (const l of leads) {
    if (l.estado === "descartado") continue;
    const o = origenDeLead(l);
    m.set(o, (m.get(o) ?? 0) + 1);
  }
  return ordenar(m);
}

/** Leads no descartados por inmueble (id o, los anteriores al enlace, slug). Los que no preguntaron por uno van en «Sin inmueble». */
export function leadsPorInmueble(leads: Pick<Lead, "estado" | "propertyId" | "propertySlug">[]): Conteo[] {
  const m = new Map<string, number>();
  for (const l of leads) {
    if (l.estado === "descartado") continue;
    const k = l.propertyId ?? l.propertySlug ?? "";
    m.set(k, (m.get(k) ?? 0) + 1);
  }
  return ordenar(m);
}

/** Mediana en minutos entre la llegada del lead y su primer contacto; solo los no descartados que ya se contactaron. */
export function medianaPrimeraRespuesta(leads: Pick<Lead, "estado" | "creadoEn" | "primerContactoAt">[]): { minutos: number; muestra: number } | null {
  const tiempos = leads
    .filter((l) => l.estado !== "descartado" && l.primerContactoAt)
    .map((l) => (new Date(l.primerContactoAt!).getTime() - new Date(l.creadoEn).getTime()) / 60000)
    .filter((t) => Number.isFinite(t) && t >= 0)
    .sort((a, b) => a - b);
  if (!tiempos.length) return null;
  const mitad = Math.floor(tiempos.length / 2);
  const minutos = tiempos.length % 2 ? tiempos[mitad] : (tiempos[mitad - 1] + tiempos[mitad]) / 2;
  return { minutos: Math.round(minutos), muestra: tiempos.length };
}

/** "45 min", "3 h 10 min", "2 días 4 h". */
export function duracionLegible(minutos: number): string {
  const m = Math.max(0, Math.round(minutos));
  if (m < 60) return `${m} min`;
  const h = Math.floor(m / 60);
  if (h < 24) return m % 60 ? `${h} h ${m % 60} min` : `${h} h`;
  const d = Math.floor(h / 24);
  return h % 24 ? `${d} día${d === 1 ? "" : "s"} ${h % 24} h` : `${d} día${d === 1 ? "" : "s"}`;
}

export type NivelEspera = "reciente" | "atrasado" | "urgente";

/**
 * Cuánto lleva un lead «nuevo» sin que nadie le escriba: reciente hasta 1 h, atrasado hasta 24 h, urgente después.
 * null si ya se contactó (tiene primer contacto o cambió de estado).
 */
export function esperaSinContactar(l: Pick<Lead, "estado" | "creadoEn" | "primerContactoAt">, ahora: Date): { minutos: number; texto: string; nivel: NivelEspera } | null {
  if (l.estado !== "nuevo" || l.primerContactoAt) return null;
  const minutos = Math.max(0, Math.round((ahora.getTime() - new Date(l.creadoEn).getTime()) / 60000));
  const nivel: NivelEspera = minutos <= 60 ? "reciente" : minutos <= 24 * 60 ? "atrasado" : "urgente";
  return { minutos, texto: `Sin contactar hace ${duracionLegible(minutos)}`, nivel };
}
