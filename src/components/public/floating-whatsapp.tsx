"use client";

import { MessageCircle } from "lucide-react";
import { usePathname } from "next/navigation";
import { siteConfig, whatsappLink } from "@/lib/config/site";
import { cn } from "@/lib/utils/cn";

/** Lo que el visitante estaba mirando, para que el primer mensaje ya llegue con contexto. */
function mensajeSegunRuta(pathname: string): string {
  if (/^\/inmuebles\/[^/]+$/.test(pathname)) {
    return `Hola ${siteConfig.name}, me interesa este inmueble: ${siteConfig.url}${pathname}`;
  }
  if (pathname.startsWith("/vender")) return `Hola ${siteConfig.name}, quiero vender mi inmueble. ¿Me pueden ayudar?`;
  if (pathname.startsWith("/publica")) return `Hola ${siteConfig.name}, quiero publicar mis inmuebles con ustedes.`;
  return `Hola ${siteConfig.name}, quiero más información sobre sus inmuebles.`;
}

/**
 * Botón flotante de WhatsApp presente en todo el sitio público: el contacto
 * con la inmobiliaria queda siempre a un toque. En la ficha, en móvil, lo
 * reemplaza la barra inferior (precio + "Agendar visita") para no taparla.
 */
export function FloatingWhatsApp() {
  const pathname = usePathname();
  const enFicha = /^\/inmuebles\/[^/]+$/.test(pathname);

  return (
    <a
      href={whatsappLink(mensajeSegunRuta(pathname))}
      target="_blank"
      rel="noopener noreferrer"
      aria-label="Escríbenos por WhatsApp"
      className={cn(
        "fixed bottom-5 right-5 z-40 flex h-12 w-12 items-center justify-center rounded-full bg-[#25D366] text-ink shadow-float transition-transform duration-200 hover:scale-105 active:scale-95",
        enFicha && "max-lg:hidden",
      )}
    >
      <MessageCircle className="h-6 w-6" aria-hidden />
    </a>
  );
}
