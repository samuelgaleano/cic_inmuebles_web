/**
 * Índice compacto del catálogo para la búsqueda en el navegador: lo mínimo para
 * evaluar filtros, explicar resultados y pintar una miniatura. Se arma en el
 * servidor a partir del inventario público (sin datos privados) y viaja como
 * prop. Si el catálogo creciera mucho, se recorta y el servidor sigue siendo
 * la fuente completa (la página /inmuebles filtra sobre todo el inventario).
 */
import { getCoverMedia, type PublicProperty } from "@/lib/domain";
import { aBuscable, type Buscable } from "./evaluar";
import type { ContextoBusqueda } from "./interpretar";

export interface ItemIndice extends Buscable {
  slug: string;
  titulo: string;
  codigo: string;
  portada?: string;
  administracion?: number;
  actualizadoEn: string;
}

/** Tope de elementos que se envían al navegador. */
export const MAX_INDICE = 120;
const MAX_TEXTO = 900;

export function construirIndice(props: PublicProperty[]): ItemIndice[] {
  return props.slice(0, MAX_INDICE).map((p) => {
    const b = aBuscable(p);
    return {
      ...b,
      id: p.slug,
      slug: p.slug,
      titulo: p.titulo,
      codigo: p.codigo,
      portada: getCoverMedia(p)?.url,
      administracion: p.administracion,
      actualizadoEn: p.actualizadoEn,
      texto: b.texto.slice(0, MAX_TEXTO),
    };
  });
}

/** Sectores y ciudades reales del inventario (la búsqueda solo reconoce lugares que existen). */
export function contextoDe(props: { ubicacion: { ciudad: string; sector?: string } }[]): ContextoBusqueda {
  const sectores = new Set<string>();
  const ciudades = new Set<string>();
  for (const p of props) {
    if (p.ubicacion.sector) sectores.add(p.ubicacion.sector);
    if (p.ubicacion.ciudad) ciudades.add(p.ubicacion.ciudad);
  }
  return { sectores: [...sectores], ciudades: [...ciudades] };
}

/**
 * Sugerencias de búsqueda construidas con datos REALES del inventario (nunca
 * ejemplos inventados): los sectores con más oferta, un tope de precio que
 * deja entrar a la mayoría, y la cantidad de alcobas más común.
 */
export function sugerencias(items: ItemIndice[], max = 4): string[] {
  const disponibles = items.filter((i) => i.estado !== "vendido");
  if (disponibles.length === 0) return [];
  const out: string[] = [];

  const porSector = new Map<string, number>();
  for (const i of disponibles) if (i.sector) porSector.set(i.sector, (porSector.get(i.sector) ?? 0) + 1);
  const topSector = [...porSector.entries()].sort((a, b) => b[1] - a[1] || a[0].localeCompare(b[0], "es"))[0]?.[0];
  if (topSector) out.push(`Apartamento en ${topSector}`);

  const hab = new Map<number, number>();
  for (const i of disponibles) if (i.habitaciones) hab.set(i.habitaciones, (hab.get(i.habitaciones) ?? 0) + 1);
  const moda = [...hab.entries()].sort((a, b) => b[1] - a[1] || b[0] - a[0])[0]?.[0];
  if (moda) out.push(`${moda} alcobas con parqueadero`);

  const precios = disponibles.map((i) => i.precio).sort((a, b) => a - b);
  const mediana = precios[Math.max(0, Math.ceil(precios.length / 2) - 1)]; // mediana baja: el tope deja entrar a ~la mitad
  const tope = Math.ceil(mediana / 100_000_000) * 100;
  if (tope >= 100) out.push(`Hasta ${tope} millones`);

  const frecuentes = ["chimenea", "terraza", "balcon", "estudio", "gimnasio"].find(
    (t) => disponibles.filter((i) => new RegExp(`\\b${t}`).test(i.texto)).length >= 2,
  );
  if (frecuentes) out.push(`Con ${frecuentes === "balcon" ? "balcón" : frecuentes}`);

  return out.slice(0, max);
}
