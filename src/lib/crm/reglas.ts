import type { Property } from "@/lib/domain";
import { normalizarTelefono } from "@/lib/utils/telefono";
import type { ContactoInput, Origen } from "./tipos";

/** Reglas puras del CRM (sin base de datos), para poder probarlas. */

/** Comisión por porcentaje, redondeada al peso. Mismo cálculo que la columna generada de la base. */
export function comisionValor(precio: number | null | undefined, pct: number): number | undefined {
  if (precio === null || precio === undefined || !Number.isFinite(precio)) return undefined;
  return Math.round((precio * pct) / 100);
}

/**
 * Precios como los escribe la gente: "450.000.000", "$ 450,000,000", "450000000".
 * Vacío = sin dato (undefined). Algo que no es un número, o negativo, = null (inválido).
 */
export function leerPrecio(crudo: string | null | undefined): number | undefined | null {
  const t = (crudo ?? "").trim();
  if (!t) return undefined;
  if (!/^[\d\s.,$]+$/.test(t)) return null;
  const n = Number(t.replace(/[\s.,$]/g, ""));
  return Number.isSafeInteger(n) ? n : null;
}

/** Porcentaje 0 a 100 con coma o punto decimal ("3", "2,5"). Vacío = el predeterminado. */
export function leerPorcentaje(crudo: string | null | undefined, predeterminado = 3): number | null {
  const t = (crudo ?? "").trim().replace(",", ".");
  if (!t) return predeterminado;
  if (!/^\d+(\.\d+)?$/.test(t)) return null;
  const n = Number(t);
  return n >= 0 && n <= 100 ? Math.round(n * 100) / 100 : null;
}

export type ResultadoContacto = { ok: true; valor: ContactoInput } | { ok: false; errores: Record<string, string> };

const EMAIL = /^[^\s@]+@[^\s@]+\.[^\s@]{2,}$/;

/** Valida y normaliza los datos de un contacto. El teléfono se guarda legible y en formato internacional. */
export function validarContacto(datos: {
  nombre?: string;
  telefono?: string;
  email?: string;
  ciudad?: string;
  notas?: string;
  origen?: Origen;
}): ResultadoContacto {
  const errores: Record<string, string> = {};
  const nombre = (datos.nombre ?? "").trim().replace(/\s+/g, " ");
  if (nombre.length < 2) errores.nombre = "Escribe el nombre.";
  if (nombre.length > 120) errores.nombre = "El nombre es demasiado largo.";

  let telefono: string | undefined;
  let telefonoE164: string | undefined;
  const crudo = (datos.telefono ?? "").trim();
  if (crudo) {
    const n = normalizarTelefono(crudo);
    if (!n) errores.telefono = "Revisa el teléfono: no parece un número válido.";
    else {
      telefono = n.legible;
      telefonoE164 = n.e164;
    }
  }

  const email = (datos.email ?? "").trim().toLowerCase();
  if (email && (!EMAIL.test(email) || email.length > 160)) errores.email = "Revisa el correo.";

  const limpiar = (t: string | undefined, max: number) => (t ?? "").trim().slice(0, max) || undefined;
  if (Object.keys(errores).length) return { ok: false, errores };
  return {
    ok: true,
    valor: {
      nombre,
      ...(telefono ? { telefono } : {}),
      ...(telefonoE164 ? { telefonoE164 } : {}),
      ...(email ? { email } : {}),
      ...(limpiar(datos.ciudad, 80) ? { ciudad: limpiar(datos.ciudad, 80) } : {}),
      ...(limpiar(datos.notas, 2000) ? { notas: limpiar(datos.notas, 2000) } : {}),
      origen: datos.origen ?? "manual",
    },
  };
}

/** Sin tildes, en minúscula y sin signos: para comparar ubicaciones escritas a mano. */
export function sinTildes(t: string): string {
  return t
    .normalize("NFD")
    .replace(/[̀-ͯ]/g, "")
    .toLowerCase()
    .replace(/[^a-z0-9\s]/g, " ")
    .replace(/\s+/g, " ")
    .trim();
}

export interface Sugerencia {
  property: Property;
  /** Por qué se sugiere, para mostrarlo. */
  motivo: string;
  puntos: number;
}

const PALABRAS_VACIAS = new Set(["de", "del", "la", "el", "los", "las", "en", "y", "cerca", "zona", "sector", "barrio"]);

/**
 * Inmuebles disponibles que encajan con lo que busca un comprador. Determinista y explicable:
 * dentro del presupuesto (con 10 % de margen para negociar) y, si dio ubicación, que alguna de
 * sus palabras aparezca en ciudad, sector, conjunto o título. Quedan fuera los ya propuestos.
 */
export function sugerirInmuebles(
  busqueda: { ubicacion?: string; precioMax?: number },
  inmuebles: Property[],
  yaPropuestos: string[] = [],
  limite = 5,
): Sugerencia[] {
  const excluidos = new Set(yaPropuestos);
  const palabras = sinTildes(busqueda.ubicacion ?? "")
    .split(" ")
    .filter((p) => p.length > 2 && !PALABRAS_VACIAS.has(p));

  const resultado: Sugerencia[] = [];
  for (const p of inmuebles) {
    if (p.estado !== "disponible" || excluidos.has(p.id)) continue;
    let puntos = 0;
    const motivos: string[] = [];

    if (busqueda.precioMax !== undefined) {
      if (p.precio > busqueda.precioMax * 1.1) continue;
      puntos += p.precio <= busqueda.precioMax ? 2 : 1;
      motivos.push(p.precio <= busqueda.precioMax ? "dentro del presupuesto" : "hasta 10 % sobre el presupuesto");
    }
    if (palabras.length) {
      const donde = sinTildes([p.ubicacion.ciudad, p.ubicacion.sector, p.ubicacion.conjunto, p.titulo].filter(Boolean).join(" "));
      const aciertos = palabras.filter((w) => donde.includes(w));
      if (!aciertos.length) continue;
      puntos += 2 + aciertos.length;
      motivos.push(`zona: ${aciertos.join(", ")}`);
    }
    if (puntos === 0 && (busqueda.precioMax !== undefined || palabras.length)) continue;
    if (puntos === 0) motivos.push("disponible");
    resultado.push({ property: p, motivo: motivos.join(" · "), puntos });
  }
  return resultado.sort((a, b) => b.puntos - a.puntos || b.property.precio - a.property.precio).slice(0, limite);
}
