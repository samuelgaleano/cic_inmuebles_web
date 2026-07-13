/**
 * Configuración central del sitio. Los datos sensibles o que cambian por
 * entorno se leen de variables de entorno con valores por defecto seguros,
 * de modo que el proyecto compile y funcione sin configuración previa.
 */
export const siteConfig = {
  name: "CIC Inmuebles",
  tagline: "Apartamentos y casas en venta y arriendo en Colombia",
  description:
    "Encuentra apartamentos y casas en venta y arriendo en Colombia. Te ayudamos a vender o arrendar tu inmueble de forma rápida y segura: fotos profesionales, visitas y negociación, con respuesta directa por WhatsApp.",
  // URL canónica real del sitio (al comprar dominio propio, cámbiala vía NEXT_PUBLIC_SITE_URL)
  url:
    process.env.NEXT_PUBLIC_SITE_URL ??
    "https://cic-inmuebles-web-samuelgaleanoalvis-8896s-projects.vercel.app",

  // Contacto público (número fijo del negocio, igual en toda la página)
  email: process.env.NEXT_PUBLIC_CONTACT_EMAIL ?? "cc.inmuebles@gmail.com",
  // WhatsApp: formato internacional sin "+", solo dígitos (para enlaces wa.me)
  whatsapp: "573249071717",
  // Enlace de llamada (tel:) en formato internacional con "+"
  phone: "+573249071717",
  // Número tal como se muestra en pantalla
  phoneDisplay: "+57 324 907 1717",
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
