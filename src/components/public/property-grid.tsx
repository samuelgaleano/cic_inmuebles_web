import { SearchX } from "lucide-react";
import type { PublicProperty } from "@/lib/domain";
import { PropertyCard } from "./property-card";
import { WhatsAppButton } from "./whatsapp-button";
import { siteConfig } from "@/lib/config/site";

export function PropertyGrid({ properties }: { properties: PublicProperty[] }) {
  if (properties.length === 0) {
    return (
      <div className="flex flex-col items-center justify-center rounded-[1.4rem] border border-dashed border-line bg-surface px-6 py-20 text-center">
        <span className="flex h-14 w-14 items-center justify-center rounded-2xl bg-white text-brand-600 shadow-sm">
          <SearchX className="h-7 w-7" />
        </span>
        <p className="mt-4 font-display text-lg font-bold text-ink">No encontramos inmuebles con esos filtros</p>
        <p className="mt-1 max-w-sm text-sm text-muted">
          Nuestro catálogo es seleccionado y cambia seguido. Cuéntanos qué buscas y te avisamos
          apenas llegue el indicado.
        </p>
        <WhatsAppButton
          className="mt-6"
          label="Cuéntanos qué buscas"
          message={`Hola ${siteConfig.name}, estoy buscando un inmueble y quiero que me ayuden a encontrarlo.`}
        />
      </div>
    );
  }

  return (
    <div className="grid grid-cols-1 gap-5 sm:grid-cols-2 lg:grid-cols-3">
      {properties.map((p) => (
        <PropertyCard key={p.id} property={p} />
      ))}
    </div>
  );
}
