/**
 * Evaluación de resultados de la búsqueda inteligente: qué inmuebles cumplen
 * los filtros, POR QUÉ aparece cada uno (explicable, con datos reales) y qué
 * ampliar cuando no hay ninguno. Opera sobre `Buscable`, una vista mínima y
 * serializable de un inmueble, para correr idéntico en servidor y navegador.
 */
import {
  PROPERTY_TYPE_LABELS,
  type Property,
  type PropertyStatus,
  type PropertyType,
} from "@/lib/domain";
import { enMillones, normalizarTexto, type FiltrosInterpretados } from "./interpretar";

export interface Buscable {
  id: string;
  tipo: PropertyType;
  estado: PropertyStatus;
  precio: number;
  ciudad: string;
  sector?: string;
  conjunto?: string;
  habitaciones?: number;
  banos?: number;
  area?: number;
  parqueaderos?: number;
  /** Texto ya normalizado (normalizarTexto): título, descripción, sector, conjunto, ciudad y código. */
  texto: string;
}

/** Vista buscable de un inmueble del catálogo. */
export function aBuscable(p: Pick<Property, "id" | "titulo" | "descripcion" | "codigo" | "tipo" | "estado" | "precio" | "ubicacion" | "caracteristicas">): Buscable {
  return {
    id: p.id,
    tipo: p.tipo,
    estado: p.estado,
    precio: p.precio,
    ciudad: p.ubicacion.ciudad,
    sector: p.ubicacion.sector,
    conjunto: p.ubicacion.conjunto,
    habitaciones: p.caracteristicas.habitaciones,
    banos: p.caracteristicas.banos,
    area: p.caracteristicas.area,
    parqueaderos: p.caracteristicas.parqueaderos,
    texto: normalizarTexto(
      [p.titulo, p.descripcion, p.ubicacion.sector, p.ubicacion.conjunto, p.ubicacion.ciudad, p.codigo]
        .filter(Boolean)
        .join(" "),
    ),
  };
}

/** "chimeneas" → "chimenea" (singular/plural sencillo del español). */
function raiz(t: string): string {
  if (t.length > 5 && t.endsWith("es")) return t.slice(0, -2);
  if (t.length > 3 && t.endsWith("s")) return t.slice(0, -1);
  return t;
}

function contienePalabra(texto: string, termino: string): boolean {
  const t = normalizarTexto(termino);
  if (!t) return true;
  const palabras = texto.split(" ");
  const candidatos = [...new Set([t, raiz(t)])];
  return palabras.some((p) => candidatos.some((c) => p.startsWith(c)));
}

/** ¿Cumple el inmueble TODOS los criterios? Un dato ausente no cumple un criterio que lo exige. */
export function coincide(item: Buscable, f: FiltrosInterpretados): boolean {
  if (f.tipo && item.tipo !== f.tipo) return false;
  if (f.ciudad && normalizarTexto(item.ciudad) !== normalizarTexto(f.ciudad)) return false;
  if (f.sectores?.length) {
    const sector = normalizarTexto(item.sector ?? "");
    if (!f.sectores.some((s) => normalizarTexto(s) === sector)) return false;
  }
  if (f.precioMin != null && item.precio < f.precioMin) return false;
  if (f.precioMax != null && item.precio > f.precioMax) return false;
  if (f.habitacionesMin != null && (item.habitaciones ?? -1) < f.habitacionesMin) return false;
  if (f.banosMin != null && (item.banos ?? -1) < f.banosMin) return false;
  if (f.parqueaderosMin != null && (item.parqueaderos ?? -1) < f.parqueaderosMin) return false;
  if (f.areaMin != null && (item.area ?? -1) < f.areaMin) return false;
  if (f.areaMax != null && (item.area ?? Infinity) > f.areaMax) return false;
  if (f.terminos?.length && !f.terminos.every((t) => contienePalabra(item.texto, t))) return false;
  return true;
}

/** Razones concretas, con los datos reales del inmueble, por las que cumple la búsqueda. */
export function razones(item: Buscable, f: FiltrosInterpretados): string[] {
  const r: string[] = [];
  if (f.tipo) r.push(PROPERTY_TYPE_LABELS[item.tipo]);
  if (f.sectores?.length && item.sector) r.push(`En ${item.sector}`);
  else if (f.ciudad) r.push(`En ${item.ciudad}`);
  if (f.precioMax != null) r.push("Dentro de tu presupuesto");
  else if (f.precioMin != null) r.push(`Desde ${enMillones(f.precioMin)}`);
  if (f.habitacionesMin != null && item.habitaciones != null) r.push(`${item.habitaciones} habitaciones`);
  if (f.banosMin != null && item.banos != null) r.push(`${item.banos} baños`);
  if (f.parqueaderosMin != null && item.parqueaderos != null) {
    r.push(`${item.parqueaderos} ${item.parqueaderos === 1 ? "parqueadero" : "parqueaderos"}`);
  }
  if ((f.areaMin != null || f.areaMax != null) && item.area != null) r.push(`${item.area} m²`);
  for (const t of f.terminos ?? []) r.push(`Menciona «${t}»`);
  return r;
}

