"use client";

import Link from "next/link";
import { ArrowUpRight, Bath, BedDouble, Car, Maximize } from "lucide-react";
import { FramedPhoto } from "@/components/ui/framed-photo";
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
    <span className="inline-flex items-center gap-1.5 rounded-full border border-white/25 bg-white/10 px-3 py-1.5 text-xs font-semibold text-white backdrop-blur-md">
      <Icon className="h-3.5 w-3.5 text-brand-300" /> {children}
    </span>
  );
}

/**
 * Portafolio en dos columnas de tarjetas amplias. Al pasar el cursor (o dar
 * foco), la tarjeta acerca la foto y despliega desde abajo un panel con la
 * descripción y las especificaciones del inmueble. En móvil (sin hover) el
 * panel se muestra siempre, de forma compacta.
 */
export function PortfolioExpand({ items }: { items: PortfolioItem[] }) {
  return (
    <div className="grid gap-5 sm:grid-cols-2">
      {items.map((p, i) => (
        <Link
          key={p.id}
          href={`/inmuebles/${p.slug}`}
          className="group relative block aspect-[4/3] overflow-hidden rounded-[1.6rem] border border-line bg-ink outline-none focus-visible:ring-2 focus-visible:ring-brand-500 focus-visible:ring-offset-2"
        >
          {p.cover ? (
            <FramedPhoto
              src={p.cover}
              alt={p.titulo}
              sizes="(max-width: 640px) 100vw, 540px"
              className="transition-transform duration-[900ms] ease-[cubic-bezier(0.16,1,0.3,1)] group-hover:scale-[1.06] group-focus-visible:scale-[1.06]"
            />
          ) : (
            <div className="absolute inset-0 flex items-center justify-center text-sm text-white/40">
              Fotos próximamente
            </div>
          )}

          {/* Velo que se intensifica al expandir para dar legibilidad a la info */}
          <div className="absolute inset-0 bg-gradient-to-t from-ink/90 via-ink/25 to-transparent transition-opacity duration-500 lg:from-ink/70 lg:via-transparent lg:group-hover:from-ink/90 lg:group-hover:via-ink/40 lg:group-focus-visible:from-ink/90" />

          <span className="absolute left-5 top-5 font-mono text-sm font-semibold tracking-widest text-white/70">
            {String(i + 1).padStart(2, "0")}
          </span>
          {p.estado !== "disponible" && (
            <span className="absolute right-5 top-5">
              <StatusBadge status={p.estado} />
            </span>
          )}

          <div className="absolute inset-x-0 bottom-0 p-6">
            {/* Base: siempre visible */}
            <p className="text-xs font-semibold uppercase tracking-[0.16em] text-brand-300">
              {p.tipo}
              {p.sector ? ` · ${p.sector}` : ""}
            </p>
            <div className="mt-1.5 flex items-end justify-between gap-3">
              <h3 className="line-clamp-2 font-display text-xl font-bold leading-snug text-white sm:text-2xl">
                {p.titulo}
              </h3>
              <span className="flex h-10 w-10 shrink-0 items-center justify-center rounded-full bg-white/15 text-white backdrop-blur transition-colors duration-300 group-hover:bg-brand-500">
                <ArrowUpRight className="h-4 w-4" />
              </span>
            </div>
            <p className="mt-2 font-display text-2xl font-extrabold tracking-tight text-white">{p.precio}</p>

            {/* Panel que se despliega al expandir (siempre visible en móvil) */}
            <div className="grid grid-rows-[1fr] transition-all duration-500 ease-[cubic-bezier(0.16,1,0.3,1)] lg:grid-rows-[0fr] lg:opacity-0 lg:group-hover:grid-rows-[1fr] lg:group-hover:opacity-100 lg:group-focus-visible:grid-rows-[1fr] lg:group-focus-visible:opacity-100">
              <div className="overflow-hidden">
                {p.descripcion && (
                  <p className="mt-3 line-clamp-2 text-sm leading-relaxed text-white/85 sm:line-clamp-3">
                    {p.descripcion}
                  </p>
                )}
                <div className="mt-3 flex flex-wrap gap-2">
                  {p.habitaciones != null && <Spec icon={BedDouble}>{p.habitaciones} hab.</Spec>}
                  {p.banos != null && <Spec icon={Bath}>{p.banos} baños</Spec>}
                  {p.area != null && <Spec icon={Maximize}>{p.area} m²</Spec>}
                  {p.parqueaderos != null && p.parqueaderos > 0 && <Spec icon={Car}>{p.parqueaderos} parq.</Spec>}
                </div>
              </div>
            </div>
          </div>
        </Link>
      ))}
    </div>
  );
}
