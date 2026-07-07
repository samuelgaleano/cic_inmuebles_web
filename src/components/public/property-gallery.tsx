"use client";

import { useRef, useState } from "react";
import { ChevronLeft, ChevronRight } from "lucide-react";
import { cn } from "@/lib/utils/cn";
import { SafeImage } from "@/components/ui/safe-image";
import type { PropertyMedia } from "@/lib/domain";

/**
 * Galería de la ficha del inmueble.
 *  - Imagen principal grande (lo más relevante).
 *  - Zoom al pasar el cursor, siguiendo la posición del mouse (product-zoom).
 *  - Flechas minimalistas para avanzar/retroceder sin usar miniaturas.
 *  - Puntos (dots) en vez de una tira de miniaturas: menos saturación visual.
 *  - Fotos verticales: se muestran completas (object-contain) sobre un fondo
 *    borroso de la propia foto, así no se recortan ni pixelan.
 */
export function PropertyGallery({ images, title }: { images: PropertyMedia[]; title: string }) {
  const [active, setActive] = useState(0);
  const zoomRef = useRef<HTMLDivElement>(null);

  if (images.length === 0) {
    return (
      <div className="flex aspect-[4/3] items-center justify-center rounded-[1.6rem] bg-surface text-muted">
        Sin imágenes disponibles
      </div>
    );
  }

  const current = images[active] ?? images[0];
  const many = images.length > 1;
  const go = (dir: number) => setActive((a) => (a + dir + images.length) % images.length);

  const onMove = (e: React.MouseEvent<HTMLDivElement>) => {
    const el = zoomRef.current;
    if (!el) return;
    const r = el.getBoundingClientRect();
    const x = ((e.clientX - r.left) / r.width) * 100;
    const y = ((e.clientY - r.top) / r.height) * 100;
    el.style.transformOrigin = `${x}% ${y}%`;
  };
  const zoomIn = () => {
    if (zoomRef.current) zoomRef.current.style.transform = "scale(1.9)";
  };
  const zoomOut = () => {
    const el = zoomRef.current;
    if (el) {
      el.style.transform = "scale(1)";
      el.style.transformOrigin = "center";
    }
  };

  return (
    <div
      tabIndex={0}
      onKeyDown={(e) => {
        if (e.key === "ArrowRight") go(1);
        if (e.key === "ArrowLeft") go(-1);
      }}
      className="group outline-none"
      aria-roledescription="carrusel"
    >
      <div className="relative aspect-[4/3] overflow-hidden rounded-[1.6rem] border border-line bg-ink sm:aspect-[3/2]">
        {/* Relleno borroso (para fotos verticales o de otra proporción) */}
        <SafeImage
          key={`${current.id}-bg`}
          src={current.url}
          alt=""
          aria-hidden
          fill
          sizes="(max-width: 1024px) 100vw, 66vw"
          className="scale-110 object-cover blur-2xl"
        />
        <span className="absolute inset-0 bg-ink/20" aria-hidden />

        {/* Imagen principal con zoom siguiendo el cursor */}
        <div
          ref={zoomRef}
          onMouseEnter={zoomIn}
          onMouseLeave={zoomOut}
          onMouseMove={onMove}
          className="absolute inset-0 cursor-zoom-in transition-transform duration-300 ease-out will-change-transform"
        >
          <SafeImage
            key={current.id}
            src={current.url}
            alt={current.alt ?? title}
            fill
            priority
            sizes="(max-width: 1024px) 100vw, 66vw"
            className="object-contain"
          />
        </div>

        {/* Flechas minimalistas */}
        {many && (
          <>
            <button
              type="button"
              onClick={() => go(-1)}
              aria-label="Imagen anterior"
              className="absolute left-3 top-1/2 z-10 flex h-11 w-11 -translate-y-1/2 items-center justify-center rounded-full border border-white/25 bg-ink/35 text-white opacity-100 backdrop-blur-md transition-all duration-300 ease-[cubic-bezier(0.16,1,0.3,1)] hover:bg-ink/60 active:scale-90 sm:opacity-0 sm:group-hover:opacity-100"
            >
              <ChevronLeft className="h-5 w-5" />
            </button>
            <button
              type="button"
              onClick={() => go(1)}
              aria-label="Imagen siguiente"
              className="absolute right-3 top-1/2 z-10 flex h-11 w-11 -translate-y-1/2 items-center justify-center rounded-full border border-white/25 bg-ink/35 text-white opacity-100 backdrop-blur-md transition-all duration-300 ease-[cubic-bezier(0.16,1,0.3,1)] hover:bg-ink/60 active:scale-90 sm:opacity-0 sm:group-hover:opacity-100"
            >
              <ChevronRight className="h-5 w-5" />
            </button>

            {/* Contador */}
            <span className="absolute right-4 top-4 z-10 rounded-full bg-ink/55 px-2.5 py-1 text-xs font-semibold text-white backdrop-blur-md">
              {active + 1} / {images.length}
            </span>
          </>
        )}
      </div>

      {/* Puntos: navegación compacta, sin saturar */}
      {many && (
        <div className="mt-4 flex flex-wrap items-center justify-center gap-2">
          {images.map((m, i) => (
            <button
              key={m.id}
              type="button"
              onClick={() => setActive(i)}
              aria-label={`Ver imagen ${i + 1}`}
              aria-current={i === active}
              className={cn(
                "h-2.5 rounded-full transition-all duration-300 ease-[cubic-bezier(0.16,1,0.3,1)]",
                i === active ? "w-7 bg-brand-600" : "w-2.5 bg-line hover:bg-brand-300",
              )}
            />
          ))}
        </div>
      )}
    </div>
  );
}
