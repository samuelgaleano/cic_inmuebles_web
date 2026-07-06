"use client";

import { useEffect, useRef } from "react";

/**
 * Hero "POV": al deslizar, el usuario "entra" al inmueble. La escena avanza por
 * las fotos de la propiedad (fachada → interiores) con zoom continuo y fundido
 * entre capas; el contenido se desvanece hacia el final para revelar la foto y
 * dar paso al portafolio.
 *
 * Claves de UX:
 *  - Responde desde el PRIMER píxel de scroll (zoom inmediato) → nunca se siente
 *    "trabado".
 *  - Tramo fijo corto (root 150vh) para no dejar scroll muerto.
 *  - transform + requestAnimationFrame (GPU, 60fps). Respeta reduced-motion.
 */
export function HeroPov({ images, children }: { images: string[]; children: React.ReactNode }) {
  const rootRef = useRef<HTMLDivElement>(null);
  const layersRef = useRef<(HTMLDivElement | null)[]>([]);
  const contentRef = useRef<HTMLDivElement>(null);
  const pics = images.length ? images : [""];

  useEffect(() => {
    const root = rootRef.current;
    if (!root) return;
    const reduce = window.matchMedia("(prefers-reduced-motion: reduce)").matches;
    const n = pics.length;

    let raf = 0;
    const render = () => {
      const rect = root.getBoundingClientRect();
      const range = Math.max(1, rect.height - window.innerHeight);
      const progress = reduce ? 0 : Math.min(1, Math.max(0, -rect.top / range));
      const pos = progress * Math.max(1, n - 1);

      layersRef.current.forEach((layer, i) => {
        if (!layer) return;
        const dist = pos - i;
        // Nítida en su turno; se funde al alejarse ±1 foto.
        const opacity = i === 0 && pos <= 0 ? 1 : Math.max(0, 1 - Math.abs(dist));
        // Zoom continuo y perceptible desde el primer movimiento.
        const scale = 1.06 + Math.max(0, dist) * 0.28 + Math.max(0, -dist) * 0.06;
        layer.style.opacity = String(opacity);
        layer.style.transform = `scale(${scale})`;
        layer.style.zIndex = String(opacity > 0.02 ? Math.round(opacity * 10) + 1 : 1);
      });

      // El contenido sube y se desvanece en el último 40% → revela la foto.
      const content = contentRef.current;
      if (content) {
        const t = Math.max(0, Math.min(1, (progress - 0.6) / 0.4));
        content.style.opacity = String(1 - t);
        content.style.transform = `translateY(${-t * 48}px)`;
      }
    };

    const onScroll = () => {
      cancelAnimationFrame(raf);
      raf = requestAnimationFrame(render);
    };
    render();
    if (!reduce) {
      window.addEventListener("scroll", onScroll, { passive: true });
      window.addEventListener("resize", onScroll, { passive: true });
    }
    return () => {
      window.removeEventListener("scroll", onScroll);
      window.removeEventListener("resize", onScroll);
      cancelAnimationFrame(raf);
    };
  }, [pics.length]);

  return (
    <div ref={rootRef} className="relative h-[150vh]">
      <div className="sticky top-0 flex h-screen items-center justify-center overflow-hidden bg-ink">
        {pics.map((src, i) => (
          <div
            key={i}
            ref={(el) => {
              layersRef.current[i] = el;
            }}
            aria-hidden
            className="absolute inset-0 will-change-transform"
            style={{
              backgroundImage: src ? `url(${src})` : undefined,
              backgroundSize: "cover",
              backgroundPosition: "center",
              opacity: i === 0 ? 1 : 0,
            }}
          />
        ))}
        {/* Velo opaco: legibilidad + look premium (más oscuro que la foto cruda) */}
        <div className="absolute inset-0 z-10 bg-gradient-to-b from-ink/85 via-ink/55 to-ink" />
        <div className="pointer-events-none absolute inset-0 z-10 bg-grain opacity-[0.06]" />
        <div ref={contentRef} className="relative z-20 w-full will-change-transform">
          {children}
        </div>
      </div>
    </div>
  );
}
