/**
 * Configuración central del sitio. Los datos sensibles o que cambian por
 * entorno se leen de variables de entorno con valores por defecto seguros,
 * de modo que el proyecto compile y funcione sin configuración previa.
 */
// URL canónica del sitio, sin barra final (alimenta metadataBase, sitemap,
// canonicals, Open Graph y JSON-LD). Fija en código, igual que el teléfono:
// las variables de entorno viejas en Vercel ya la pisaron dos veces en
// silencio (NEXT_PUBLIC_SITE_URL=specifinance.com y
// VERCEL_PROJECT_PRODUCTION_URL capturando dominios ajenos). Variante www
// porque así está configurado Vercel (el ápex redirige 308 a www).
// Si el dominio cambia algún día, se cambia AQUÍ.
const siteUrl = "https://www.cicinmuebles.com";

export const siteConfig = {
  name: "CIC Inmuebles",
  tagline: "Apartamentos y casas en venta en Colombia",
  description:
    "Encuentra apartamentos y casas en venta en Colombia. Te ayudamos a vender tu inmueble de forma rápida y segura: fotos profesionales, visitas y negociación, con respuesta directa por WhatsApp.",
  url: siteUrl,

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

/** URL pública absoluta de la ficha de un inmueble. */
export function propertyUrl(slug: string): string {
  return `${siteConfig.url}/inmuebles/${slug}`;
}
