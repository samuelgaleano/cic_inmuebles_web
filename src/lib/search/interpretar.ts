/**
 * Búsqueda inteligente: convierte una frase en español de Colombia
 * ("apartamento de 3 alcobas en Bella Suiza con parqueadero, hasta 900 millones")
 * en filtros estructurados + "chips" editables que muestran QUÉ se entendió.
 *
 * Es determinista y gratuita: reglas, no un modelo de lenguaje. No inventa
 * nada: solo reconoce lo que está escrito, y los lugares únicamente si existen
 * en el inventario real (`ContextoBusqueda`). Lo que no entiende queda como
 * "término" de texto y se busca en la descripción. Corre igual en el navegador
 * (vista previa instantánea) y en el servidor (resultados de /inmuebles).
 *
 * Invariante clave: la versión normalizada del texto conserva EXACTAMENTE la
 * longitud del original (un carácter → un carácter), así cada chip puede decir
 * en qué fragmento del texto del usuario está y quitarlo sin tocar el resto.
 */
import { PROPERTY_TYPE_LABELS, type PropertyType } from "@/lib/domain";

export interface ContextoBusqueda {
  /** Sectores reales del inventario (con su grafía original). */
  sectores: string[];
  /** Ciudades reales del inventario. */
  ciudades: string[];
}

export interface FiltrosInterpretados {
  tipo?: PropertyType;
  ciudad?: string;
  sectores?: string[];
  habitacionesMin?: number;
  banosMin?: number;
  parqueaderosMin?: number;
  precioMin?: number;
  precioMax?: number;
  areaMin?: number;
  areaMax?: number;
  /** Palabras no reconocidas, buscadas en título y descripción (todas deben aparecer). */
  terminos?: string[];
}

export type TipoChip =
  | "tipo"
  | "precio"
  | "habitaciones"
  | "banos"
  | "parqueaderos"
  | "area"
  | "sector"
  | "ciudad"
  | "termino";

export interface Chip {
  id: string;
  tipo: TipoChip;
  etiqueta: string;
  /** Fragmentos [inicio, fin) del texto ORIGINAL que originaron este chip. */
  spans: [number, number][];
}

export interface Interpretacion {
  texto: string;
  filtros: FiltrosInterpretados;
  chips: Chip[];
}

// ─────────────────────────── normalización ───────────────────────────

/** Minúsculas, sin tildes, y SIEMPRE la misma longitud que la entrada. */
export function normalizar(texto: string): string {
  let out = "";
  for (let i = 0; i < texto.length; i++) {
    const n = texto[i].normalize("NFKD").replace(/\p{M}/gu, "").toLowerCase();
    out += n.length === 1 ? n : " ";
  }
  return out;
}

/** Normalización "de texto" para comparar palabras (no necesita conservar longitud). */
export function normalizarTexto(texto: string): string {
  return texto
    .normalize("NFKD")
    .replace(/\p{M}/gu, "")
    .toLowerCase()
    .replace(/[^a-z0-9ñ]+/g, " ")
    .trim();
}

// ─────────────────────────── números y dinero ───────────────────────────

/** "1.500" → 1500 (miles) · "1.5" / "1,5" → 1,5 (decimal) · "900" → 900. */
function numeroEs(s: string): number {
  if (/^\d{1,3}(?:[.,]\d{3})+$/.test(s)) return Number(s.replace(/[.,]/g, ""));
  if (/^\d+[.,]\d+$/.test(s)) return Number(s.replace(",", "."));
  return Number(s);
}

const NUM = String.raw`\d{1,3}(?:[.,]\d{3})+|\d+(?:[.,]\d+)?`;
const UNIDAD = String.raw`mil\s+millones|millones|millon|mm`;

function aPesos(n: number, unidad: string): number {
  const u = unidad.replace(/\s+/g, " ");
  if (u === "mil millones") return Math.round(n * 1e9);
  return Math.round(n * 1e6);
}

const QUAL_MAX = String.raw`hasta|maximo|max|menos de|menor a|por debajo de|no mas de|tope|presupuesto(?:\s+maximo)?(?:\s+de)?|a lo sumo`;
const QUAL_MIN = String.raw`desde|minimo|min|mas de|mayor a|a partir de|por encima de|superior a`;
const QUAL_AROUND = String.raw`alrededor de|cerca de|aproximadamente|aprox|unos|como`;
const QUAL = `${QUAL_MAX}|${QUAL_MIN}|${QUAL_AROUND}`;

type ClaseQual = "max" | "min" | "around" | "none";
function claseQual(q: string | undefined): ClaseQual {
  if (!q) return "none";
  if (new RegExp(`^(?:${QUAL_MIN})$`).test(q)) return "min";
  if (new RegExp(`^(?:${QUAL_AROUND})$`).test(q)) return "around";
  return "max";
}

