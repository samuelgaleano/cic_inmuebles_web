import Link from "next/link";
import { ArrowUpRight } from "lucide-react";
import { SafeImage } from "@/components/ui/safe-image";
import { PROPERTY_TYPE_LABELS } from "@/lib/domain";
import { cn } from "@/lib/utils/cn";
import { formatPriceOrConsult } from "@/lib/utils/format";
import { resumenCifras, type DatosTarjeta } from "./tarjeta-inmueble";

/**
 * Vitrina de la portada: las fotos reales del portafolio, una a la vez, con un
 * fundido lento (solo CSS) y un letrero que lleva directo a la ficha. Se detiene
 * al pasar el cursor o al enfocar, y con «reducir movimiento» queda quieta en la primera.
 */
export function HeroVitrina({ items, resumen, className }: { items: DatosTarjeta[]; resumen?: string; className?: string }) {
  const fotos = items.filter((p) => p.portada).slice(0, 4);
  if (fotos.length === 0) return null;
  const ciclo = fotos.length >= 4 ? "vitrina-4" : fotos.length === 3 ? "vitrina-3" : "";

  return (
    <div className={cn("relative", className)}>
      <ul
        aria-label="Inmuebles del portafolio"
        className={cn(
          "vitrina relative aspect-[5/4] overflow-hidden rounded-[var(--radius-tile)] bg-ink sm:aspect-[16/11] lg:aspect-[4/5]",
          ciclo,
        )}
      >
        {fotos.map((p, i) => {
          const lugar = [p.sector, p.ciudad].filter(Boolean).join(", ");
          const cifras = resumenCifras(p);
          return (
            <li key={p.slug} className="vitrina-foto absolute inset-0" style={{ "--i": i } as React.CSSProperties}>
              <div className="vitrina-img absolute inset-0">
                <SafeImage
                  src={p.portada!}
                  alt=""
                  fill
                  fetchPriority={i === 0 ? "high" : undefined}
                  sizes="(max-width: 1024px) 92vw, 540px"
                  className="object-cover"
                />
              </div>
              <Link
                href={`/inmuebles/${p.slug}`}
                aria-label={`Ver ${p.titulo}${lugar ? `, ${lugar}` : ""}, ${formatPriceOrConsult(p.precio)}`}
                className="group absolute inset-x-3 bottom-3 flex items-center justify-between gap-4 rounded-[1.25rem] bg-white p-4 pl-5 transition-transform duration-300 hover:-translate-y-0.5 sm:inset-x-4 sm:bottom-4"
              >
                <span className="min-w-0">
                  <span className="block truncate text-[13px] text-muted">
                    {PROPERTY_TYPE_LABELS[p.tipo]}
                    {lugar ? ` · ${lugar}` : ""}
                  </span>
                  <span className="tnum mt-0.5 block text-[1.375rem] font-semibold leading-tight tracking-[-0.02em]">
                    {formatPriceOrConsult(p.precio)}
                  </span>
                  {cifras && <span className="tnum mt-0.5 block truncate text-[13px] text-muted">{cifras}</span>}
                </span>
                <span className="flex h-11 w-11 shrink-0 items-center justify-center rounded-full bg-brand-700 text-white transition-colors group-hover:bg-brand-800">
                  <ArrowUpRight className="h-5 w-5" aria-hidden />
                </span>
              </Link>
            </li>
          );
        })}
      </ul>
      {resumen && (
        <p className="tnum absolute -top-3 left-4 rounded-full bg-ink px-4 py-1.5 text-[13px] font-medium text-white sm:left-6">
          {resumen}
        </p>
      )}
    </div>
  );
}
