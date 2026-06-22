import { SearchX } from "lucide-react";
import type { PublicProperty } from "@/lib/domain";
import { PropertyCard } from "./property-card";

export function PropertyGrid({ properties }: { properties: PublicProperty[] }) {
  if (properties.length === 0) {
    return (
      <div className="flex flex-col items-center justify-center rounded-[1.4rem] border border-dashed border-line bg-surface py-20 text-center">
        <span className="flex h-14 w-14 items-center justify-center rounded-2xl bg-white text-brand-600 shadow-sm">
          <SearchX className="h-7 w-7" />
        </span>
        <p className="mt-4 font-display text-lg font-bold text-ink">No encontramos inmuebles con esos filtros</p>
        <p className="mt-1 text-sm text-muted">Prueba ajustando la búsqueda o limpiando los filtros.</p>
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