/** Agrupa con punto como separador de miles: 1500 → "1.500". */
function agrupar(n: number): string {
  return String(Math.round(n)).replace(/\B(?=(\d{3})+(?!\d))/g, ".");
}

/** 900_000_000 → "$900 M" · 1_500_000_000 → "$1.500 M" · 1_250_000 → "$1,3 M". */
export function enMillones(pesos: number): string {
  const m = pesos / 1e6;
  const redondeado = Math.abs(m - Math.round(m)) < 0.05 ? Math.round(m) : Math.round(m * 10) / 10;
  return `$${agrupar(redondeado).replace(/\.(\d)$/, ",$1")} M`;
}

// ─────────────────────────── vocabulario ───────────────────────────

const PALABRAS_NUM: Record<string, number> = {
  uno: 1, una: 1, un: 1, dos: 2, tres: 3, cuatro: 4, cinco: 5, seis: 6, siete: 7, ocho: 8, nueve: 9, diez: 10,
};
const cantidad = (s: string): number => (/^\d+$/.test(s) ? Number(s) : PALABRAS_NUM[s]);
const CANT = String.raw`\d+|uno|una|un|dos|tres|cuatro|cinco|seis|siete|ocho|nueve|diez`;

const TIPOS: [RegExp, PropertyType][] = [
  [/\bcasa\s+campestre\b/, "casa_campestre"],
  [/\bapartaestudios?\b/, "apartaestudio"],
  [/\b(?:apartamentos?|aptos?|apartamento)\b/, "apartamento"],
  [/\bcasas?\b/, "casa"],
  [/\boficinas?\b/, "oficina"],
  [/\blocal(?:es)?\b/, "local"],
  [/\bbodegas?\b/, "bodega"],
  [/\blotes?\b/, "lote"],
  [/\bfincas?\b/, "finca"],
];

const ARTICULOS = new Set(["la", "el", "los", "las", "de", "del", "y", "en"]);

const RELLENO = new Set(
  (
    "a al algo ante aqui busco buscar buscando cerca como con cual de del desde el ella en entre era es esta este " +
    "favor gustaria gracias hay hola inmueble inmuebles la las lo los me mi mis millones millon mil muy necesito o " +
    "para pero por porfa que quiero quisiera se si sin sobre su sus tal tambien te tenga tengan tiene un una unas " +
    "unos y ya zona sector barrio ubicado ubicada propiedad propiedades venta vender comprar compra disponible " +
    "disponibles bonito bonita buen buena bueno ver ojala"
  ).split(" "),
);

const CONECTORES = new Set(["en", "de", "del", "por", "con", "y", "o", "para", "a", "la", "el"]);
const CALIFICADORES = new Set([
  "hasta", "desde", "entre", "minimo", "maximo", "max", "min", "mas", "menos", "alrededor",
  "cerca", "aproximadamente", "aprox", "presupuesto", "tope", "unos", "como",
]);

// ─────────────────────────── utilidades de texto ───────────────────────────

function levenshtein(a: string, b: string): number {
  if (a === b) return 0;
  const prev = Array.from({ length: b.length + 1 }, (_, i) => i);
  for (let i = 1; i <= a.length; i++) {
    let diag = prev[0];
    prev[0] = i;
    for (let j = 1; j <= b.length; j++) {
      const tmp = prev[j];
      prev[j] = Math.min(prev[j] + 1, prev[j - 1] + 1, diag + (a[i - 1] === b[j - 1] ? 0 : 1));
      diag = tmp;
    }
  }
  return prev[b.length];
}

/** Quita fragmentos del texto original y limpia espacios y conectores huérfanos. */
export function quitarSpans(texto: string, spans: [number, number][]): string {
  const ordenados = [...spans].sort((a, b) => b[0] - a[0]);
  let out = texto;
  for (const [ini, fin] of ordenados) out = out.slice(0, ini) + " " + out.slice(fin);
  const tokens = out.split(/\s+/).filter(Boolean);
  const limpios: string[] = [];
  tokens.forEach((t, i) => {
    const n = normalizarTexto(t);
    const sig = normalizarTexto(tokens[i + 1] ?? "");
    const huerfano = CONECTORES.has(n) && (i === tokens.length - 1 || CONECTORES.has(sig) || CALIFICADORES.has(sig));
    if (!huerfano) limpios.push(t);
  });
  return limpios.join(" ").replace(/^[,;\s]+|[,;\s]+$/g, "").replace(/\s*,\s*,+/g, ",");
}

// ─────────────────────────── el intérprete ───────────────────────────

