import { revalidatePath, revalidateTag } from "next/cache";

/**
 * Etiqueta de la caché persistente del inventario público (ver public-inventory.ts).
 * Vive en un archivo aparte para que las acciones de escritura puedan invalidarla
 * sin importar el repositorio de datos.
 */
export const INVENTARIO_TAG = "inventario";

/**
 * Segundos que dura la lectura compartida del inventario aunque nadie la invalide (6 h). Es la red de seguridad
 * para cambios hechos fuera del panel (p. ej. editar filas directo en Supabase); el panel invalida al instante.
 * Las páginas con `revalidate` heredan el MENOR de sus lecturas, por eso todas usan 21600 (literal: Next exige
 * valores estáticos en `revalidate`).
 */
export const INVENTARIO_REVALIDATE_S = 21600;

/**
 * Marca el inventario como vencido: la siguiente solicitud vuelve a leer Supabase UNA vez y todas las
 * páginas públicas (home, catálogo, fichas, sectores, comparar, favoritos, sitemap) comparten esa lectura.
 * Llamar en TODA ruta que cree, edite, publique, despublique o borre un inmueble.
 * Solo se puede usar en acciones de servidor y handlers de ruta (o dentro de `after`).
 */
export function invalidarInventario(): void {
  revalidateTag(INVENTARIO_TAG, { expire: 0 });
}

/**
 * Inventario vencido y rutas públicas afectadas revalidadas, para cuando un inmueble cambia (incluido pasar a
 * vendido desde el CRM). `slugs`: la ficha actual y, si se renombró, la anterior (la URL vieja no debe quedar viva).
 */
export function revalidarCatalogoPublico(...slugs: (string | undefined)[]): void {
  invalidarInventario();
  revalidatePath("/");
  revalidatePath("/inmuebles");
  revalidatePath("/comparar");
  revalidatePath("/favoritos");
  for (const slug of new Set(slugs.filter(Boolean))) revalidatePath(`/inmuebles/${slug}`);
  revalidatePath("/sitemap.xml");
  // Cambiar sector, ciudad o estado (vendido) mueve el conteo y la indexabilidad de la página de sector;
  // sin esto queda hasta 1h desfasada (su `revalidate = 3600`) y puede seguir enlazando una ficha ya cambiada.
  revalidatePath("/inmuebles/sector/[sector]", "page");
  revalidatePath("/admin/inmuebles");
}
