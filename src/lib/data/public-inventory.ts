import { unstable_cache } from "next/cache";
import { cache } from "react";
import { getRepository } from "@/lib/data";
import { INVENTARIO_REVALIDATE_S, INVENTARIO_TAG } from "@/lib/data/inventario-tag";
import type { PublicProperty } from "@/lib/domain";

/**
 * Lectura del inventario público con DOS capas de caché:
 *  - `unstable_cache` (caché de datos de Next, persistente entre solicitudes y regeneraciones, con la etiqueta
 *    `inventario` y vigencia de 1 h): home, catálogo, fichas, sectores, comparar, favoritos y sitemap comparten
 *    una sola consulta a Supabase en lugar de hacer una cada una. Las rutas que escriben inmuebles la
 *    invalidan con `invalidarInventario()` (src/lib/data/inventario-tag.ts).
 *  - `cache()` de React: deduplica dentro de un mismo render.
 *
 * Traga errores de Supabase y degrada a catálogo vacío: úsala donde vale más
 * mostrar la página sin inventario que romperla (home, catálogo,
 * `generateStaticParams`). Donde SÍ importa distinguir "no hay nada" de "no
 * se pudo consultar" — la página de un sector concreto no debe convertir una
 * caída de la base de datos en un 404 permanente — usa
 * `getPublicInventoryOrThrow`. Un error nunca queda guardado en la caché.
 */
const leerInventario = unstable_cache(async (): Promise<PublicProperty[]> => getRepository().properties.listPublic(), ["inventario-publico"], {
  tags: [INVENTARIO_TAG],
  revalidate: INVENTARIO_REVALIDATE_S,
});

export const getPublicInventory = cache(async (): Promise<PublicProperty[]> => {
  try {
    return await leerInventario();
  } catch (err) {
    console.error("[inventario] no se pudo cargar el catálogo:", err);
    return [];
  }
});

/** Igual, pero deja que el error de la base de datos se propague. */
export const getPublicInventoryOrThrow = cache(async (): Promise<PublicProperty[]> => leerInventario());

/** Busca una ficha por slug dentro del inventario ya cargado (sin consultar la base de datos). */
export function fichaDelInventario(inventario: PublicProperty[], slug: string): PublicProperty | null {
  return inventario.find((p) => p.slug === slug) ?? null;
}

/**
 * Ficha pública por slug sacada del inventario compartido: la metadata y la página usan la misma lectura
 * cacheada, y un slug inexistente (bots, enlaces viejos) responde 404 sin tocar Supabase.
 * Propaga los errores de la base de datos (no convierte una caída en 404).
 */
export const getPublicPropertyBySlug = cache(async (slug: string): Promise<PublicProperty | null> =>
  fichaDelInventario(await getPublicInventoryOrThrow(), slug),
);
