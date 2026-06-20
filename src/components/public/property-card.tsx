import Image from "next/image";
import Link from "next/link";
import { Bath, BedDouble, Car, MapPin, Maximize } from "lucide-react";
import { StatusBadge } from "@/components/ui/status-badge";
import {
  getCoverMedia,
  OPERATION_LABELS,
  PROPERTY_TYPE_LABELS,
  type PublicProperty,
} from "@/lib/domain";
import { formatPrice } from "@/lib/utils/format";

export function PropertyCard({ property }: { property: PublicProperty }) {
  const cover = getCoverMedia(property);
  const { caracteristicas: c, ubicacion } = property;
  const sold = property.estado === "vendido";

  return (
    <Link
      href={`/inmuebles/${property.slug}`}
      className="group flex flex-col overflow-hidden rounded-xl border border-slate-200 bg-white shadow-sm transition-all hover:-translate-y-0.5 hover:shadow-md"
    >
      <div className="relative aspect-[4/3] overflow-hidden bg-slate-100">
        {cover ? (
          <Image
            src={cover.url}
            alt={cover.alt ?? property.titulo}
            fill
            sizes="(max-width: 768px) 100vw, (max-width: 1200px) 50vw, 33vw"
            className={`object-cover transition-transform duration-300 group-hover:scale-105 ${
              sold ? "opacity-80 grayscale-[35%]" : ""
            }`}
          />
        ) : (
          <div className="flex h-full items-center justify-center text-slate-400">Sin imagen</div>
        )}
        <div className="absolute left-3 top-3 flex gap-2">
          <span className="rounded-full bg-brand-900/85 px-2.5 py-1 text-xs font-semibold text-white">
            {OPERATION_LABELS[property.operacion]}
          </span>
        </div>
        <div className="absolute right-3 top-3">
          <StatusBadge status={property.estado} />
        </div>
      </div>

      <div className="flex flex-1 flex-col p-4">
        <p className="text-xs font-medium uppercase tracking-wide text-brand-600">
          {PROPERTY_TYPE_LABELS[property.tipo]}
        </p>
        <h3 className="mt-1 line-clamp-2 font-semibold text-slate-900 group-hover:text-brand-800">
          {property.titulo}
        </h3>
        <p className="mt-1 flex items-center gap-1 text-sm text-slate-500">
          <MapPin className="h-3.5 w-3.5" />
          {ubicacion.barrio ? `${ubicacion.barrio}, ` : ""}
          {ubicacion.ciudad}
        </p>

        <div className="mt-3 flex flex-wrap gap-x-4 gap-y-1 text-sm text-slate-600">
          {c.habitaciones != null && (
            <span className="flex items-center gap-1">
              <BedDouble className="h-4 w-4 text-brand-600" />
              {c.habitaciones}
            </span>
          )}
          {c.banos != null && (
            <span className="flex items-center gap-1">
              <Bath className="h-4 w-4 text-brand-600" />
              {c.banos}
            </span>
          )}
          {c.areaConstruida != null && (
            <span className="flex items-center gap-1">
              <Maximize className="h-4 w-4 text-brand-600" />
              {c.areaConstruida} m²
            </span>
          )}
          {c.parqueaderos != null && c.parqueaderos > 0 && (
            <span className="flex items-center gap-1">
              <Car className="h-4 w-4 text-brand-600" />
              {c.parqueaderos}
            </span>
          )}
        </div>

        <div className="mt-4 flex items-end justify-between border-t border-slate-100 pt-3">
          <p className="text-lg font-bold text-brand-900">
            {formatPrice(property.precio, property.moneda)}
            {property.operacion === "arriendo" && (
              <span className="text-sm font-normal text-slate-500">/mes</span>
            )}
          </p>
          <span className="text-sm font-medium text-brand-700 group-hover:underline">Ver más</span>
        </div>
      </div>
    </Link>
  );
}
