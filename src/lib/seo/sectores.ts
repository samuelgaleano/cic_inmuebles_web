import type { PublicProperty } from "@/lib/domain";
import { titularInventario } from "@/lib/seo/titular";
import { slugify } from "@/lib/utils/slug";

/**
 * Páginas por sector ("Apartamentos en venta en La Calleja, Bogotá").
 *
 * Es el long-tail que CIC sí puede ganar: nadie compite por "apartamento en
 * venta en Bella Suiza" como por "apartamentos en venta en Bogotá". Las
 * páginas salen solas del inventario, pero solo entran al índice y al sitemap
 * cuando el sector tiene al menos MIN_INMUEBLES_INDEXABLE inmuebles
 * DISPONIBLES: uno solo duplica la ficha (página delgada) y uno vendido no es
 * motivo para indexar una página que ya no vende nada. Hasta entonces existen
 * (navegación, enlaces internos) con noindex, y se activan solas al crecer
 * el inventario.
 *
 * Se agrupa por ciudad + sector, no solo por sector: dos ciudades pueden
 * compartir nombre de barrio ("Centro" en Cali y en Bogotá) y no deben
 * mezclarse en una sola página. La URL usa solo el sector
 * (`/inmuebles/sector/centro`) mientras sea único; si choca con otra ciudad,
 * se desambigua con el sufijo de ciudad (`/inmuebles/sector/centro-cali`).
 */

export const MIN_INMUEBLES_INDEXABLE = 2;

export interface Sector {
  slug: string;
  nombre: string;
  ciudad: string;
  /** Todo lo publicado en el sector, incluidos los ya vendidos (lo que ve el visitante). */
  inmuebles: PublicProperty[];
  /** Lo que aún se puede comprar: base real de la indexación, el conteo y el rango de precios. */
  disponibles: PublicProperty[];
  indexable: boolean;
  /** "Apartamentos", "Casas"... de lo publicado en el sector (ver titularInventario). */
  tipos: string;
}

export function sectorPath(sector: Pick<Sector, "slug">): string {
  return `/inmuebles/sector/${sector.slug}`;
}

/** El sector cuyo grupo contiene este inmueble, o `undefined` si no tiene sector. */
export function encontrarSector(sectores: Sector[], property: Pick<PublicProperty, "slug">): Sector | undefined {
  return sectores.find((s) => s.inmuebles.some((p) => p.slug === property.slug));
}

/**
 * Nombre más frecuente del grupo. En empate, prefiere la variante que no es
 * pura minúscula (se ve capitalizada) y, si eso tampoco decide, la primera
 * alfabéticamente (es-CO). Determinista: no depende del orden del inventario.
 * En producción los sectores ya llegan normalizados (ver lugar.ts), así que
 * el empate solo ocurre en casos de prueba o datos históricos sin normalizar.
 */
function nombreCanonico(variantes: Map<string, number>): string {
  let mejor = "";
  let mejorConteo = -1;
  for (const [nombre, conteo] of variantes) {
    if (conteo < mejorConteo) continue;
    if (conteo > mejorConteo) {
      mejor = nombre;
      mejorConteo = conteo;
      continue;
    }
    const mejorEsMinuscula = mejor === mejor.toLocaleLowerCase("es");
    const nombreEsMinuscula = nombre === nombre.toLocaleLowerCase("es");
    if (mejorEsMinuscula && !nombreEsMinuscula) mejor = nombre;
    else if (mejorEsMinuscula === nombreEsMinuscula && nombre.localeCompare(mejor, "es") < 0) mejor = nombre;
  }
  return mejor;
}

export function agruparPorSector(items: PublicProperty[]): Sector[] {
  interface Grupo {
    sectorSlug: string;
    ciudad: string;
    variantes: Map<string, number>;
    inmuebles: PublicProperty[];
  }
  const grupos = new Map<string, Grupo>();

  for (const p of items) {
    const nombreSector = p.ubicacion.sector?.trim();
    if (!nombreSector) continue;
    const sectorSlug = slugify(nombreSector);
    if (!sectorSlug) continue;
    const ciudad = p.ubicacion.ciudad?.trim() ?? "";
    const key = `${slugify(ciudad)}|${sectorSlug}`;
    let g = grupos.get(key);
    if (!g) {
      g = { sectorSlug, ciudad, variantes: new Map(), inmuebles: [] };
      grupos.set(key, g);
    }
    g.inmuebles.push(p);
    g.variantes.set(nombreSector, (g.variantes.get(nombreSector) ?? 0) + 1);
  }

  // ¿El slug del sector se repite en más de una ciudad? Solo esos se desambiguan.
  const gruposPorSectorSlug = new Map<string, number>();
  for (const g of grupos.values()) {
    gruposPorSectorSlug.set(g.sectorSlug, (gruposPorSectorSlug.get(g.sectorSlug) ?? 0) + 1);
  }

  return [...grupos.values()]
    .map((g): Sector => {
      const disponibles = g.inmuebles.filter((p) => p.estado !== "vendido");
      const colisiona = (gruposPorSectorSlug.get(g.sectorSlug) ?? 0) > 1;
      return {
        slug: colisiona ? `${g.sectorSlug}-${slugify(g.ciudad)}` : g.sectorSlug,
        nombre: nombreCanonico(g.variantes),
        ciudad: g.ciudad,
        inmuebles: g.inmuebles,
        disponibles,
        indexable: disponibles.length >= MIN_INMUEBLES_INDEXABLE,
        tipos: titularInventario(g.inmuebles).tipos,
      };
    })
    .sort((a, b) => b.disponibles.length - a.disponibles.length || a.nombre.localeCompare(b.nombre, "es"));
}
