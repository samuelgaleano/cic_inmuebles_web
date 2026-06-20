import { SearchX } from "lucide-react";
import type { PublicProperty } from "@/lib/domain";
import { PropertyCard } from "./property-card";

export function PropertyGrid({ properties }: { properties: PublicProperty[] }) {
  if (properties.length === 0) {
    return (
      <div className="flex flex-col items-center justify-center rounded-xl border border-dashed border-slate-300 bg-slate-50 py-16 text-center">
        <SearchX className="h-10 w-10 text-slate-400" />
        <p className="mt-3 font-medium text-slate-700">No encontramos inmuebles con esos filtros</p>
        <p className="text-sm text-slate-500">Prueba ajustando la búsqueda o limpiando los filtros.</p>
      </div>
    );
  }

  return (
    <div className="grid grid-cols-1 gap-6 sm:grid-cols-2 lg:grid-cols-3">
      {properties.map((p) => (
        <PropertyCard key={p.id} property={p} />
      ))}
    </div>
  );
}
