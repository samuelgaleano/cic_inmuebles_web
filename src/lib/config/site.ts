/**
 * Configuración central del sitio. Los datos sensibles o que cambian por
 * entorno se leen de variables de entorno con valores por defecto seguros,
 * de modo que el proyecto compile y funcione sin configuración previa.
 */
export const siteConfig = {
  name: "CIC Inmuebles",
  tagline: "Tu próximo hogar, sin complicaciones",
  description:
    "Catálogo de apartamentos y casas en venta. Encuentra tu inmueble ideal y agenda una visita en segundos con CIC Inmuebles.",
  url: process.env.NEXT_PUBLIC_SITE_URL ?? "https://cicinmuebles.com",

  // Contacto público
  email: process.env.NEXT_PUBLIC_CONTACT_EMAIL ?? "cc.inmuebles@gmail.com",
  // Número en formato internacional sin "+", solo dígitos (para enlaces wa.me)
  whatsapp: process.env.NEXT_PUBLIC_WHATSAPP ?? "573000000000",
  phoneDisplay: process.env.NEXT_PUBLIC_PHONE_DISPLAY ?? "+57 300 000 0000",
  city: "Colombia",

  social: {
    instagram: process.env.NEXT_PUBLIC_INSTAGRAM ?? "",
    facebook: process.env.NEXT_PUBLIC_FACEBOOK ?? "",
  },
} as const;

export type SiteConfig = typeof siteConfig;

/** Construye un enlace de WhatsApp con mensaje predefinido. */
export function whatsappLink(message: string): string {
  return `https://wa.me/${siteConfig.whatsapp}?text=${encodeURIComponent(message)}`;
}
