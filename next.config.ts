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
};

export default nextConfig;
