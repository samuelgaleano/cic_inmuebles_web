"use client";

import { useCallback, useEffect, useRef, useState, ViewTransition } from "react";
import { ChevronLeft, ChevronRight, Images, X } from "lucide-react";
import { SafeImage } from "@/components/ui/safe-image";
import { mediaLoader } from "@/lib/utils/image-loader";
import { bloquearScroll } from "@/lib/cliente/scroll";
import { cn } from "@/lib/utils/cn";

export interface FotoGaleria {
  id: string;
  url: string;
  alt?: string;
}

const SIZES_VISOR = "100vw";

/**
 * Galería de la ficha: mosaico en escritorio (una foto grande y cuatro
 * pequeñas, siempre recortadas con el mismo criterio), tira deslizable en el
 * móvil, y un visor a pantalla completa donde la foto se ve COMPLETA y nítida
 * (object-contain sobre tinta). El visor es un <dialog> modal: foco atrapado y
 * Escape de serie; flechas del teclado, deslizar con el dedo y miniaturas.
 */
export function Galeria({ fotos, titulo, slug }: { fotos: FotoGaleria[]; titulo: string; slug: string }) {
  const visor = useRef<HTMLDialogElement>(null);
  const [indice, setIndice] = useState(0);
  // El visor solo pinta fotos mientras está abierto: cerrado no pide imágenes ni ocupa el DOM.
  const [abierto, setAbierto] = useState(false);
  const total = fotos.length;
  const inicioToque = useRef<{ x: number; y: number } | null>(null);

  const abrir = (i: number) => {
    setIndice(i);
    setAbierto(true);
    visor.current?.showModal();
    bloquearScroll(true);
  };
  const cerrar = () => visor.current?.close();
  const ir = useCallback((delta: number) => setIndice((i) => (i + delta + total) % total), [total]);

  useEffect(() => {
    const d = visor.current;
    if (!d) return;
    const alCerrar = () => {
      bloquearScroll(false);
      setAbierto(false);
    };
    d.addEventListener("close", alCerrar);
    return () => {
      d.removeEventListener("close", alCerrar);
      bloquearScroll(false);
    };
  }, []);

  // Al abrir el visor y al pasar de foto, las dos vecinas se piden con el mismo ancho que pedirá
  // next/image (el más chico de sus anchos estándar que cubre la pantalla): al avanzar ya están en caché.
  useEffect(() => {
    if (!visor.current?.open) return;
    const necesario = window.innerWidth * window.devicePixelRatio;
    const ancho = [640, 750, 828, 1080, 1200, 1920, 2048, 3840].find((w) => w >= necesario) ?? 3840;
    for (const j of [(indice + 1) % total, (indice - 1 + total) % total]) {
      const img = new window.Image();
      img.src = mediaLoader({ src: fotos[j].url, width: ancho });
    }
  }, [indice, total, fotos]);

  // Miniatura activa siempre a la vista.
  useEffect(() => {
    visor.current?.querySelector<HTMLElement>('[data-activa="true"]')?.scrollIntoView({ block: "nearest", inline: "center" });
  }, [indice]);

  if (total === 0) {
    return (
      <div className="wrap">
        <div className="flex aspect-[16/7] items-center justify-center rounded-[var(--radius-tile)] bg-surface text-muted">
          Fotos próximamente
        </div>
      </div>
    );
  }

  // Distribución del mosaico (md y más) según cuántas fotos hay; en móvil todas van en una tira.
  const celdas = (() => {
    if (total === 1) return ["md:col-span-4 md:row-span-2"];
    if (total === 2) return ["md:col-span-2 md:row-span-2", "md:col-span-2 md:row-span-2"];
    if (total === 3) return ["md:col-span-2 md:row-span-2", "md:col-span-2", "md:col-span-2"];
    if (total === 4) return ["md:col-span-2 md:row-span-2", "md:col-span-2", "md:col-span-1", "md:col-span-1"];
    return ["md:col-span-2 md:row-span-2", "", "", "", ""];
  })();
  const actual = fotos[indice];

  /** La primera foto lleva el nombre de la tarjeta de origen: al navegar, la foto viaja de una a otra. */
  const conTransicion = (i: number, nodo: React.ReactElement) =>
    i === 0 ? (
      <ViewTransition key={fotos[0].id} name={`foto-${slug}`} share="morph" default="none">
        {nodo}
      </ViewTransition>
    ) : (
      nodo
    );

  return (
    <div className="wrap">
      {/* Una sola lista para todos los anchos: tira deslizable en móvil, mosaico desde md.
          Así cada foto existe una vez (y un solo elemento lleva el nombre de la transición). */}
      <div className="relative">
        <ul
          className={cn(
            "-mx-5 flex snap-x snap-mandatory gap-3 overflow-x-auto px-5 pb-1 [scrollbar-width:none] [&::-webkit-scrollbar]:hidden",
            "md:mx-0 md:grid md:h-[min(34rem,46vw)] md:grid-cols-4 md:grid-rows-2 md:gap-2 md:overflow-hidden md:rounded-[var(--radius-tile)] md:p-0 md:pb-0",
          )}
        >
          {fotos.map((f, i) => (
            <li key={f.id} className={cn("w-[86vw] shrink-0 snap-center md:w-auto md:shrink", celdas[i] ?? "md:hidden")}>
              {conTransicion(
                i,
                <button
                  type="button"
                  onClick={() => abrir(i)}
                  aria-label={`Ver la foto ${i + 1} de ${total}`}
                  className="group relative block aspect-[4/3] w-full overflow-hidden rounded-[var(--radius-card)] bg-surface md:aspect-auto md:h-full md:rounded-none"
                >
                  <SafeImage
                    src={f.url}
                    alt={f.alt ?? `${titulo} — foto ${i + 1}`}
                    fill
                    loading={i === 0 ? "eager" : undefined}
                    fetchPriority={i === 0 ? "high" : undefined}
                    sizes={
                      i === 0
                        ? "(max-width: 767px) 86vw, (max-width: 1280px) 50vw, 600px"
                        : "(max-width: 767px) 86vw, (max-width: 1280px) 25vw, 300px"
                    }
                    className="object-cover transition-transform duration-[900ms] ease-[var(--ease-fluid)] group-hover:scale-[1.04]"
                  />
                  <span className="absolute bottom-3 right-3 rounded-full bg-white/95 px-2.5 py-1 text-[12px] font-medium text-ink md:hidden">
                    <span className="tnum">{i + 1}</span> / <span className="tnum">{total}</span>
                  </span>
                </button>,
              )}
            </li>
          ))}
        </ul>
        {total > 1 && (
          <button
            type="button"
            onClick={() => abrir(0)}
            className="absolute bottom-4 right-4 hidden h-10 items-center gap-2 rounded-full bg-white px-4 text-[14px] font-medium text-ink transition-transform duration-200 hover:scale-[1.03] active:scale-95 md:inline-flex"
          >
            <Images className="h-4 w-4" aria-hidden /> Ver las {total} fotos
          </button>
        )}
      </div>

      {/* Visor */}
      <dialog
        ref={visor}
        aria-label={`Fotos de ${titulo}`}
        onKeyDown={(e) => {
          if (e.key === "ArrowRight") ir(1);
          else if (e.key === "ArrowLeft") ir(-1);
          else if (e.key === "Home") setIndice(0);
          else if (e.key === "End") setIndice(total - 1);
        }}
        className="h-dvh w-screen bg-ink-deep text-white open:flex open:flex-col"
      >
        <div className="flex h-14 shrink-0 items-center justify-between px-5">
          <p aria-live="polite" className="tnum text-[14px] text-white/75">
            Foto {indice + 1} de {total}
          </p>
          <button
            type="button"
            onClick={cerrar}
            aria-label="Cerrar visor"
            className="flex h-10 w-10 items-center justify-center rounded-full transition-colors hover:bg-white/10"
          >
            <X className="h-5 w-5" aria-hidden />
          </button>
        </div>

        {abierto && (
        <div
          className="relative min-h-0 flex-1 touch-pan-y select-none"
          onPointerDown={(e) => {
            inicioToque.current = { x: e.clientX, y: e.clientY };
          }}
          onPointerUp={(e) => {
            const s = inicioToque.current;
            inicioToque.current = null;
            if (!s) return;
            const dx = e.clientX - s.x;
            if (Math.abs(dx) > 50 && Math.abs(dx) > Math.abs(e.clientY - s.y)) ir(dx < 0 ? 1 : -1);
          }}
        >
          <div key={actual.id} className="anim-fundido absolute inset-0 px-2 sm:px-16">
            <div className="relative h-full w-full">
              <SafeImage
                src={actual.url}
                alt={actual.alt ?? `${titulo} — foto ${indice + 1}`}
                fill
                sizes={SIZES_VISOR}
                className="object-contain"
              />
            </div>
          </div>

          {total > 1 && (
            <>
              <button
                type="button"
                onClick={() => ir(-1)}
                aria-label="Foto anterior"
                className="absolute left-3 top-1/2 hidden h-12 w-12 -translate-y-1/2 items-center justify-center rounded-full bg-white/10 transition-colors hover:bg-white/20 sm:flex"
              >
                <ChevronLeft className="h-6 w-6" aria-hidden />
              </button>
              <button
                type="button"
                onClick={() => ir(1)}
                aria-label="Foto siguiente"
                className="absolute right-3 top-1/2 hidden h-12 w-12 -translate-y-1/2 items-center justify-center rounded-full bg-white/10 transition-colors hover:bg-white/20 sm:flex"
              >
                <ChevronRight className="h-6 w-6" aria-hidden />
              </button>
            </>
          )}
        </div>

        )}

        {abierto && total > 1 && (
          <ul className="flex h-24 shrink-0 gap-2 overflow-x-auto px-5 py-3 [scrollbar-width:none] [&::-webkit-scrollbar]:hidden">
            {fotos.map((f, i) => (
              <li key={f.id} className="shrink-0">
                <button
                  type="button"
                  data-activa={i === indice}
                  onClick={() => setIndice(i)}
                  aria-label={`Ir a la foto ${i + 1}`}
                  aria-current={i === indice}
                  className={cn(
                    "relative block h-[4.5rem] w-[4.5rem] overflow-hidden rounded-lg transition-opacity duration-200",
                    i === indice ? "opacity-100 ring-2 ring-white" : "opacity-55 hover:opacity-90",
                  )}
                >
                  <SafeImage src={f.url} alt="" fill sizes="72px" className="object-cover" />
                </button>
              </li>
            ))}
          </ul>
        )}
      </dialog>
    </div>
  );
}
