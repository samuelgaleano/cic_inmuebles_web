/**
 * Normaliza nombres de ciudad y sector tal como llegan del catálogo (Google
 * Sheets escrito a mano): "BogotÁ", "BOGOTA", "BELLA SUIZA". Esos textos
 * terminan en el <title>, el H1 y el JSON-LD de cada ficha, o sea, en Google.
 *
 * Solo corrige lo que es claramente un error de digitación (todo en
 * mayúsculas, o una mayúscula en mitad de palabra) y las tildes de ciudades
 * conocidas. Un nombre bien escrito se devuelve intacto.
 */

// Ciudades con tilde que suelen llegar sin ella. Clave sin tildes y en minúscula.
const CIUDADES: Record<string, string> = {
  bogota: "Bogotá",
  "bogota d.c.": "Bogotá",
  "bogota dc": "Bogotá",
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
};

// Partículas que van en minúscula dentro de un nombre ("Ciudad Jardín del Norte").
const MINUSCULAS = new Set(["de", "del", "la", "las", "el", "los", "y", "e"]);

function sinTildes(s: string): string {
  return s.normalize("NFD").replace(/\p{M}/gu, "");
}

function capitalizar(palabra: string, primera: boolean): string {
  const baja = palabra.toLocaleLowerCase("es");
  if (!primera && MINUSCULAS.has(baja)) return baja;
  return baja.charAt(0).toLocaleUpperCase("es") + baja.slice(1);
}

/** ¿Está todo en mayúsculas o tiene una mayúscula en mitad de palabra ("BogotÁ")? */
function malEscrito(s: string): boolean {
  return s === s.toLocaleUpperCase("es") || /\p{Ll}\p{Lu}/u.test(s);
}

export function formatLugar(valor: string | undefined | null): string | undefined {
  if (valor == null) return undefined;
  const limpio = valor.trim().replace(/\s+/g, " ");
  if (!limpio) return "";

  const conocida = CIUDADES[sinTildes(limpio).toLocaleLowerCase("es")];
  if (conocida) return conocida;

  if (!malEscrito(limpio)) return limpio;
  return limpio
    .split(" ")
    .map((p, i) => capitalizar(p, i === 0))
    .join(" ");
}
