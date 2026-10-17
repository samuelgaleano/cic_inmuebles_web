/**
 * Dos elementos distintos para el mosaico de la portada. Se prefiere empezar por el segundo
 * (el primero ya es la foto grande de la vitrina) y, si faltan, se vuelve al primero, pero
 * nunca se repite el mismo: con un solo elemento, el segundo hueco queda vacío.
 */
export function elegirDosDistintos<T>(lista: readonly T[]): [T | undefined, T | undefined] {
  const orden = lista.length > 1 ? [...lista.slice(1), lista[0]] : [...lista];
  return [orden[0], orden[1]];
}