const RANGO_ESTADO: Record<PropertyStatus, number> = { disponible: 0, en_proceso: 1, vendido: 2 };

/**
 * Orden de resultados: lo que se puede comprar primero y, dentro de cada
 * estado, lo más cercano al tope del presupuesto (lo mejor que alcanza).
 * Estable: sin presupuesto conserva el orden de entrada.
 */
export function ordenar<T extends Buscable>(items: T[], f: FiltrosInterpretados): T[] {
  return items
    .map((item, i) => ({ item, i }))
    .sort((a, b) => {
      const porEstado = RANGO_ESTADO[a.item.estado] - RANGO_ESTADO[b.item.estado];
      if (porEstado !== 0) return porEstado;
      if (f.precioMax != null) {
        const da = Math.abs(f.precioMax - a.item.precio);
        const db = Math.abs(f.precioMax - b.item.precio);
        if (da !== db) return da - db;
      }
      return a.i - b.i;
    })
    .map((x) => x.item);
}

export interface Relajacion {
  etiqueta: string;
  filtros: FiltrosInterpretados;
  total: number;
}

type Paso = { etiqueta: (f: FiltrosInterpretados) => string; aplica: (f: FiltrosInterpretados) => boolean; aplicar: (f: FiltrosInterpretados) => FiltrosInterpretados };

const sin = <K extends keyof FiltrosInterpretados>(f: FiltrosInterpretados, ...claves: K[]): FiltrosInterpretados => {
  const copia = { ...f };
  for (const c of claves) delete copia[c];
  return copia;
};

/** Pasos de relajación, del que menos cambia lo pedido al que más. */
const PASOS: Paso[] = [
  {
    aplica: (f) => !!f.terminos?.length,
    etiqueta: (f) => `Quitar «${f.terminos!.join(", ")}»`,
    aplicar: (f) => sin(f, "terminos"),
  },
  {
    aplica: (f) => (f.habitacionesMin ?? 0) > 1,
    etiqueta: (f) => `${f.habitacionesMin! - 1}+ habitaciones en vez de ${f.habitacionesMin}+`,
    aplicar: (f) => ({ ...f, habitacionesMin: f.habitacionesMin! - 1 }),
  },
  {
    aplica: (f) => f.precioMax != null,
    etiqueta: (f) => `Subir el presupuesto hasta ${enMillones(Math.round(f.precioMax! * 1.15))}`,
    aplicar: (f) => ({ ...f, precioMax: Math.round(f.precioMax! * 1.15) }),
  },
  {
    aplica: (f) => f.parqueaderosMin != null,
    etiqueta: () => "Sin exigir parqueadero",
    aplicar: (f) => sin(f, "parqueaderosMin"),
  },
  {
    aplica: (f) => f.banosMin != null,
    etiqueta: () => "Sin exigir baños",
    aplicar: (f) => sin(f, "banosMin"),
  },
  {
    aplica: (f) => f.areaMin != null || f.areaMax != null,
    etiqueta: () => "Sin filtro de área",
    aplicar: (f) => sin(f, "areaMin", "areaMax"),
  },
  {
    aplica: (f) => !!f.sectores?.length,
    etiqueta: () => "Buscar en todos los sectores",
    aplicar: (f) => sin(f, "sectores"),
  },
  {
    aplica: (f) => f.habitacionesMin != null,
    etiqueta: () => "Sin exigir habitaciones",
    aplicar: (f) => sin(f, "habitacionesMin"),
  },
  {
    aplica: (f) => f.precioMax != null || f.precioMin != null,
    etiqueta: () => "Sin límite de precio",
    aplicar: (f) => sin(f, "precioMax", "precioMin"),
  },
];

/**
 * Cuando no hay resultados: qué ampliar para que sí los haya, con el conteo.
 * Primero cada paso por separado; si ninguno basta, los acumula en orden hasta
 * que aparezcan resultados (y los nombra todos, para no esconder nada).
 */
export function relajaciones(items: Buscable[], f: FiltrosInterpretados, max = 3): Relajacion[] {
  const total = (g: FiltrosInterpretados) => items.filter((x) => coincide(x, g)).length;
  if (total(f) > 0) return [];

  const sueltas: Relajacion[] = [];
  for (const paso of PASOS) {
    if (!paso.aplica(f)) continue;
    const g = paso.aplicar(f);
    const t = total(g);
    if (t > 0) sueltas.push({ etiqueta: paso.etiqueta(f), filtros: g, total: t });
  }
  if (sueltas.length > 0) return sueltas.slice(0, max);

  let actual = f;
  const etiquetas: string[] = [];
  for (const paso of PASOS) {
    if (!paso.aplica(actual)) continue;
    etiquetas.push(paso.etiqueta(actual));
    actual = paso.aplicar(actual);
    const t = total(actual);
    if (t > 0) return [{ etiqueta: etiquetas.join(" · "), filtros: actual, total: t }];
  }
  return [];
}
