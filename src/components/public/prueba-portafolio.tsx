import Link from "next/link";
import { ArrowRight } from "lucide-react";
import { buttonVariants } from "@/components/ui/button";
import { SafeImage } from "@/components/ui/safe-image";
import { cn } from "@/lib/utils/cn";
import { PROPERTY_TYPE_LABELS } from "@/lib/domain";
import { formatPriceOrConsult } from "@/lib/utils/format";
import { Declaracion } from "./declaracion";
import type { DatosTarjeta } from "./tarjeta-inmueble";

function Foto({ p, className }: { p?: DatosTarjeta; className?: string }) {
  if (!p?.portada) return <div className={cn("rounded-[var(--radius-card)] bg-brand-100", className)} aria-hidden />;
  return (
    <Link
      href={`/inmuebles/${p.slug}`}
      aria-label={`Ver ${p.titulo}`}
      className={cn("group relative block overflow-hidden rounded-[var(--radius-card)] bg-ink", className)}
    >
      <SafeImage
        src={p.portada}
        alt=""
        fill
        sizes="(max-width: 1024px) 45vw, 260px"
        className="object-cover transition-transform duration-[900ms] ease-[var(--ease-fluid)] group-hover:scale-[1.05]"
      />
      <span className="absolute inset-x-2.5 bottom-2.5 rounded-2xl bg-white px-3.5 py-2.5">
        <span className="block truncate text-[12px] text-muted">
          {PROPERTY_TYPE_LABELS[p.tipo]}
          {p.sector ? ` · ${p.sector}` : ""}
        </span>
        <span className="tnum block text-[1.0625rem] font-semibold leading-tight">{formatPriceOrConsult(p.precio)}</span>
      </span>
    </Link>
  );
}

/**
 * «Un portafolio corto, a propósito»: la declaración con sus pruebas a la vista.
 * A la izquierda el texto (se enciende al hacer scroll) con las dos acciones; a la
 * derecha un mosaico con dos inmuebles reales y las dos cifras que lo respaldan.
 */
export function PruebaPortafolio({ items, total }: { items: DatosTarjeta[]; total: number }) {
  const conFoto = items.filter((p) => p.portada);
  const a = conFoto[1] ?? conFoto[0];
  const b = conFoto[2] ?? conFoto[1];

  return (
    <div className="grid items-center gap-12 lg:grid-cols-[minmax(0,1fr)_minmax(0,0.95fr)] lg:gap-16">
      <div>
        <h2 id="corto" className="t-headline">Un portafolio corto, a propósito.</h2>
        <Declaracion
          className="mt-6 max-w-xl text-[1.1875rem] font-medium leading-snug tracking-[-0.015em] sm:text-[1.375rem]"
          texto="Visitamos y verificamos cada inmueble antes de publicarlo, respondemos directo por WhatsApp y, si vendes, solo cobramos cuando se cierra la venta."
        />
        <div className="mt-9 flex flex-wrap gap-3">
          <Link href="/inmuebles" className={buttonVariants({ variant: "primary", size: "lg" })}>
            Ver los inmuebles
            <ArrowRight className="h-4 w-4" aria-hidden />
          </Link>
          <Link href="/vender" className={buttonVariants({ variant: "outline", size: "lg" })}>
            Quiero vender el mío
          </Link>
        </div>
      </div>

      <div className="grid grid-cols-2 gap-3 sm:gap-4">
        <Foto p={a} className="aspect-[4/5]" />
        <div className="flex aspect-[4/5] flex-col justify-between rounded-[var(--radius-card)] bg-brand-700 p-5 text-white sm:p-6">
          <p className="text-[13px] text-white/80">Si vendes con CIC</p>
          <div>
            <p className="tnum text-[3.25rem] font-semibold leading-none tracking-[-0.04em] sm:text-[4rem]">3&nbsp;%</p>
            <p className="mt-2 text-[15px] leading-snug text-white/90">solo cuando se cierra la venta. Sin costo inicial.</p>
          </div>
        </div>
        <div className="flex aspect-[4/5] flex-col justify-between rounded-[var(--radius-card)] bg-ink p-5 text-white sm:p-6">
          <p className="text-[13px] text-white/70">Portafolio</p>
          <div>
            <p className="tnum text-[3.25rem] font-semibold leading-none tracking-[-0.04em] text-brand-400 sm:text-[4rem]">{total}</p>
            <p className="mt-2 text-[15px] leading-snug text-white/85">
              {total === 1 ? "inmueble visitado y verificado" : "inmuebles visitados y verificados"} por CIC.
            </p>
          </div>
        </div>
        <Foto p={b} className="aspect-[4/5]" />
      </div>
    </div>
  );
}
