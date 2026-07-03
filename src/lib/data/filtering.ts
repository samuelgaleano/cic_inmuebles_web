import type { Property, PropertyFilters } from "@/lib/domain";

/** Lógica de filtrado y ordenamiento compartida entre implementaciones del repositorio. */

export function matchesFilters(p: Property, f?: PropertyFilters): boolean {
  if (!f) return true;
  if (f.tipo && p.tipo !== f.tipo) return false;
  if (f.estado && p.estado !== f.estado) return false;
  if (f.ciudad && p.ubicacion.ciudad.toLowerCase() !== f.ciudad.toLowerCase()) return false;
  if (f.destacado && !p.destacado) return false;
  if (f.precioMin != null && p.precio < f.precioMin) return false;
  if (f.precioMax != null && p.precio > f.precioMax) return false;
  if (f.habitacionesMin != null && (p.caracteristicas.habitaciones ?? 0) < f.habitacionesMin)
    return false;
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
