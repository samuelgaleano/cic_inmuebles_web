"use client";

import Link from "next/link";
import { ArrowUpRight, Bath, BedDouble, Car, Maximize } from "lucide-react";
import { SafeImage } from "@/components/ui/safe-image";
import { StatusBadge } from "@/components/ui/status-badge";
import type { PropertyStatus } from "@/lib/domain";

export interface PortfolioItem {
  id: string;
  slug: string;
  titulo: string;
  /** Precio ya formateado ($ 720.000.000). */
  precio: string;
  tipo: string;
  sector?: string;
  estado: PropertyStatus;
  cover?: string;
  descripcion: string;
  habitaciones?: number;
  banos?: number;
  area?: number;
  parqueaderos?: number;
}

function Spec({ icon: Icon, children }: { icon: typeof BedDouble; children: React.ReactNode }) {
  return (
    <span className="inline-flex items-center gap-1.5 rounded-full border border-white/20 bg-ink/40 px-3 py-1.5 text-xs font-semibold text-white backdrop-blur-md">
      <Icon className="h-3.5 w-3.5 text-brand-300" /> {children}
    </span>
  );
}

/**
 * Portafolio vertical desplegable: cada inmueble es una franja fotográfica que,
 * al pasar el mouse (o recibir foco), crece y revela descripción y specs.
 * En móvil (sin hover) cada tarjeta se muestra grande de entrada.
 */
export function PortfolioExpand({ items }: { items: PortfolioItem[] }) {
  return (
    <div className="flex flex-col gap-4">
      {items.map((p, i) => (
        <Link
          key={p.id}
          href={`/inmuebles/${p.slug}`}
          className="group relative block h-[24rem] overflow-hidden rounded-[1.6rem] border border-line outline-none transition-[height] duration-500 ease-[cubic-bezier(0.16,1,0.3,1)] focus-visible:ring-2 focus-visible:ring-brand-500 focus-visible:ring-offset-2 lg:h-28 lg:hover:h-[26rem] lg:focus-visible:h-[26rem]"
        >
          {p.cover ? (
            <SafeImage
              src={p.cover}
              alt={p.titulo}
              fill
              sizes="(max-width: 1024px) 100vw, 1104px"
              className="object-cover transition-transform duration-700 ease-[cubic-bezier(0.16,1,0.3,1)] lg:group-hover:scale-[1.03]"
            />
          ) : (
            <div className="absolute inset-0 flex items-center justify-center bg-ink/90 text-sm text-white/40">
              Fotos próximamente
            </div>
          )}
          <div className="absolute inset-0 bg-gradient-to-t from-ink/90 via-ink/30 to-ink/15" />

          {/* Detalle que se revela al desplegar (en móvil siempre visible) */}
          <div className="absolute inset-x-0 top-0 p-5 opacity-100 transition-opacity duration-500 sm:p-7 lg:opacity-0 lg:group-hover:opacity-100 lg:group-focus-visible:opacity-100">
            <div className="max-w-2xl">
              {p.estado !== "disponible" && (
                <div className="mb-3">
                  <StatusBadge status={p.estado} />
                </div>
              )}
              {p.descripcion && (
                <p className="line-clamp-3 text-sm leading-relaxed text-white/85 drop-shadow-md sm:text-base">
                  {p.descripcion}
                </p>
              )}
              <div className="mt-4 flex flex-wrap gap-2">
                {p.habitaciones != null && <Spec icon={BedDouble}>{p.habitaciones} hab.</Spec>}
                {p.banos != null && <Spec icon={Bath}>{p.banos} baños</Spec>}
                {p.area != null && <Spec icon={Maximize}>{p.area} m²</Spec>}
                {p.parqueaderos != null && p.parqueaderos > 0 && <Spec icon={Car}>{p.parqueaderos} parq.</Spec>}
              </div>
            </div>
          </div>

          {/* Franja base: siempre visible */}
          <div className="absolute inset-x-0 bottom-0 flex items-center gap-4 p-5 sm:p-6">
            <span className="font-mono text-sm font-semibold tracking-widest text-white/70">
              {String(i + 1).padStart(2, "0")}
            </span>
            <div className="min-w-0 flex-1">
              <p className="truncate font-display text-lg font-bold tracking-tight text-white sm:text-xl">
                {p.titulo}
              </p>
              <p className="truncate text-xs font-semibold uppercase tracking-[0.14em] text-brand-300">
                {p.tipo}
                {p.sector ? ` · ${p.sector}` : ""}
              </p>
            </div>
            <p className="shrink-0 font-display text-lg font-extrabold tracking-tight text-white sm:text-2xl">
              {p.precio}
            </p>
            <span className="hidden h-10 w-10 shrink-0 items-center justify-center rounded-full bg-white/15 text-white backdrop-blur transition-colors duration-300 group-hover:bg-brand-500 sm:flex">
              <ArrowUpRight className="h-4 w-4" />
            </span>
          </div>
        </Link>
      ))}
    </div>
  );
}
