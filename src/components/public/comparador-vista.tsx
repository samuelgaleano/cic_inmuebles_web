"use client";

import { useEffect, useMemo, useSyncExternalStore } from "react";
import Link from "next/link";
import { useSearchParams } from "next/navigation";
import { X } from "lucide-react";
import { SafeImage } from "@/components/ui/safe-image";
import { buttonVariants } from "@/components/ui/button";
import { MAX_COMPARAR, useComparar } from "@/lib/cliente/almacenes";
import { leerSlugs } from "@/lib/cliente/seleccion";
import { PROPERTY_STATUS_PUBLIC_LABELS, PROPERTY_TYPE_LABELS } from "@/lib/domain";
import { precioPorM2 } from "@/lib/ficha/valor";
import type { ItemIndice } from "@/lib/search/indice";
import { cn } from "@/lib/utils/cn";
import { formatPrice } from "@/lib/utils/format";
import { EstadoPublico } from "./estado-publico";

const sinSuscripcion = () => () => {};

type Fila = {
  etiqueta: string;
  /** Valor numérico para decidir cuál es el mejor (undefined = no aplica). */
  numero: (i: ItemIndice) => number | undefined;
  mostrar: (i: ItemIndice) => string;
  mejor?: "min" | "max";
};

const FILAS: Fila[] = [
  { etiqueta: "Precio", numero: (i) => i.precio, mostrar: (i) => formatPrice(i.precio), mejor: "min" },
  {
    etiqueta: "Precio por m²",
    numero: (i) => precioPorM2(i.precio, i.area),
    mostrar: (i) => {
      const v = precioPorM2(i.precio, i.area);
      return v ? formatPrice(v) : "—";
    },
    mejor: "min",
  },
  { etiqueta: "Área", numero: (i) => i.area, mostrar: (i) => (i.area != null ? `${i.area} m²` : "—"), mejor: "max" },
  { etiqueta: "Habitaciones", numero: (i) => i.habitaciones, mostrar: (i) => (i.habitaciones != null ? String(i.habitaciones) : "—"), mejor: "max" },
  { etiqueta: "Baños", numero: (i) => i.banos, mostrar: (i) => (i.banos != null ? String(i.banos) : "—"), mejor: "max" },
  { etiqueta: "Parqueaderos", numero: (i) => i.parqueaderos, mostrar: (i) => (i.parqueaderos != null ? String(i.parqueaderos) : "—"), mejor: "max" },
  {
    etiqueta: "Administración",
    numero: (i) => i.administracion,
    mostrar: (i) => (i.administracion != null ? `${formatPrice(i.administracion)} al mes` : "—"),
    mejor: "min",
  },
  { etiqueta: "Sector", numero: () => undefined, mostrar: (i) => [i.sector, i.ciudad].filter(Boolean).join(", ") || "—" },
  { etiqueta: "Conjunto o edificio", numero: () => undefined, mostrar: (i) => i.conjunto ?? "—" },
  { etiqueta: "Disponibilidad", numero: () => undefined, mostrar: (i) => PROPERTY_STATUS_PUBLIC_LABELS[i.estado] },
  { etiqueta: "Código", numero: () => undefined, mostrar: (i) => i.codigo },
];

/** Slugs con el mejor valor de la fila; vacío si hay un solo dato o todos son iguales (no hay nada que destacar). */
function ganadores(items: ItemIndice[], fila: Fila): Set<string> {
  if (!fila.mejor) return new Set();
  const valores = items.map((i) => ({ slug: i.slug, v: fila.numero(i) })).filter((x): x is { slug: string; v: number } => x.v !== undefined);
  if (valores.length < 2) return new Set();
  const objetivo = fila.mejor === "min" ? Math.min(...valores.map((x) => x.v)) : Math.max(...valores.map((x) => x.v));
  if (valores.every((x) => x.v === objetivo)) return new Set();
  return new Set(valores.filter((x) => x.v === objetivo).map((x) => x.slug));
}

/**
 * Comparador lado a lado (hasta 3). Resalta, fila por fila, el mejor valor y
 * deja decidir al visitante: no recomienda ni puntúa. La selección viaja en la
 * URL (`?s=a,b,c`) para poder compartirla.
 */
