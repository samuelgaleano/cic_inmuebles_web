import type { NextConfig } from "next";

import { ANCHOS_DISPOSITIVO } from "./src/lib/utils/image-loader";

/**
 * Configuración de Next.js para CIC Inmuebles.
 *
 * Imágenes: TODAS las <Image> del sitio pasan por `SafeImage`, que usa el loader
 * propio `mediaLoader` (src/lib/utils/image-loader.ts): Cloudinary y Drive
 * optimizan en el origen y el resto se sirve tal cual. Con un loader propio,
 * next/image nunca llama al optimizador de Vercel (/_next/image).
 *
 * Por eso el optimizador queda APAGADO con `loader: "custom"`: Next responde 404 en
 * /_next/image (next-server.js) y nadie puede usarlo de proxy para gastar las 5.000
 * transformaciones del plan, ni siquiera con fotos de la cuenta propia de Cloudinary
 * (antes se permitían: cada foto × cada ancho contaba como una transformación).
 * La contrapartida: una <Image> sin `loader` falla al renderizar, así que se usa
 * siempre SafeImage. No se usa `unoptimized: true` porque en Next 16 eso hace que
 * <Image> ignore también el loader propio (get-img-props.js) y las fotos de
 * Cloudinary saldrían sin redimensionar. Detalle en docs/IMAGENES.md.
 */

/**
 * CSP que se APLICA: mínima y segura, solo directivas que no tocan scripts ni conexiones
 * (Next inyecta scripts inline y una CSP de scripts exige nonces, que obligarían a renderizar
 * todo en cada petición y romperían el ISR). Lo que sí cierra:
 *  - frame-ancestors 'self': nadie más puede enmarcar el sitio (clickjacking).
 *  - base-uri 'self': una etiqueta <base> inyectada no puede redirigir rutas relativas.
 *  - object-src 'none': sin plugins (<object>, <embed>).
 *  - form-action: los formularios solo se envían al propio sitio o al checkout de Wompi.
 */
const CSP = [
  "frame-ancestors 'self'",
  "base-uri 'self'",
  "object-src 'none'",
  "form-action 'self' https://checkout.wompi.co",
].join("; ");

/**
 * CSP completa en modo SOLO REPORTE (Content-Security-Policy-Report-Only): el navegador no bloquea
 * nada, solo escribe en la consola lo que la violaría. Sin endpoint de reportes (no suma invocaciones).
 * Sirve para ver en producción qué falta antes de aplicarla de verdad. Variante «sin nonces» de la guía
 * de Next (docs/01-app/02-guides/content-security-policy.md): script-src con 'unsafe-inline', compatible
 * con páginas estáticas e ISR.
 *
 * Orígenes, verificados en el código:
 *  - Wompi: el widget se carga desde https://checkout.wompi.co/widget.js (plan-checkout.tsx), monta su
 *    ventana en un iframe del mismo origen y, según el comercio, inyecta sus scripts antifraude
 *    (https://cdn.siftscience.com/s.js, https://device.clearsale.com.br/p/fp.js, leídos en widget.js).
 *    El pago en pantalla completa navega a https://checkout.wompi.co/p/ (checkout-utils.ts).
 *  - Fotos: Cloudinary (res.cloudinary.com), Drive (*.googleusercontent.com, drive.google.com) y las
 *    miniaturas de YouTube (i.ytimg.com).
 *  - Video: reproductor de https://www.youtube-nocookie.com (video-youtube.tsx).
 *  - Panel: subida directa a https://api.cloudinary.com (cloudinary-uploader.tsx).
 *  - Fuentes: next/font las sirve desde el propio sitio.
 * Lo que la consola reporte de más (p. ej. las conexiones de los scripts antifraude) se agrega aquí
 * antes de pasarla a Content-Security-Policy.
 */
