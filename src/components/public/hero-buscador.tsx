"use client";

import { useMemo, useState } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { ArrowRight } from "lucide-react";
import { SafeImage } from "@/components/ui/safe-image";
import type { ItemIndice } from "@/lib/search/indice";
import { quitarSpans, type ContextoBusqueda } from "@/lib/search/interpretar";
import { buscar, ESTADO_VACIO, type EstadoBusqueda } from "@/lib/search/motor";
import { aQuery } from "@/lib/search/url";
import { formatPrice } from "@/lib/utils/format";
import { Buscador, Sugerencias, type ChipVista } from "./buscador";

/**
 * El buscador de la portada: entiende la frase mientras se escribe, muestra lo
 * que entendió y deja ver los primeros resultados — con la razón de cada uno —
 * sin salir de la página. Enter lleva al catálogo con la misma búsqueda.
 */
export function HeroBuscador({
  indice,
  ctx,
  sugerencias,
}: {
  indice: ItemIndice[];
  ctx: ContextoBusqueda;
  sugerencias: string[];
}) {
  const router = useRouter();
  const [texto, setTexto] = useState("");
  const busqueda = useMemo(() => buscar(indice, { ...ESTADO_VACIO, texto }, ctx), [indice, ctx, texto]);

  const hayTexto = texto.trim().length >= 2;
  const { resultados, relajaciones } = busqueda;
  const destino = (e: EstadoBusqueda) => `/inmuebles${aQuery(e)}`;

  const chips: ChipVista[] = busqueda.interpretacion.chips.map((c) => ({
    id: c.id,
    etiqueta: c.etiqueta,
    origen: "texto",
    onQuitar: () => setTexto((t) => quitarSpans(t, c.spans)),
  }));

  return (
    <div>
      <Buscador
        grande
        valor={texto}
        onCambiar={setTexto}
        onEnviar={() => hayTexto && router.push(destino({ ...ESTADO_VACIO, texto }))}
        chips={chips}
        total={hayTexto && chips.length > 0 ? resultados.length : undefined}
        sugerencias={sugerencias}
      />

      {!hayTexto && <Sugerencias frases={sugerencias} onElegir={setTexto} />}

      {hayTexto && (
        <div className="anim-sube mt-5 overflow-hidden rounded-[var(--radius-card)] border border-line bg-white shadow-float">
          {resultados.length > 0 ? (
            <>
              <ul className="divide-y divide-line">
                {resultados.slice(0, 4).map(({ item, razones }) => (
                  <li key={item.slug}>
                    <Link
                      href={`/inmuebles/${item.slug}`}
                      className="group flex items-center gap-4 p-3 pr-5 transition-colors hover:bg-surface"
                    >
                      <span className="relative h-16 w-16 shrink-0 overflow-hidden rounded-xl bg-surface">
                        {item.portada && <SafeImage src={item.portada} alt="" fill sizes="64px" className="object-cover" />}
                      </span>
                      <span className="min-w-0 flex-1">
                        <span className="block truncate font-semibold tracking-[-0.01em]">{item.titulo}</span>
                        <span className="tnum block truncate text-[14px] text-muted">
                          {[item.sector && item.sector.toLowerCase() !== item.titulo.toLowerCase() ? item.sector : null, formatPrice(item.precio)]
                            .filter(Boolean)
                            .join(" · ")}
                        </span>
                        {razones.length > 0 && (
                          <span className="block truncate text-[13px] text-brand-800">{razones.join(" · ")}</span>
                        )}
                      </span>
                      <ArrowRight className="h-4 w-4 shrink-0 text-muted transition-transform duration-200 group-hover:translate-x-0.5" aria-hidden />
                    </Link>
                  </li>
                ))}
              </ul>
              <Link
                href={destino({ ...ESTADO_VACIO, texto })}
                className="flex items-center justify-between border-t border-line px-5 py-3.5 text-[15px] font-medium text-brand-700 transition-colors hover:bg-surface"
              >
                <span>
                  Ver {resultados.length === 1 ? "el resultado" : <>los <span className="tnum">{resultados.length}</span> resultados</>}
                </span>
                <ArrowRight className="h-4 w-4" aria-hidden />
              </Link>
            </>
          ) : (
            <div className="p-5">
              <p className="font-semibold tracking-[-0.01em]">Ningún inmueble cumple todo eso a la vez.</p>
              {relajaciones.length > 0 ? (
                <ul className="mt-3 divide-y divide-line">
                  {relajaciones.map((r) => (
                    <li key={r.etiqueta}>
                      <button
                        type="button"
                        onClick={() => router.push(destino({ ...ESTADO_VACIO, manual: r.filtros }))}
                        className="group flex w-full items-center justify-between gap-4 py-3 text-left"
                      >
                        <span className="text-[15px]">{r.etiqueta}</span>
                        <span className="flex shrink-0 items-center gap-2 text-[14px] text-muted">
                          <span className="tnum">{r.total} {r.total === 1 ? "inmueble" : "inmuebles"}</span>
                          <ArrowRight className="h-4 w-4 transition-transform duration-200 group-hover:translate-x-0.5" aria-hidden />
                        </span>
                      </button>
                    </li>
                  ))}
                </ul>
              ) : (
                <p className="mt-1 text-[15px] text-muted">Prueba con otras palabras, o escríbenos y te ayudamos a encontrarlo.</p>
              )}
            </div>
          )}
        </div>
      )}
    </div>
  );
}
