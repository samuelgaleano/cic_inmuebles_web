/**
 * Fichas cuyas fotos llevan una marca de agua ajena (Metrocuadrado.com): se quedan en el catálogo, pero
 * no se usan en las fotos de muestra (portada, /vender) hasta que CIC las reemplace.
 */
export const SIN_FOTO_DE_MUESTRA: readonly string[] = ["puente-largo-alhambra"];

/**
 * Hasta `n` fichas reales para mostrar como prueba: con foto, sin marca de agua ajena, disponibles primero
 * y luego las destacadas (las vendidas también cuentan: son trabajo hecho). Mantiene el orden del catálogo.
 */
export function fichasDeMuestra<T extends { slug: string; portada?: string; estado: string }>(lista: readonly T[], n: number): T[] {
  const aptas = lista.filter((p) => p.portada && !SIN_FOTO_DE_MUESTRA.includes(p.slug));
  const peso = (p: T) => (p.estado === "disponible" ? 0 : p.estado === "en_proceso" ? 1 : 2);
  return [...aptas].sort((a, b) => peso(a) - peso(b)).slice(0, n);
}

/**
 * Dos elementos distintos para el mosaico de la portada. Se prefiere empezar por el segundo
 * (el primero ya es la foto grande de la vitrina) y, si faltan, se vuelve al primero, pero
 * nunca se repite el mismo: con un solo elemento, el segundo hueco queda vacío.
 */
export function elegirDosDistintos<T>(lista: readonly T[]): [T | undefined, T | undefined] {
  const orden = lista.length > 1 ? [...lista.slice(1), lista[0]] : [...lista];
  return [orden[0], orden[1]];
}
