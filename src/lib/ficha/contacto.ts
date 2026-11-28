import { siteConfig, whatsappLink } from "@/lib/config/site";
import type { PropertyAdvertiser } from "@/lib/domain";
import { enlaceWhatsApp } from "@/lib/utils/telefono";

/** Lo que identifica al inmueble en un mensaje de WhatsApp: el código es lo que el equipo busca en el panel. */
export interface InmuebleMensaje {
  titulo: string;
  codigo?: string;
  url?: string;
}

const referencia = (p: InmuebleMensaje) => `«${p.titulo}»${p.codigo ? ` (código ${p.codigo})` : ""}`;

/** WhatsApp de CIC con el inmueble ya escrito. */
export function whatsappCic(p: InmuebleMensaje): string {
  return whatsappLink(`Hola ${siteConfig.name}, me interesa ${referencia(p)}.${p.url ? ` ${p.url}` : ""}`);
}

/**
 * WhatsApp directo del anunciante (planes de publicación independiente), con el código del inmueble.
 * undefined si no hay anunciante o su número no sirve para WhatsApp: entonces la ficha solo muestra a CIC.
 */
export function whatsappAnunciante(anunciante: PropertyAdvertiser | undefined, p: InmuebleMensaje): string | undefined {
  if (!anunciante?.whatsapp) return undefined;
  const saludo = anunciante.nombre?.trim() ? `Hola ${anunciante.nombre.trim()}` : "Hola";
  return enlaceWhatsApp(
    anunciante.whatsapp,
    `${saludo}, vi en ${siteConfig.name} el inmueble ${referencia(p)} y me interesa.${p.url ? ` ${p.url}` : ""}`,
  );
}
