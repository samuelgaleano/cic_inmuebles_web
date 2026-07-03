/**
 * Loader de imágenes para next/image.
 *
 * Objetivo: NO depender del optimizador de imágenes de Vercel (recurso medido en
 * el plan gratuito) y delegar la optimización en el origen, que ya la hace gratis:
 *
 *  - Cloudinary  → inyecta `f_auto,q_auto,c_limit,w_<ancho>` (formato y calidad
 *                  automáticos, redimensionado por ancho). Optimización ilimitada
 *                  para nuestro volumen, sin tocar la cuota de Vercel.
 *  - Google Drive (lh3) → usa el parámetro nativo `=w<ancho>` (respaldo).
 *  - Cualquier otra URL → se sirve tal cual (passthrough).
 *
 * Al pasar este loader, next/image deja de usar el optimizador de Vercel por
 * completo: una dependencia menos y cero riesgo de tope.
 */
export function mediaLoader({ src, width }: { src: string; width: number; quality?: number }): string {
  // Cloudinary: insertar transformaciones justo después de "/upload/".
  if (src.includes("res.cloudinary.com") && src.includes("/upload/")) {
    return src.replace("/upload/", `/upload/f_auto,q_auto,c_limit,w_${width}/`);
  }
  // Google Drive (lh3) admite el parámetro de tamaño "=w<ancho>".
  if (src.includes("googleusercontent.com/d/")) {
    return src.replace(/=[a-z0-9-]+$/i, "") + `=w${width}`;
  }
  // Externas (YouTube, etc.): sin transformación.
  return src;
}
