"use client";

import { useState } from "react";
import { cn } from "@/lib/utils/cn";
import { SafeImage } from "@/components/ui/safe-image";
import { FramedPhoto } from "@/components/ui/framed-photo";
import type { PropertyMedia } from "@/lib/domain";

export function PropertyGallery({
  images,
  title,
}: {
  images: PropertyMedia[];
  title: string;
}) {
  const [active, setActive] = useState(0);

  if (images.length === 0) {
    return (
      <div className="flex aspect-[16/10] items-center justify-center rounded-[1.4rem] bg-surface text-muted">
        Sin imágenes disponibles
      </div>
    );
  }

  // Se montan la foto activa y sus vecinas (anterior/siguiente): las vecinas
  // se descargan por adelantado con opacidad 0, así el cambio es instantáneo
  // al navegar la galería (sin esperar la descarga en el clic).
  const visibles = [active - 1, active, active + 1].filter(
    (i) => i >= 0 && i < images.length,
  );

  return (
    <div>
      <div className="relative aspect-[16/10] overflow-hidden rounded-[1.4rem] border border-line bg-surface">
        {visibles.map((i) => (
          <div
            key={images[i].id}
            aria-hidden={i !== active}
            className={cn(
              "absolute inset-0 transition-opacity duration-300",
              i === active ? "opacity-100" : "opacity-0",
            )}
          >
            <FramedPhoto
              src={images[i].url}
              alt={images[i].alt ?? title}
              priority={i === 0}
              sizes="(max-width: 1024px) 100vw, 66vw"
            />
          </div>
        ))}
      </div>
      {images.length > 1 && (
        <div className="mt-3 grid grid-cols-5 gap-2 sm:grid-cols-6">
          {images.map((m, i) => (
            <button
              key={m.id}
              type="button"
              onClick={() => setActive(i)}
              aria-label={`Ver imagen ${i + 1}`}
              className={cn(
                "relative aspect-square overflow-hidden rounded-xl ring-2 ring-offset-2 ring-offset-white transition-all duration-300",
                i === active ? "ring-brand-600" : "ring-transparent hover:ring-brand-300",
              )}
            >
              <SafeImage
                src={m.thumbnailUrl ?? m.url}
                alt={m.alt ?? `${title} ${i + 1}`}
                fill
                sizes="120px"
                className="object-cover"
              />
            </button>
          ))}
        </div>
      )}
    </div>
  );
}
