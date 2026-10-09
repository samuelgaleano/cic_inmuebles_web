/**
 * Motor de la búsqueda del catálogo: junta lo que el visitante ESCRIBE (frase
 * interpretada) con lo que ELIGE (hoja de filtros) y devuelve resultados
 * ordenados, con la razón de cada uno y, si no hay ninguno, qué ampliar.
 * Puro y sin dependencias de React: corre igual en el servidor (primer render
 * de /inmuebles) y en el navegador (respuesta instantánea al teclear).
 */
import type { PropertyStatus } from "@/lib/domain";
import { coincide, ordenar, razones, relajaciones, type Relajacion } from "./evaluar";
import type { ItemIndice } from "./indice";
import { interpretar, type ContextoBusqueda, type FiltrosInterpretados, type Interpretacion } from "./interpretar";

export const ORDENES = ["relevancia", "precio_asc", "precio_desc", "recientes"] as const;
export type Orden = (typeof ORDENES)[number];

export const ETIQUETA_ORDEN: Record<Orden, string> = {
  relevancia: "Relevancia",
  precio_asc: "Precio: de menor a mayor",
  precio_desc: "Precio: de mayor a menor",
  recientes: "Más recientes",
};

/** Filtros elegidos a mano en la hoja de filtros (mandan sobre lo que diga la frase). */
export interface Manual extends FiltrosInterpretados {
  estado?: PropertyStatus;
}

export interface EstadoBusqueda {
  texto: string;
  manual: Manual;
  orden: Orden;
}

export interface Resultado {
  item: ItemIndice;
  /** Por qué aparece (vacío si no hay criterios). */
  razones: string[];
}

export interface Busqueda {
  interpretacion: Interpretacion;
  /** Lo interpretado + lo elegido a mano. */
  filtros: Manual;
  resultados: Resultado[];
  /** Solo si no hubo resultados: qué ampliar para que sí los haya. */
  relajaciones: Relajacion[];
}

export const ESTADO_VACIO: EstadoBusqueda = { texto: "", manual: {}, orden: "relevancia" };

/** Lo elegido a mano reemplaza, campo a campo, lo interpretado de la frase. */
export function combinar(interpretados: FiltrosInterpretados, manual: Manual): Manual {
  const out: Manual = { ...interpretados };
  for (const [clave, valor] of Object.entries(manual)) {
    if (valor === undefined) continue;
    if (clave === "terminos") {
      out.terminos = [...(interpretados.terminos ?? []), ...(valor as string[])];
    } else {
      (out as Record<string, unknown>)[clave] = valor;
    }
  }
  return out;
}

export function tieneCriterios(f: Manual): boolean {
  return Object.values(f).some((v) => (Array.isArray(v) ? v.length > 0 : v !== undefined));
}

const RANGO_ESTADO: Record<PropertyStatus, number> = { disponible: 0, en_proceso: 1, vendido: 2 };

/** Lo que se puede comprar va primero; dentro de cada estado, el criterio elegido. */
function aplicarOrden(items: ItemIndice[], f: Manual, orden: Orden): ItemIndice[] {
  if (orden === "relevancia") return ordenar(items, f);
  const porClave = (a: ItemIndice, b: ItemIndice) =>
    orden === "precio_asc"
      ? a.precio - b.precio
      : orden === "precio_desc"
        ? b.precio - a.precio
        : b.actualizadoEn.localeCompare(a.actualizadoEn);
  return items
    .map((item, i) => ({ item, i }))
    .sort((a, b) => RANGO_ESTADO[a.item.estado] - RANGO_ESTADO[b.item.estado] || porClave(a.item, b.item) || a.i - b.i)
    .map((x) => x.item);
}

export function buscar(indice: ItemIndice[], e: EstadoBusqueda, ctx: ContextoBusqueda): Busqueda {
  const interpretacion = interpretar(e.texto, ctx);
  const filtros = combinar(interpretacion.filtros, e.manual);
  const criterios = tieneCriterios(filtros);

  const base = filtros.estado ? indice.filter((i) => i.estado === filtros.estado) : indice;
  const coinciden = base.filter((i) => coincide(i, filtros));
  const resultados: Resultado[] = aplicarOrden(coinciden, filtros, e.orden).map((item) => ({
    item,
    razones: criterios ? razones(item, filtros) : [],
  }));

  return {
    interpretacion,
    filtros,
    resultados,
    relajaciones: resultados.length === 0 && criterios ? relajaciones(base, filtros) : [],
  };
}
