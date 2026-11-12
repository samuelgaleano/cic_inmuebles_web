import { revalidateTag } from "next/cache";

/**
 * Etiqueta de la caché persistente del inventario público (ver public-inventory.ts).
 * Vive en un archivo aparte para que las acciones de escritura puedan invalidarla
 * sin importar el repositorio de datos.
 */
export const INVENTARIO_TAG = "inventario";

/** Segundos que dura la lectura compartida del inventario aunque nadie la invalide. */
export const INVENTARIO_REVALIDATE_S = 3600;

/**
 * Marca el inventario como vencido: la siguiente solicitud vuelve a leer Supabase UNA vez y todas las
 * páginas públicas (home, catálogo, fichas, sectores, comparar, favoritos, sitemap) comparten esa lectura.
 * Llamar en TODA ruta que cree, edite, publique, despublique o borre un inmueble.
 * Solo se puede usar en acciones de servidor y handlers de ruta (o dentro de `after`).
 */
export function invalidarInventario(): void {
  revalidateTag(INVENTARIO_TAG, { expire: 0 });
}
