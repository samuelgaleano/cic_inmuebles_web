import type { NextConfig } from "next";

/**
 * Configuración de Next.js para CIC Inmuebles.
 *
 * `images.remotePatterns` habilita la optimización de imágenes remotas.
 * Estrategia híbrida de medios (ver docs/ARQUITECTURA.md):
 *  - Cloudinary  -> entrega/optimización de fotos (CDN)
 *  - YouTube     -> miniaturas de videos embebidos
 *  - Google Drive-> archivo / respaldo y, ocasionalmente, vistas previas
 *  - Unsplash    -> imágenes de ejemplo (seed) mientras no hay Cloudinary
 */
const nextConfig: NextConfig = {
  images: {
    remotePatterns: [
      { protocol: "https", hostname: "res.cloudinary.com" },
      { protocol: "https", hostname: "i.ytimg.com" },
      { protocol: "https", hostname: "img.youtube.com" },
      { protocol: "https", hostname: "drive.google.com" },
      { protocol: "https", hostname: "lh3.googleusercontent.com" },
      { protocol: "https", hostname: "images.unsplash.com" },
    ],
  },
  async headers() {
    return [
      {
        // Cabeceras de seguridad base (Vercel solo añade HSTS por defecto).
        // Sin CSP completa: Next inyecta scripts inline y una CSP estricta
        // requiere nonces; se cubre el resto de vectores sin riesgo de rotura.
        source: "/:path*",
        headers: [
          { key: "X-Content-Type-Options", value: "nosniff" },
          { key: "X-Frame-Options", value: "SAMEORIGIN" },
          { key: "Referrer-Policy", value: "strict-origin-when-cross-origin" },
          { key: "Permissions-Policy", value: "camera=(), microphone=(), geolocation=()" },
        ],
      },
      {
        // Assets del hero: nombres versionados (hero-960/hero-1920), caché larga.
        source: "/:hero(hero.*)",
        headers: [{ key: "Cache-Control", value: "public, max-age=86400, stale-while-revalidate=604800" }],
      },
    ];
  },
};

export default nextConfig;
