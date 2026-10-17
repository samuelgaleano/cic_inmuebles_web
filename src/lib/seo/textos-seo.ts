/**
 * Textos para buscadores que no dependen de React: recorte de la meta description y
 * el encabezado de la ficha ("Apartamento en venta en Gilmar, Bogotá").
 */

/** Largo que Google suele mostrar de una meta description antes de cortarla. */
export const MAX_DESCRIPCION = 155;

/**
 * Deja `texto` en `max` caracteres como mucho sin partir una palabra: corta en el último
 * espacio, quita la puntuación que quede colgando y cierra con «…». Si cabe, lo devuelve
 * igual (solo con los espacios normalizados).
 */
export function recortarEnPalabra(texto: string, max = MAX_DESCRIPCION): string {
  const limpio = texto.replace(/\s+/g, " ").trim();
  if (limpio.length <= max) return limpio;

  // Se reserva un carácter para «…». Si el carácter siguiente al corte es un espacio,
  // la última palabra quedó completa y no hay que retroceder.
  const tope = max - 1;
  const cabeza = limpio.slice(0, tope);
  const palabraCompleta = limpio[tope] === " ";
  const espacio = cabeza.lastIndexOf(" ");
  const base = palabraCompleta || espacio <= 0 ? cabeza : cabeza.slice(0, espacio);
  return `${base.replace(/[\s.,;:·–—-]+$/u, "")}…`;
}

/**
 * Encabezado de la ficha con lo que la gente busca: tipo, operación y lugar.
 * - `prefijo`: "Apartamento en venta" (o solo "Apartamento" si ya se vendió, para no anunciar en venta lo vendido).
 * - `texto`: la frase completa, p. ej. "Apartamento en venta en Gilmar, Bogotá". Sin sector, solo la ciudad;
 *   sin ninguno de los dos, solo el prefijo.
 */
export function encabezadoFicha(d: {
  tipo: string;
  sector?: string | null;
  ciudad?: string | null;
  vendido?: boolean;
}): { prefijo: string; lugar: string; texto: string } {
  const prefijo = d.vendido ? d.tipo : `${d.tipo} en venta`;
  const lugar = [d.sector?.trim(), d.ciudad?.trim()].filter(Boolean).join(", ");
  return { prefijo, lugar, texto: lugar ? `${prefijo} en ${lugar}` : prefijo };
}
