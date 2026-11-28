/**
 * Loader de imágenes para next/image.
 *
 * Objetivo: NO depender del optimizador de imágenes de Vercel (5.000 transformaciones al mes en Hobby) y
 * delegar la optimización en el origen, que ya la hace gratis:
 *
 *  - Cloudinary  → inyecta `f_auto,q_auto,c_limit,w_<ancho>` (formato y calidad automáticos, redimensionado
 *                  por ancho). No consume la cuota de Vercel.
 *  - Google Drive (lh3) → usa el parámetro nativo `=w<ancho>` (respaldo).
 *  - Cualquier otra URL → se sirve tal cual (passthrough).
 *
 * next.config.ts declara `images.loader: "custom"`: toda <Image> debe traer este loader (SafeImage lo pone) y
 * el endpoint /_next/image queda apagado. Ver docs/IMAGENES.md.
 */

/**
 * Ancho máximo que se pide al origen. Las fotos de Drive entran al catálogo a 1.600 px: pedir más a Cloudinary
 * (2048, 3840) no agrega detalle, solo transformaciones y bytes.
 */
export const ANCHO_MAXIMO = 1600;

/**
 * Anchos del srcset (images.deviceSizes en next.config.ts) y del precargado del visor de la galería. Terminan
 * en ANCHO_MAXIMO: con los de Next por defecto (hasta 3840) tres de cada nueve variantes eran la misma foto.
 */
export const ANCHOS_DISPOSITIVO = [640, 750, 828, 1080, 1200, ANCHO_MAXIMO] as const;

export function mediaLoader({ src, width }: { src: string; width: number; quality?: number }): string {
  const w = Math.min(Math.max(1, Math.round(width)), ANCHO_MAXIMO);
  // Cloudinary: insertar transformaciones justo después de "/upload/".
  if (src.includes("res.cloudinary.com") && src.includes("/upload/")) {
    return src.replace("/upload/", `/upload/f_auto,q_auto,c_limit,w_${w}/`);
  }
  // Google Drive (lh3) admite el parámetro de tamaño "=w<ancho>".
  if (src.includes("googleusercontent.com/d/")) {
    return src.replace(/=[a-z0-9-]+$/i, "") + `=w${w}`;
  }
  // Externas (YouTube, etc.): sin transformación.
  return src;
}

/**
 * Imagen para la vista previa al compartir un enlace (WhatsApp, redes): 1200×630 con recorte
 * automático hacia lo importante de la foto. Cloudinary la entrega ya recortada; cualquier otra
 * URL se devuelve igual. (Las fotos verticales de los inmuebles salían tal cual, a 960×1280.)
 */
export function ogImageUrl(src: string): string {
  if (src.includes("res.cloudinary.com") && src.includes("/upload/")) {
    return src.replace("/upload/", "/upload/c_fill,g_auto,w_1200,h_630,f_jpg,q_auto/");
  }
  // Drive: sin recorte confiable, al menos no se manda el original completo.
  if (src.includes("googleusercontent.com/d/")) return mediaLoader({ src, width: 1200 });
  return src;
}

/**
 * La imagen Open Graph con sus medidas solo cuando son ciertas: Cloudinary la recorta a 1200×630; Drive y
 * las demás se envían sin medidas (declarar 1200×630 en una foto vertical hacía que la vista previa se viera mal).
 */
export function ogImagen(src: string): { url: string; width?: number; height?: number } {
  const url = ogImageUrl(src);
  return src.includes("res.cloudinary.com") && src.includes("/upload/") ? { url, width: 1200, height: 630 } : { url };
}
