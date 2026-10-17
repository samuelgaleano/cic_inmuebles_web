import type { NextConfig } from "next";

/**
 * Configuración de Next.js para CIC Inmuebles.
 *
 * Imágenes: TODAS las <Image> del sitio pasan por `SafeImage`, que usa el loader
 * propio `mediaLoader` (src/lib/utils/image-loader.ts): Cloudinary y Drive
 * optimizan en el origen y el resto se sirve tal cual. Con un loader propio,
 * next/image nunca llama al optimizador de Vercel (/_next/image).
 *
 * Por eso el optimizador queda cerrado a lo mínimo: solo acepta fotos de la
 * cuenta propia de Cloudinary (NEXT_PUBLIC_CLOUDINARY_CLOUD_NAME). Antes admitía
 * cualquier ruta de res.cloudinary.com, YouTube, Drive, googleusercontent y
 * Unsplash: cualquiera podía usar /_next/image como proxy de imágenes ajenas y
 * gastar la cuota del plan. No se usa `unoptimized: true` porque en Next 16 eso
 * hace que <Image> ignore también el loader propio (get-img-props.js) y las fotos
 * de Cloudinary saldrían sin redimensionar.
 */
const cloudinaryCloud = process.env.NEXT_PUBLIC_CLOUDINARY_CLOUD_NAME?.trim();

/**
 * CSP mínima y segura: solo directivas que no tocan scripts ni conexiones (Next
 * inyecta scripts inline y una CSP de scripts exige nonces; el widget de Wompi y
 * Cloudinary cargan recursos externos). Lo que sí cierra:
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

const nextConfig: NextConfig = {
  // Sin cabecera `X-Powered-By: Next.js`: no anunciar el framework.
  poweredByHeader: false,
  // La foto de una tarjeta viaja hasta la ficha al navegar (React <ViewTransition>); sin soporte del
  // navegador, la navegación es la de siempre.
  experimental: { viewTransition: true },
  images: {
    remotePatterns: cloudinaryCloud
      ? [{ protocol: "https", hostname: "res.cloudinary.com", pathname: `/${cloudinaryCloud}/**` }]
      : [],
  },
  async headers() {
    return [
      {
        // Cabeceras de seguridad base (Vercel solo añade HSTS por defecto).
        source: "/:path*",
        headers: [
          { key: "Content-Security-Policy", value: CSP },
          { key: "X-Content-Type-Options", value: "nosniff" },
          { key: "X-Frame-Options", value: "SAMEORIGIN" },
          { key: "Referrer-Policy", value: "strict-origin-when-cross-origin" },
          { key: "Permissions-Policy", value: "camera=(), microphone=(), geolocation=()" },
        ],
      },
    ];
  },
};

export default nextConfig;
