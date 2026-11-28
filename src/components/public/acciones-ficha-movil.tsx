import { CalendarDays, MessageCircle } from "lucide-react";
import type { PropertyAdvertiser, PropertyStatus } from "@/lib/domain";
import { whatsappAnunciante, whatsappCic } from "@/lib/ficha/contacto";
import { EstadoPublico } from "./estado-publico";

/**
 * Acciones de la ficha justo después de la galería, solo en móvil y tableta: en esos anchos la tarjeta de
 * contacto (#visita) queda después de los datos y el simulador, y quien ya vio las fotos no tiene que bajar
 * para escribir. En escritorio la tarjeta va al lado y esto no se pinta.
 */
export function AccionesFichaMovil({
  titulo,
  codigo,
  url,
  precio,
  estado,
  anunciante,
}: {
  titulo: string;
  codigo: string;
  url: string;
  precio: string;
  estado: PropertyStatus;
  anunciante?: PropertyAdvertiser;
}) {
  const inmueble = { titulo, codigo, url };
  const alAnunciante = whatsappAnunciante(anunciante, inmueble);

  return (
    <section id="acciones-movil" aria-label="Contactar sobre este inmueble" className="wrap mt-6 lg:hidden">
      <div className="rounded-[var(--radius-card)] border border-line bg-white p-4">
        <div className="flex flex-wrap items-baseline justify-between gap-x-4 gap-y-1">
          <p className="tnum text-[1.375rem] font-semibold tracking-[-0.02em]">{precio}</p>
          <EstadoPublico estado={estado} />
        </div>
        <div className="mt-3 grid grid-cols-2 gap-2">
          <a
            href="#visita"
            className="inline-flex h-12 items-center justify-center gap-2 rounded-full bg-brand-700 px-4 text-[15px] font-medium text-white transition-colors hover:bg-brand-800 active:scale-[0.98]"
          >
            <CalendarDays className="h-4 w-4 shrink-0" aria-hidden />
            Agendar visita
          </a>
          <a
            href={whatsappCic(inmueble)}
            target="_blank"
            rel="noopener noreferrer"
            aria-label={alAnunciante ? "Escribir a CIC por WhatsApp" : "Escribir por WhatsApp sobre este inmueble"}
            className="inline-flex h-12 items-center justify-center gap-2 rounded-full border border-line-strong bg-white px-4 text-[15px] font-medium text-ink transition-colors hover:border-ink active:scale-[0.98]"
          >
            <MessageCircle className="h-4 w-4 shrink-0 text-[#1a9e4f]" aria-hidden />
            {alAnunciante ? "CIC" : "WhatsApp"}
          </a>
          {alAnunciante && (
            <a
              href={alAnunciante}
              target="_blank"
              rel="noopener noreferrer"
              className="col-span-2 inline-flex h-12 items-center justify-center gap-2 rounded-full bg-[#25D366] px-4 text-[15px] font-medium text-ink active:scale-[0.98]"
            >
              <MessageCircle className="h-4 w-4 shrink-0" aria-hidden />
              Escribir al anunciante{anunciante?.nombre ? ` (${anunciante.nombre})` : ""}
            </a>
          )}
        </div>
        <p className="mt-2.5 text-center text-[13px] text-muted">Código {codigo}</p>
      </div>
    </section>
  );
}
