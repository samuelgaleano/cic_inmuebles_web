"use client";

import { useEffect, useRef } from "react";

/**
 * Hero "POV": al deslizar hacia abajo el usuario "entra" al inmueble. La escena
 * avanza por varias fotos de la propiedad (fachada → salas → habitaciones) con
 * zoom continuo y fundido entre capas, dando sensación de recorrido.
 *
 * Sin librerías: capas apiladas cuyo `opacity`/`transform` se actualiza con
 * requestAnimationFrame según el progreso del scroll. Respeta reduced-motion
 * (se queda en la primera foto, estática).
 */
export function HeroPov({ images, children }: { images: string[]; children: React.ReactNode }) {
  const rootRef = useRef<HTMLDivElement>(null);
  const layersRef = useRef<(HTMLDivElement | null)[]>([]);
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
      // Posición dentro del recorrido de fotos (0 … n-1).
      const pos = progress * (n - 1);
      layersRef.current.forEach((layer, i) => {
        if (!layer) return;
        const dist = pos - i;
        // Nítida cuando dist≈0; se funde al alejarse ±1 foto.
        const opacity = i === 0 && pos <= 0 ? 1 : Math.max(0, 1 - Math.abs(dist));
        // Cada foto entra alejada, se acerca al pasar por ella y sigue de largo.
        const scale = 1.06 + dist * 0.16;
        layer.style.opacity = String(opacity);
        layer.style.transform = `scale(${Math.max(1, scale)})`;
        layer.style.zIndex = String(opacity > 0.02 ? Math.round(opacity * 10) : 0);
      });
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
    <div ref={rootRef} className="relative h-[200vh]">
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
        <div className="absolute inset-0 bg-gradient-to-b from-ink/75 via-ink/45 to-ink/90" />
        <div className="pointer-events-none absolute inset-0 bg-grain opacity-[0.05]" />
        <div className="relative z-20 w-full">{children}</div>
      </div>
    </div>
  );
}
