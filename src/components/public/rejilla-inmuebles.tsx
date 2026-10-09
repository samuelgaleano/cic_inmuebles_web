import { MessageCircle } from "lucide-react";
import { buttonVariants } from "@/components/ui/button";
import { siteConfig, whatsappLink } from "@/lib/config/site";
import type { PublicProperty } from "@/lib/domain";
import { construirIndice } from "@/lib/search/indice";
import { TarjetaInmueble } from "./tarjeta-inmueble";

/** Rejilla de tarjetas para páginas de servidor (sectores, similares). El catálogo usa <Catalogo>. */
export function RejillaInmuebles({ inmuebles }: { inmuebles: PublicProperty[] }) {
  const items = construirIndice(inmuebles);

  if (items.length === 0) {
    return (
      <div className="mx-auto max-w-xl py-16 text-center">
        <h2 className="t-title">Por ahora no hay inmuebles aquí.</h2>
        <p className="mt-3 text-muted">
          El catálogo es corto a propósito y cambia seguido. Cuéntanos qué buscas y te avisamos apenas llegue el indicado.
        </p>
        <a
          href={whatsappLink(`Hola ${siteConfig.name}, estoy buscando un inmueble y quiero que me ayuden a encontrarlo.`)}
          target="_blank"
          rel="noopener noreferrer"
          className={buttonVariants({ variant: "outline", size: "lg", className: "mt-8" })}
        >
          <MessageCircle className="h-5 w-5" aria-hidden /> Cuéntanos qué buscas
        </a>
      </div>
    );
  }

  return (
    <ul className="grid gap-x-6 gap-y-14 sm:grid-cols-2 lg:grid-cols-3">
      {items.map((item, i) => (
        <li key={item.slug}>
          <TarjetaInmueble datos={item} prioridad={i < 3} />
        </li>
      ))}
    </ul>
  );
}
