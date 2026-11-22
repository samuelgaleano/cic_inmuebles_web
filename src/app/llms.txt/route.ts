import { PLANS } from "@/lib/config/plans";
import { siteConfig } from "@/lib/config/site";
import { formatPrice } from "@/lib/utils/format";

// Generado desde la configuración (contacto, redes y planes): si cambia un precio o el teléfono, cambia aquí solo.
// Estático: se construye en el build y la CDN lo sirve con el Cache-Control de next.config.
export const dynamic = "force-static";

export function GET() {
  const pagos = PLANS.filter((p) => p.audience === "agente" && p.mode === "pago");
  const desde = Math.min(...pagos.map((p) => p.precioCOP));
  const u = siteConfig.url;
  const texto = `# ${siteConfig.name}

> Inmobiliaria en ${siteConfig.city}: venta de apartamentos y casas. Los propietarios venden sin costo inicial y pagan una comisión del 3% solo al cerrar la venta. Agentes e inmobiliarias publican con planes desde ${formatPrice(desde)}. WhatsApp ${siteConfig.phoneDisplay} · ${siteConfig.email}.

${siteConfig.name} ayuda a compradores a encontrar apartamentos y casas en venta, y a propietarios a vender su inmueble: fotos, publicación, coordinación de visitas y acompañamiento en la negociación y la promesa de compraventa hasta el cierre. Cada inmueble del portafolio lo visita y verifica el equipo. También hace alianzas con agentes inmobiliarios compartiendo la comisión 50/50.

## Páginas principales

- [Inicio](${u}/): portafolio destacado y búsqueda por frase
- [Inmuebles en venta](${u}/inmuebles): catálogo completo; se puede buscar escribiendo lo que se quiere (zona, alcobas, presupuesto) o con filtros por sector, precio y características
- [Vende tu inmueble](${u}/vender): servicio para propietarios (sin costo inicial, 3% al cerrar) y preguntas frecuentes
- [Publica tu inmueble](${u}/publica): opciones para propietarios y para agentes
- [Planes para agentes](${u}/publica/agente): planes de publicación con pago en línea
- [Contacto](${u}/contacto): WhatsApp, teléfono y correo

## Planes para agentes e inmobiliarias

${pagos.map((p) => `- ${p.nombre}: ${formatPrice(p.precioCOP)} ${p.periodo}`).join("\n")}

## Redes

- Instagram: ${siteConfig.social.instagram}
- TikTok: ${siteConfig.social.tiktok}
- Facebook: ${siteConfig.social.facebook}

## Datos

- [Sitemap](${u}/sitemap.xml): todas las URLs indexables, incluidas las fichas de cada inmueble
`;
  return new Response(texto, { headers: { "Content-Type": "text/plain; charset=utf-8" } });
}
