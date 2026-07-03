"use client";

import Image, { type ImageProps } from "next/image";
import { useState } from "react";
import { ImageOff } from "lucide-react";
import { mediaLoader } from "@/lib/utils/image-loader";

/**
 * Imagen robusta para el catálogo: optimiza en el origen (Cloudinary/Drive) vía
 * `mediaLoader` —sin usar la cuota del optimizador de Vercel— y si la URL falla
 * (archivo borrado, CDN limitado), degrada con elegancia a un marcador en vez de
 * mostrar una imagen rota. Pensada para usarse dentro de un contenedor `relative`
 * junto con `fill`.
 */
export function SafeImage({ alt, ...props }: ImageProps) {
  const [failed, setFailed] = useState(false);

  if (failed) {
    return (
      <div className="flex h-full w-full items-center justify-center bg-surface text-muted">
        <ImageOff className="h-6 w-6" aria-hidden />
        <span className="sr-only">Imagen no disponible</span>
      </div>
    );
  }

  return <Image {...props} alt={alt} loader={mediaLoader} onError={() => setFailed(true)} />;
}