export function ComparadorVista({ indice }: { indice: ItemIndice[] }) {
  const params = useSearchParams();
  const { ids, quitar, reemplazar } = useComparar();
  const hidratado = useSyncExternalStore(sinSuscripcion, () => true, () => false);

  const porSlug = useMemo(() => new Map(indice.map((i) => [i.slug, i])), [indice]);
  const validos = useMemo(() => new Set(porSlug.keys()), [porSlug]);

  // Un enlace compartido manda: al llegar con ?s=…, esa selección pasa a ser la del visitante.
  const slugsEnlace = useMemo(() => leerSlugs(params.get("s"), validos, MAX_COMPARAR), [params, validos]);
  const claveEnlace = slugsEnlace.join(",");
  const claveLista = ids.filter((id) => validos.has(id)).join(",");

  useEffect(() => {
    if (claveEnlace && claveEnlace !== claveLista) reemplazar(slugsEnlace);
    // Solo cuando llega un enlace distinto; los cambios de la lista los refleja el efecto de abajo.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [claveEnlace]);

  // Mantiene la URL al día con la selección (enlace compartible), sin pisar un enlace que aún no se adoptó.
  useEffect(() => {
    if (!hidratado) return;
    if (claveEnlace && claveEnlace !== claveLista) return;
    const deseada = claveLista ? `?s=${claveLista}` : "";
    if (window.location.search !== deseada) window.history.replaceState(null, "", `/comparar${deseada}`);
  }, [claveLista, claveEnlace, hidratado]);

  if (!hidratado) return <div className="wrap min-h-[24rem]" aria-busy="true" />;

  const items = ids.map((s) => porSlug.get(s)).filter((i): i is ItemIndice => Boolean(i));

  if (items.length < 2) {
    return (
      <div className="wrap">
        <div className="max-w-xl rounded-[var(--radius-tile)] bg-surface p-8 sm:p-10">
          <h2 className="t-title">
            {items.length === 0 ? "Elige dos o tres inmuebles para compararlos." : "Falta uno más para comparar."}
          </h2>
          <p className="mt-3 text-muted">
            En el catálogo, toca «Comparar» en cada inmueble. Aquí verás sus cifras lado a lado, con la mejor de cada fila resaltada.
          </p>
          <Link href="/inmuebles" className={buttonVariants({ variant: "primary", size: "lg", className: "mt-8" })}>
            Ir al catálogo
          </Link>
        </div>
      </div>
    );
  }

  return (
    <div className="wrap">
      <div className="-mx-5 overflow-x-auto px-5 pb-4 sm:mx-0 sm:px-0">
        <table className="w-full min-w-[46rem] border-separate border-spacing-0 text-left">
          <caption className="sr-only">Comparación de {items.length} inmuebles</caption>
          <thead>
            <tr>
              <th scope="col" className="sticky left-0 z-10 w-40 bg-white" />
              {items.map((i) => (
                <th key={i.slug} scope="col" className="min-w-[13rem] px-3 pb-6 align-top font-normal first:pl-0">
                  <div className="relative">
                    <div className="relative aspect-[4/3] overflow-hidden rounded-[var(--radius-media)] bg-surface">
                      {i.portada && <SafeImage src={i.portada} alt="" fill sizes="(max-width: 1024px) 60vw, 320px" className="object-cover" />}
                    </div>
                    <button
                      type="button"
                      onClick={() => quitar(i.slug)}
                      aria-label={`Quitar «${i.titulo}» de la comparación`}
                      className="absolute right-2 top-2 flex h-9 w-9 items-center justify-center rounded-full bg-white/95 transition-transform duration-200 hover:scale-105 active:scale-95"
                    >
                      <X className="h-4 w-4" aria-hidden />
                    </button>
                  </div>
                  <p className="mt-3 text-[13px] text-muted">{PROPERTY_TYPE_LABELS[i.tipo]}</p>
                  <p className="mt-0.5 text-[1.25rem] font-semibold leading-snug tracking-[-0.02em]">
                    <Link href={`/inmuebles/${i.slug}`} className="rounded-sm hover:text-brand-700">{i.titulo}</Link>
                  </p>
                  <EstadoPublico estado={i.estado} className="mt-1" />
                </th>
              ))}
            </tr>
          </thead>
          <tbody>
            {FILAS.map((fila) => {
              const mejores = ganadores(items, fila);
              return (
                <tr key={fila.etiqueta}>
                  <th scope="row" className="sticky left-0 z-10 border-t border-line bg-white py-4 pr-4 text-left text-[14px] font-normal text-muted">
                    {fila.etiqueta}
                  </th>
                  {items.map((i) => {
                    const gana = mejores.has(i.slug);
                    return (
                      <td key={i.slug} className="border-t border-line px-3 py-4 text-[15px] first:pl-0">
                        <span className={cn("tnum inline-flex flex-wrap items-center gap-x-2 gap-y-1", gana ? "font-semibold text-ink" : "text-ink-soft")}>
                          {fila.mostrar(i)}
                          {gana && <span className="rounded-full bg-brand-50 px-2 py-0.5 text-[11px] font-medium text-brand-800">Mejor</span>}
                        </span>
                      </td>
                    );
                  })}
                </tr>
              );
            })}
            <tr>
              <th scope="row" className="sticky left-0 z-10 border-t border-line bg-white" />
              {items.map((i) => (
                <td key={i.slug} className="border-t border-line px-3 py-6 first:pl-0">
                  <Link href={`/inmuebles/${i.slug}#visita`} className={buttonVariants({ variant: "primary", size: "sm" })}>
                    Agendar visita
                  </Link>
                </td>
              ))}
            </tr>
          </tbody>
        </table>
      </div>
      <p className="mt-4 max-w-2xl text-[13px] leading-relaxed text-muted">
        «Mejor» marca la cifra más conveniente de cada fila (menor precio o administración, mayor área o número de espacios) con lo publicado hoy. No es una recomendación: la decisión depende de lo que busques.
      </p>
    </div>
  );
}