export function interpretar(texto: string, ctx: ContextoBusqueda): Interpretacion {
  const original = texto;
  let w = normalizar(original); // trabajo: lo ya consumido se reemplaza por espacios
  const filtros: FiltrosInterpretados = {};
  const chips: Chip[] = [];
  let n = 0;

  const consumir = (ini: number, fin: number) => {
    w = w.slice(0, ini) + " ".repeat(fin - ini) + w.slice(fin);
  };
  const agregar = (tipo: TipoChip, etiqueta: string, spans: [number, number][]) => {
    chips.push({ id: `${tipo}:${n++}`, tipo, etiqueta, spans });
  };
  const rango = (m: RegExpMatchArray): [number, number] => [m.index!, m.index! + m[0].length];

  // 1) Precio: "entre X y Y"
  {
    const re = new RegExp(
      String.raw`\bentre\s+\$?\s*(?<a>${NUM})\s*(?<ua>${UNIDAD})?\s+y\s+\$?\s*(?<b>${NUM})\s*(?<ub>${UNIDAD})\b`,
    );
    const m = w.match(re);
    if (m?.groups && filtros.precioMin === undefined) {
      const ub = m.groups.ub;
      const ua = m.groups.ua ?? ub;
      const a = aPesos(numeroEs(m.groups.a), ua);
      const b = aPesos(numeroEs(m.groups.b), ub);
      filtros.precioMin = Math.min(a, b);
      filtros.precioMax = Math.max(a, b);
      const span = rango(m);
      consumir(...span);
      agregar("precio", `${enMillones(filtros.precioMin)} – ${enMillones(filtros.precioMax)}`, [span]);
    }
  }

  // 2) Precio con unidad ("900 millones", "1,2 mil millones", "850 mm") y "$850M"
  if (filtros.precioMax === undefined && filtros.precioMin === undefined) {
    const res = [
      new RegExp(String.raw`(?:\b(?<q>${QUAL})\s+)?\$?\s*(?<n>${NUM})\s*(?<u>${UNIDAD})\b`),
      new RegExp(String.raw`(?:\b(?<q>${QUAL})\s+)?\$\s*(?<n>${NUM})\s*(?<u>m)\b`),
      // monto completo en pesos: 850.000.000 / 850000000 (no un celular de 10 dígitos que empieza en 3)
      new RegExp(String.raw`(?:\b(?<q>${QUAL})\s+)?\$?\s*(?<n>\d{1,3}(?:[.,]\d{3}){2,}|\d{7,11})\b`),
    ];
    for (const re of res) {
      const m = w.match(re);
      if (!m?.groups) continue;
      const crudo = m.groups.n;
      const solo = crudo.replace(/[.,]/g, "");
      if (!m.groups.u && /^3\d{9}$/.test(solo)) continue;
      const valor = m.groups.u ? aPesos(numeroEs(crudo), m.groups.u === "m" ? "millones" : m.groups.u) : Number(solo);
      if (!Number.isFinite(valor) || valor <= 0) continue;
      const clase = claseQual(m.groups.q);
      const span = rango(m);
      consumir(...span);
      if (clase === "min") {
        filtros.precioMin = valor;
        agregar("precio", `Desde ${enMillones(valor)}`, [span]);
      } else if (clase === "around") {
        filtros.precioMin = Math.round(valor * 0.85);
        filtros.precioMax = Math.round(valor * 1.15);
        agregar("precio", `≈ ${enMillones(valor)}`, [span]);
      } else {
        filtros.precioMax = valor;
        agregar("precio", `Hasta ${enMillones(valor)}`, [span]);
      }
      break;
    }
  }

  // 3) Área
  {
    const re = new RegExp(
      String.raw`(?:\b(?<q>${QUAL})\s+)?(?<n>\d+(?:[.,]\d+)?)\s*(?:m2|mts2|mt2|mts|mtrs|metros\s+cuadrados|metros)\b`,
    );
    const m = w.match(re);
    if (m?.groups) {
      const valor = numeroEs(m.groups.n);
      const clase = claseQual(m.groups.q);
      const span = rango(m);
      consumir(...span);
      if (clase === "min") {
        filtros.areaMin = valor;
        agregar("area", `Desde ${valor} m²`, [span]);
      } else if (clase === "max") {
        filtros.areaMax = valor;
        agregar("area", `Hasta ${valor} m²`, [span]);
      } else {
        filtros.areaMin = Math.round(valor * 0.85);
        filtros.areaMax = Math.round(valor * 1.15);
        agregar("area", `≈ ${valor} m²`, [span]);
      }
    }
  }

  // 4) Habitaciones, baños, parqueaderos
  {
    const hab = w.match(
      new RegExp(
        String.raw`\b(?<n>${CANT})\s*(?:\+|o\s+mas)?\s*(?:habitaciones|habitacion|alcobas|alcoba|cuartos|cuarto|dormitorios|dormitorio|recamaras|recamara|habs|hab)\b`,
      ),
    );
    if (hab?.groups) {
      const v = cantidad(hab.groups.n);
      const span = rango(hab);
      consumir(...span);
      filtros.habitacionesMin = v;
      agregar("habitaciones", `${v}+ habitaciones`, [span]);
    }
    const ban = w.match(new RegExp(String.raw`\b(?<n>${CANT})\s*(?:\+|o\s+mas)?\s*(?:banos|bano|wc)\b`));
    if (ban?.groups) {
      const v = cantidad(ban.groups.n);
      const span = rango(ban);
      consumir(...span);
      filtros.banosMin = v;
      agregar("banos", `${v}+ baños`, [span]);
    }
    const par = w.match(
      new RegExp(String.raw`(?:\b(?<n>${CANT})\s*(?:\+|o\s+mas)?\s+)?\b(?:parqueaderos|parqueadero|garajes|garaje|garage|parqueo|parq)\b`),
    );
    if (par) {
      const v = par.groups?.n ? cantidad(par.groups.n) : 1;
      const span = rango(par);
      consumir(...span);
      filtros.parqueaderosMin = v;
      agregar("parqueaderos", v === 1 ? "Con parqueadero" : `${v}+ parqueaderos`, [span]);
    }
  }

  // 5) Tipo de inmueble
  for (const [re, tipo] of TIPOS) {
    const m = w.match(re);
    if (m) {
      const span = rango(m);
      consumir(...span);
      filtros.tipo = tipo;
      agregar("tipo", PROPERTY_TYPE_LABELS[tipo], [span]);
      break;
    }
  }

  // 6) Lugar: sectores y ciudades del inventario real (con tolerancia a un error de digitación)
  const palabras = () => [...w.matchAll(/[a-z0-9ñ]+/g)].map((m) => ({ txt: m[0], ini: m.index!, fin: m.index! + m[0].length }));
  const buscarLugar = (nombre: string): [number, number][] | null => {
    const sig = normalizarTexto(nombre)
      .split(" ")
      .filter((t) => t && !ARTICULOS.has(t));
    if (sig.length === 0) return null;
    const ws = palabras();
    const usados = new Set<number>();
    const spans: [number, number][] = [];
    for (const t of sig) {
      let idx = ws.findIndex((p, i) => !usados.has(i) && p.txt === t);
      if (idx < 0 && t.length >= 6) {
        idx = ws.findIndex((p, i) => !usados.has(i) && p.txt.length >= 5 && levenshtein(p.txt, t) <= 1);
      }
      if (idx < 0) return null;
      usados.add(idx);
      spans.push([ws[idx].ini, ws[idx].fin]);
    }
    return spans;
  };

  const sectoresHallados: string[] = [];
  const spansSectores: [number, number][] = [];
  for (const s of [...new Set(ctx.sectores.filter(Boolean))]) {
    const spans = buscarLugar(s);
    if (spans) {
      sectoresHallados.push(s);
      spansSectores.push(...spans);
    }
  }
  if (sectoresHallados.length > 0) {
    for (const sp of spansSectores) consumir(...sp);
    filtros.sectores = sectoresHallados;
    agregar("sector", sectoresHallados.join(" o "), spansSectores);
  }
  for (const c of [...new Set(ctx.ciudades.filter(Boolean))]) {
    const spans = buscarLugar(c);
    if (spans) {
      for (const sp of spans) consumir(...sp);
      filtros.ciudad = c;
      agregar("ciudad", c, spans);
      break;
    }
  }

  // 7) Lo que queda: términos de texto (acabados, "chimenea", códigos…)
  const terminos: string[] = [];
  for (const p of palabras()) {
    const esCodigo = /^\d{3,5}$/.test(p.txt);
    if (!esCodigo && (p.txt.length < 3 || /^\d+$/.test(p.txt) || RELLENO.has(p.txt))) continue;
    if (terminos.includes(p.txt)) continue;
    terminos.push(p.txt);
    agregar("termino", original.slice(p.ini, p.fin), [[p.ini, p.fin]]);
  }
  if (terminos.length > 0) filtros.terminos = terminos.slice(0, 6);

  // Los chips se leen en el mismo orden en que el visitante escribió la frase.
  chips.sort((a, b) => Math.min(...a.spans.map((x) => x[0])) - Math.min(...b.spans.map((x) => x[0])));

  return { texto: original, filtros, chips };
}