const ES_DESARROLLO = process.env.NODE_ENV === "development";
const CSP_REPORTE = [
  "default-src 'self'",
  // React usa eval en desarrollo para reconstruir las pilas de error (guía de CSP de Next).
  `script-src 'self' 'unsafe-inline'${ES_DESARROLLO ? " 'unsafe-eval'" : ""} https://checkout.wompi.co https://cdn.siftscience.com https://device.clearsale.com.br`,
  "style-src 'self' 'unsafe-inline'",
  "img-src 'self' data: blob: https://res.cloudinary.com https://*.googleusercontent.com https://drive.google.com https://i.ytimg.com https://checkout.wompi.co",
  "font-src 'self' data:",
  `connect-src 'self' https://checkout.wompi.co https://api.cloudinary.com${ES_DESARROLLO ? " ws:" : ""}`,
  "frame-src https://checkout.wompi.co https://www.youtube-nocookie.com",
  "media-src 'self'",
  "worker-src 'self' blob:",
  "manifest-src 'self'",
  "frame-ancestors 'self'",
  "base-uri 'self'",
  "object-src 'none'",
  "form-action 'self' https://checkout.wompi.co",
].join("; ");

/**
 * Parámetros de búsqueda del catálogo (ver src/lib/search/url.ts). /inmuebles es una página estática: con
 * cualquiera de ellos sirve el mismo HTML del CDN y el navegador filtra. Esas variantes no deben indexarse
 * (canonical = /inmuebles); `X-Robots-Tag` lo dice sin tocar la página. Una regla por parámetro porque
 * `has` exige todas sus condiciones a la vez.
 */
const PARAMS_FILTRO_CATALOGO = [
  "q", "tipo", "estado", "ciudad", "sector", "termino", "orden",
  "habitacionesMin", "banosMin", "parqueaderosMin", "precioMin", "precioMax", "areaMin", "areaMax",
] as const;

/** Archivos de /public que casi nunca cambian (si se cambia og.jpg, renombrarlo): un día en el CDN y el navegador. */
const CACHE_ESTATICOS_PUBLICOS = "public, max-age=86400, s-maxage=86400, stale-while-revalidate=604800";

const nextConfig: NextConfig = {
  // Sin cabecera `X-Powered-By: Next.js`: no anunciar el framework.
  poweredByHeader: false,
  // La foto de una tarjeta viaja hasta la ficha al navegar (React <ViewTransition>). Desde Next 16.4
  // funciona sin configuración; sin soporte del navegador, la navegación es la de siempre.
  images: {
    // Optimizador de Vercel apagado (ver arriba): el loader de SafeImage hace todo en el origen.
    loader: "custom",
    remotePatterns: [],
    // srcset hasta 1.600 px, el mismo tope del loader (con los anchos por defecto, 1920/2048/3840 repetían la foto).
    deviceSizes: [...ANCHOS_DISPOSITIVO],
  },
  // Enlaces antiguos (pagos en curso y correos de renovación ya enviados) hacia las rutas nuevas. Se resuelven
  // en el enrutador, sin ejecutar la página.
  async redirects() {
    return [
      { source: "/publica/agente", has: [{ type: "query", key: "pago", value: "procesado" }], destination: "/publica/agente/pago", permanent: false },
      { source: "/publica/agente", has: [{ type: "query", key: "renovar" }], destination: "/publica/agente/renovar", permanent: false },
    ];
  },
  async headers() {
    return [
      {
        // Cabeceras de seguridad base (Vercel solo añade HSTS por defecto).
        source: "/:path*",
        headers: [
          { key: "Content-Security-Policy", value: CSP },
          { key: "Content-Security-Policy-Report-Only", value: CSP_REPORTE },
          { key: "X-Content-Type-Options", value: "nosniff" },
          { key: "X-Frame-Options", value: "SAMEORIGIN" },
          { key: "Referrer-Policy", value: "strict-origin-when-cross-origin" },
          { key: "Permissions-Policy", value: "camera=(), microphone=(), geolocation=()" },
        ],
      },
      ...PARAMS_FILTRO_CATALOGO.map((key) => ({
        source: "/inmuebles",
        has: [{ type: "query" as const, key }],
        headers: [{ key: "X-Robots-Tag", value: "noindex, follow" }],
      })),
      ...["/og.jpg", "/llms.txt"].map((source) => ({
        source,
        headers: [{ key: "Cache-Control", value: CACHE_ESTATICOS_PUBLICOS }],
      })),
    ];
  },
};

export default nextConfig;
