"use client";

import { useState } from "react";
import { Play } from "lucide-react";
import { SafeImage } from "@/components/ui/safe-image";

/**
 * Video de YouTube con fachada: muestra la miniatura y solo carga el
 * reproductor (y sus ~600 KB de scripts) cuando el visitante da play.
 */
export function VideoYoutube({ id, titulo }: { id: string; titulo: string }) {
  const [activo, setActivo] = useState(false);

  return (
    <div className="relative aspect-video overflow-hidden rounded-[var(--radius-card)] bg-ink">
      {activo ? (
        <iframe
          src={`https://www.youtube-nocookie.com/embed/${id}?autoplay=1&rel=0`}
          title={`Video de ${titulo}`}
          allow="accelerometer; autoplay; clipboard-write; encrypted-media; gyroscope; picture-in-picture"
          allowFullScreen
          className="h-full w-full"
        />
      ) : (
        <button type="button" onClick={() => setActivo(true)} aria-label={`Reproducir el video de ${titulo}`} className="group absolute inset-0">
          <SafeImage src={`https://i.ytimg.com/vi/${id}/hqdefault.jpg`} alt="" fill sizes="(max-width: 1024px) 100vw, 700px" className="object-cover opacity-90 transition-opacity group-hover:opacity-100" />
          <span className="absolute left-1/2 top-1/2 flex h-16 w-16 -translate-x-1/2 -translate-y-1/2 items-center justify-center rounded-full bg-white text-ink transition-transform duration-200 group-hover:scale-105 group-active:scale-95">
            <Play className="ml-0.5 h-6 w-6 fill-current" aria-hidden />
          </span>
        </button>
      )}
    </div>
  );
}
