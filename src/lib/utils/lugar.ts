/**
 * Formato de nombres del catálogo (ciudad, sector, conjunto, título), escritos
 * a mano en carpetas de Drive, fichas y el panel: "BogotÁ", "BELLA SUIZA",
 * "cedritos". Esos textos terminan en el <title>, el H1 y el JSON-LD de cada
 * ficha, o sea, en Google.
 *
 * Corrige solo lo que es claramente un error de digitación y deja intacto lo
 * que ya viene bien, incluidas mayúsculas internas legítimas ("BioCity",
 * "McKenzie") y siglas ("PH", "VIS", "BBVA"):
 *   - todo en MAYÚSCULAS o todo en minúsculas → mayúscula inicial por palabra,
 *     conservando siglas y números romanos ("CHICÓ II" → "Chicó II");
 *   - una mayúscula acentuada suelta tras minúscula ("BogotÁ", "AlejandrÍa"),
 *     la huella del importador viejo → se baja solo esa letra;
 *   - mezcla inconsistente ("Bella suiza") → mayúscula inicial por palabra;
 *   - ciudades conocidas sin tilde → con tilde.
 */

// Ciudades con tilde que suelen llegar sin ella. Clave sin tildes, en minúscula.
const CIUDADES: Record<string, string> = {
  bogota: "Bogotá",
  "bogota d.c.": "Bogotá",
  "bogota d.c": "Bogotá",
  "bogota dc": "Bogotá",
  "bogota, d.c.": "Bogotá",
  "bogota, d.c": "Bogotá",
  "bogota, dc": "Bogotá",
  "bogota d c": "Bogotá",
  medellin: "Medellín",
  chia: "Chía",
  cajica: "Cajicá",
  zipaquira: "Zipaquirá",
  sopo: "Sopó",
  "la calera": "La Calera",
  ibague: "Ibagué",
  cucuta: "Cúcuta",
  popayan: "Popayán",
  monteria: "Montería",
  "santa marta": "Santa Marta",
  "san andres": "San Andrés",
  quibdo: "Quibdó",
  tulua: "Tuluá",
  itagui: "Itagüí",
  envigado: "Envigado",
  rionegro: "Rionegro",
  bucaramanga: "Bucaramanga",
  barranquilla: "Barranquilla",
  cartagena: "Cartagena",
  cali: "Cali",
  pereira: "Pereira",
  manizales: "Manizales",
  armenia: "Armenia",
  villavicencio: "Villavicencio",
  tunja: "Tunja",
  soacha: "Soacha",
  funza: "Funza",
  mosquera: "Mosquera",
  madrid: "Madrid",
  cota: "Cota",
  tocancipa: "Tocancipá",
  pasto: "Pasto",
  neiva: "Neiva",
};

// Partículas que van en minúscula dentro de un nombre ("Ciudad Jardín del Norte").
const MINUSCULAS = new Set(["de", "del", "la", "las", "el", "los", "y", "e", "al", "a"]);

// Siglas frecuentes en el mercado colombiano que deben quedar en mayúsculas.
const SIGLAS = new Set(["ph", "vis", "vip", "can", "cc", "dc", "d.c", "d.c.", "bbva", "aaa", "tv", "ips", "eps", "sas", "s.a.s", "s.a.s."]);

// Etapas y torres en números romanos: I a XXXIX.
const ROMANO = /^(?=[ivx]+$)(x{0,3})(ix|iv|v?i{0,3})$/i;

function sinTildes(s: string): string {
  return s.normalize("NFD").replace(/\p{M}/gu, "");
}

const soloLetras = (token: string) => token.replace(/[^\p{L}]/gu, "");

function esSigla(token: string): boolean {
  const letras = soloLetras(token);
  if (!letras) return false;
  const baja = token.toLocaleLowerCase("es");
  if (SIGLAS.has(baja) || SIGLAS.has(letras.toLocaleLowerCase("es"))) return true;
  if (ROMANO.test(letras)) return true;
  // Sin vocales no es una palabra: "PH", "SM", "GYM" no; "PH" sí.
  return !/[aeiouáéíóúü]/i.test(letras);
}

function capitalizar(token: string, primera: boolean): string {
  if (/\d/.test(token)) return token; // "2B", "Torre 3": se dejan como vienen
  const baja = token.toLocaleLowerCase("es");
  if (!primera && MINUSCULAS.has(soloLetras(baja))) return baja; // "y" antes que la regla de siglas
  if (esSigla(token)) return token.toLocaleUpperCase("es");
  // Mayúscula en la primera letra de cada tramo: "puente-largo" → "Puente-Largo", "(etapa" → "(Etapa".
  return baja.replace(/(?<!\p{L})\p{L}/gu, (c) => c.toLocaleUpperCase("es"));
}

/** Mayúscula inicial por palabra, respetando tildes, partículas, siglas y romanos. */
export function titulo(valor: string): string {
  return valor
    .split(" ")
    .map((p, i) => capitalizar(p, i === 0))
    .join(" ");
}

const tieneLetras = (s: string) => /\p{L}/u.test(s);
const todoMayusculas = (s: string) => tieneLetras(s) && s === s.toLocaleUpperCase("es");
const todoMinusculas = (s: string) => tieneLetras(s) && s === s.toLocaleLowerCase("es");

/** "Bella suiza": una palabra empieza en mayúscula y otra (no partícula) en minúscula. */
function mezclaInconsistente(s: string): boolean {
  const iniciales = s
    .split(" ")
    .map((t) => soloLetras(t))
    .filter(Boolean)
    .filter((t, i) => i === 0 || !MINUSCULAS.has(t.toLocaleLowerCase("es")))
    .map((t) => t.charAt(0));
  const may = iniciales.some((c) => c === c.toLocaleUpperCase("es"));
  const min = iniciales.some((c) => c === c.toLocaleLowerCase("es"));
  return may && min;
}

function corregir(limpio: string): string {
  if (todoMayusculas(limpio) || todoMinusculas(limpio)) return titulo(limpio);
  // Huella del importador viejo: "BogotÁ", "AlejandrÍa".
  const sinHuella = limpio.replace(/(\p{Ll})([ÁÉÍÓÚÜÑ])/gu, (_, a: string, b: string) => a + b.toLocaleLowerCase("es"));
  return mezclaInconsistente(sinHuella) ? titulo(sinHuella) : sinHuella;
}

/**
 * Nombre propio (título del inmueble, conjunto): limpia espacios y corrige
 * solo lo claramente mal digitado. "EDIFICIO SAN PATRICIO" →
 * "Edificio San Patricio"; "Area19 Calleja" y "BioCity" se quedan igual.
 */
export function formatNombre(valor: string | undefined | null): string | undefined {
  if (valor == null) return undefined;
  const limpio = valor.trim().replace(/\s+/g, " ");
  if (!limpio) return "";
  return corregir(limpio);
}

/** Ciudad o sector: lo mismo que `formatNombre` más las tildes de ciudades conocidas. */
export function formatLugar(valor: string | undefined | null): string | undefined {
  if (valor == null) return undefined;
  const limpio = valor.trim().replace(/\s+/g, " ");
  if (!limpio) return "";
  const conocida = CIUDADES[sinTildes(limpio).toLocaleLowerCase("es")];
  return conocida ?? corregir(limpio);
}
