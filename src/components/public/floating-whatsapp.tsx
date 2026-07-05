import { MessageCircle } from "lucide-react";
import { siteConfig, whatsappLink } from "@/lib/config/site";

/**
 * Botón flotante de WhatsApp presente en todo el sitio público: el contacto
 * con la inmobiliaria queda siempre a un toque, en cualquier página.
 */
export function FloatingWhatsApp() {
  return (
    <a
      href={whatsappLink(`Hola ${siteConfig.name}, quiero más información sobre sus inmuebles.`)}
      target="_blank"
      rel="noopener noreferrer"
      aria-label="Escríbenos por WhatsApp"
      className="group fixed bottom-5 right-5 z-40 flex h-14 items-center gap-0 rounded-full bg-[#25D366] pl-[15px] pr-[15px] text-white shadow-[0_14px_34px_-10px_rgba(37,211,102,0.65)] transition-all duration-300 ease-[cubic-bezier(0.16,1,0.3,1)] hover:pr-5 hover:shadow-[0_18px_40px_-10px_rgba(37,211,102,0.8)] active:scale-95"
    >
      <MessageCircle className="h-[26px] w-[26px] shrink-0" aria-hidden />
      <span className="max-w-0 overflow-hidden whitespace-nowrap text-sm font-semibold opacity-0 transition-all duration-300 ease-[cubic-bezier(0.16,1,0.3,1)] group-hover:ml-2.5 group-hover:max-w-[10rem] group-hover:opacity-100">
        Escríbenos
      </span>
    </a>
  );
}
