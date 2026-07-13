"use client";

import { useEffect, useRef } from "react";
import { preload } from "react-dom";

/**
 * Hero "POV": la foto del inmueble avanza (zoom + leve ascenso) a medida que
 * el usuario se desliza hacia abajo, como si entrara caminando a la propiedad.
 *
 * Implementado con transform + requestAnimationFrame (60fps, sin librerías):
 * el contenedor mide 175vh y el visor queda pegado (sticky) mientras el scroll
 * "recorre" el inmueble. Respeta prefers-reduced-motion.
 */
// Variantes responsive del fondo (WebP) con el JPEG original como fallback.
const BG_SRCSET = "/hero-960.webp 960w, /hero-1920.webp 1920w";
const BG_SIZES = "100vw";

export function HeroPov({ bg, children }: { bg: string; children: React.ReactNode }) {
  const rootRef = useRef<HTMLDivElement>(null);
  const imgRef = useRef<HTMLDivElement>(null);

  // La imagen es el candidato a LCP: el preload en el <head> con el mismo
  // srcset hace que el navegador la pida desde el primer byte del HTML.
  preload(bg, { as: "image", fetchPriority: "high", imageSrcSet: BG_SRCSET, imageSizes: BG_SIZES });

  useEffect(() => {
    const root = rootRef.current;
    const img = imgRef.current;
    if (!root || !img) return;
    if (window.matchMedia("(prefers-reduced-motion: reduce)").matches) return;

    let raf = 0;
    const onScroll = () => {
      cancelAnimationFrame(raf);
      raf = requestAnimationFrame(() => {
        const rect = root.getBoundingClientRect();
        const range = Math.max(1, rect.height - window.innerHeight);
        const progress = Math.min(1, Math.max(0, -rect.top / range));
        img.style.transform = `scale(${1 + progress * 0.5}) translateY(${progress * -5}%)`;
      });
    };
    onScroll();
    window.addEventListener("scroll", onScroll, { passive: true });
    window.addEventListener("resize", onScroll, { passive: true });
    return () => {
      window.removeEventListener("scroll", onScroll);
      window.removeEventListener("resize", onScroll);
      cancelAnimationFrame(raf);
    };
  }, []);

  return (
    <div ref={rootRef} className="relative h-[175vh]">
      <div className="sticky top-0 flex h-screen items-center justify-center overflow-hidden bg-ink">
        <div ref={imgRef} aria-hidden className="absolute inset-0 will-change-transform">
          {/* eslint-disable-next-line @next/next/no-img-element -- estático de public/, sin optimizador de Vercel (coste cero) */}
          <img
            src={bg}
            srcSet={BG_SRCSET}
            sizes={BG_SIZES}
            alt=""
            fetchPriority="high"
            className="h-full w-full object-cover object-center"
          />
        </div>
        <div className="absolute inset-0 bg-gradient-to-b from-ink/75 via-ink/45 to-ink/90" />
        <div className="pointer-events-none absolute inset-0 bg-grain opacity-[0.05]" />
        <div className="relative w-full">{children}</div>
      </div>
    </div>
  );
}
