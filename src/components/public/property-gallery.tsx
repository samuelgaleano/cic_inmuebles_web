"use client";

import Image from "next/image";
import { useState } from "react";
import { cn } from "@/lib/utils/cn";
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

  const current = images[active] ?? images[0];

  return (
    <div>
      <div className="relative aspect-[16/10] overflow-hidden rounded-[1.4rem] border border-line bg-surface">
        <Image
          src={current.url}
          alt={current.alt ?? title}
          fill
          priority
          sizes="(max-width: 1024px) 100vw, 66vw"
          className="object-cover"
        />
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
              <Image
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
