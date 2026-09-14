import { cache } from "react";
import { getRepository } from "@/lib/data";
import type { PublicProperty } from "@/lib/domain";

/**
 * Inventario público completo (sin filtros), cacheado por petición con
 * `cache()` de React: home, catálogo, ficha y páginas de sector piden lo
 * mismo dentro del mismo render y no repiten la consulta.
 *
 * Traga errores de Supabase y degrada a catálogo vacío: úsala donde vale más
 * mostrar la página sin inventario que romperla (home, catálogo,
 * `generateStaticParams`). Donde SÍ importa distinguir "no hay nada" de "no
 * se pudo consultar" — la página de un sector concreto no debe convertir una
 * caída de la base de datos en un 404 permanente — usa
 * `getPublicInventoryOrThrow`.
 */
export const getPublicInventory = cache(async (): Promise<PublicProperty[]> => {
  try {
    return await getRepository().properties.listPublic();
  } catch (err) {
    console.error("[inventario] no se pudo cargar el catálogo:", err);
    return [];
  }
});

/** Igual, pero deja que el error de la base de datos se propague. */
export const getPublicInventoryOrThrow = cache(async (): Promise<PublicProperty[]> => {
  return getRepository().properties.listPublic();
});
