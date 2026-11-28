import type { MetadataRoute } from "next";

/**
 * Manifiesto para instalar el panel en la pantalla de inicio del celular («CIC Panel»). Abre directo en /admin
 * (el proxy pide la sesión si no la hay) y usa los íconos que ya existen en src/app. Colores de la marca:
 * verde esmeralda #07a276 y tinta verde-negro #0b1a15.
 */
export default function manifest(): MetadataRoute.Manifest {
  return {
    name: "CIC Panel",
    short_name: "CIC Panel",
    description: "Panel de CIC Inmuebles: leads, CRM, agenda e inmuebles.",
    id: "/admin",
    start_url: "/admin",
    scope: "/admin",
    display: "standalone",
    orientation: "portrait",
    lang: "es-CO",
    background_color: "#0b1a15",
    theme_color: "#07a276",
    icons: [
      { src: "/icon.svg", sizes: "any", type: "image/svg+xml", purpose: "any" },
      { src: "/apple-icon.png", sizes: "180x180", type: "image/png", purpose: "any" },
    ],
  };
}
