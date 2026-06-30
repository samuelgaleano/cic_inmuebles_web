import Link from "next/link";
import { SafeImage } from "@/components/ui/safe-image";
import { ArrowUpRight, Bath, BedDouble, Car, MapPin, Maximize } from "lucide-react";
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

  const specs = [
    c.habitaciones != null && { icon: BedDouble, value: c.habitaciones, label: "hab." },
    c.banos != null && { icon: Bath, value: c.banos, label: "baños" },
    c.areaConstruida != null && { icon: Maximize, value: `${c.areaConstruida}`, label: "m²" },
    c.parqueaderos != null && c.parqueaderos > 0 && { icon: Car, value: c.parqueaderos, label: "parq." },
  ].filter(Boolean) as { icon: typeof BedDouble; value: string | number; label: string }[];

  return (
    <Link
      href={`/inmuebles/${property.slug}`}
      className="group flex flex-col overflow-hidden rounded-[1.4rem] border border-line bg-white shadow-[0_1px_2px_rgba(11,26,21,0.04)] transition-all duration-500 ease-[cubic-bezier(0.16,1,0.3,1)] hover:-translate-y-1.5 hover:border-brand-200 hover:shadow-[0_28px_50px_-24px_rgba(11,26,21,0.35)]"
    >
      <div className="relative m-1.5 aspect-[4/3] overflow-hidden rounded-[1.05rem] bg-surface">
        {cover ? (
          <SafeImage
            src={cover.url}
            alt={cover.alt ?? property.titulo}
            fill
            sizes="(max-width: 768px) 100vw, (max-width: 1200px) 50vw, 33vw"
            className={`object-cover transition-transform duration-700 ease-[cubic-bezier(0.16,1,0.3,1)] group-hover:scale-[1.06] ${
              sold ? "opacity-85 grayscale-[35%]" : ""
            }`}
          />
        ) : (
          <div className="flex h-full items-center justify-center text-sm text-muted">Sin imagen</div>
        )}
        <div className="pointer-events-none absolute inset-0 bg-gradient-to-t from-ink/35 via-transparent to-transparent" />

        <div className="absolute left-3 top-3">
          <span className="rounded-full bg-ink/70 px-2.5 py-1 text-xs font-semibold text-white backdrop-blur-md">
            {OPERATION_LABELS[property.operacion]}
          </span>
        </div>
        <div className="absolute right-3 top-3">
          <StatusBadge status={property.estado} />
        </div>
      </div>

      <div className="flex flex-1 flex-col px-4 pb-4 pt-2">
        <p className="text-[11px] font-semibold uppercase tracking-[0.16em] text-brand-600">
          {PROPERTY_TYPE_LABELS[property.tipo]}
        </p>
        <h3 className="mt-1.5 line-clamp-2 font-display text-base font-bold leading-snug text-ink transition-colors group-hover:text-brand-700">
          {property.titulo}
        </h3>
        <p className="mt-1.5 flex items-center gap-1.5 text-sm text-muted">
          <MapPin className="h-3.5 w-3.5 shrink-0 text-brand-500" />
          <span className="truncate">
            {ubicacion.barrio ? `${ubicacion.barrio}, ` : ""}
            {ubicacion.ciudad}
          </span>
        </p>

        {specs.length > 0 && (
          <div className="mt-3.5 flex flex-wrap gap-1.5">
            {specs.map((s, i) => (
              <span
                key={i}
                className="inline-flex items-center gap-1.5 rounded-lg bg-surface px-2.5 py-1 text-xs font-medium text-ink-soft"
              >
                <s.icon className="h-3.5 w-3.5 text-brand-600" />
                {s.value}
                <span className="text-muted">{s.label}</span>
              </span>
            ))}
          </div>
        )}

        <div className="mt-4 flex items-end justify-between gap-2 border-t border-line pt-3.5">
          <p className="font-display text-lg font-extrabold tracking-tight text-ink">
            {formatPrice(property.precio, property.moneda)}
            {property.operacion === "arriendo" && (
              <span className="text-sm font-medium text-muted">/mes</span>
            )}
          </p>
          <span className="flex h-8 w-8 shrink-0 items-center justify-center rounded-full bg-brand-50 text-brand-700 transition-all duration-300 group-hover:bg-brand-600 group-hover:text-white">
            <ArrowUpRight className="h-4 w-4 transition-transform duration-300 group-hover:translate-x-0.5 group-hover:-translate-y-0.5" />
          </span>
        </div>
      </div>
    </Link>
  );
}
