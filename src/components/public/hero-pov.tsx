"use client";

import { useEffect, useRef } from "react";

/**
 * Hero "POV": la foto del inmueble avanza (zoom + leve ascenso) a medida que
 * el usuario se desliza hacia abajo, como si entrara caminando a la propiedad.
 *
 * Implementado con transform + requestAnimationFrame (60fps, sin librerías):
 * el contenedor mide 175vh y el visor queda pegado (sticky) mientras el scroll
 * "recorre" el inmueble. Respeta prefers-reduced-motion.
 */
export function HeroPov({ bg, children }: { bg: string; children: React.ReactNode }) {
  const rootRef = useRef<HTMLDivElement>(null);
  const imgRef = useRef<HTMLDivElement>(null);

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
        <div
          ref={imgRef}
          aria-hidden
          className="absolute inset-0 will-change-transform"
          style={{ backgroundImage: `url(${bg})`, backgroundSize: "cover", backgroundPosition: "center" }}
        />
        <div className="absolute inset-0 bg-gradient-to-b from-ink/75 via-ink/45 to-ink/90" />
        <div className="pointer-events-none absolute inset-0 bg-grain opacity-[0.05]" />
        <div className="relative w-full">{children}</div>
      </div>
    </div>
  );
}
