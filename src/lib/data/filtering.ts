import type { Property, PropertyFilters } from "@/lib/domain";
import { aBuscable, coincide } from "@/lib/search/evaluar";

/** Lógica de filtrado y ordenamiento compartida entre implementaciones del repositorio. */

export function matchesFilters(p: Property, f?: PropertyFilters): boolean {
  if (!f) return true;
  if (f.estado && p.estado !== f.estado) return false;
  if (f.destacado && !p.destacado) return false;

  // Criterios estructurados (los mismos que entiende la búsqueda inteligente).
  const estructurados = coincide(aBuscable(p), {
    tipo: f.tipo,
    ciudad: f.ciudad,
    sectores: f.sectores,
    precioMin: f.precioMin,
    precioMax: f.precioMax,
    habitacionesMin: f.habitacionesMin,
    banosMin: f.banosMin,
    parqueaderosMin: f.parqueaderosMin,
    areaMin: f.areaMin,
    areaMax: f.areaMax,
    terminos: f.terminos,
  });
  if (!estructurados) return false;

  // Búsqueda literal (panel admin): la frase completa como subcadena.
  if (f.q) {
    const q = f.q.toLowerCase();
    const haystack = [
      p.titulo,
      p.descripcion,
      p.ubicacion.ciudad,
      p.ubicacion.sector ?? "",
      p.ubicacion.conjunto ?? "",
      p.codigo,
    ]
      .join(" ")
      .toLowerCase();
    if (!haystack.includes(q)) return false;
  }
  return true;
}

export function sortByRelevance(a: Property, b: Property): number {
  // Disponibles primero, luego destacados, luego más recientes.
  const estadoRank = (p: Property) =>
    p.estado === "disponible" ? 0 : p.estado === "en_proceso" ? 1 : 2;
  const byEstado = estadoRank(a) - estadoRank(b);
  if (byEstado !== 0) return byEstado;
  if (a.destacado !== b.destacado) return a.destacado ? -1 : 1;
  return b.actualizadoEn.localeCompare(a.actualizadoEn);
}
