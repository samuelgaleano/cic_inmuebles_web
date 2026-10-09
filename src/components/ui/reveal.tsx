"use client";

import { useEffect, useRef } from "react";
import { cn } from "@/lib/utils/cn";

/**
 * Entrada suave al hacer scroll. El contenido es visible desde el servidor y
 * sin JavaScript: solo después de hidratar, y únicamente si el elemento está
 * por debajo del pliegue, se marca como "pendiente" (invisible) y se libera al
 * entrar en el viewport. Así un fallo de script nunca esconde la página, y lo
 * que ya está a la vista al cargar no parpadea.
 */
export function Reveal({
  children,
  className,
  delay = 0,
  as: Tag = "div",
}: {
  children: React.ReactNode;
  className?: string;
  /** Retraso en ms (escalonar hermanos de una lista). */
  delay?: number;
  as?: "div" | "li" | "section" | "article";
}) {
  const ref = useRef<HTMLElement>(null);

  useEffect(() => {
    const el = ref.current;
    if (!el) return;
    if (el.getBoundingClientRect().top < window.innerHeight * 0.92) return; // ya visible: no se oculta
    el.dataset.reveal = "pendiente";
    const io = new IntersectionObserver(
      ([entry]) => {
        if (entry.isIntersecting) {
          el.dataset.reveal = "listo";
          io.disconnect();
        }
      },
      { threshold: 0.1, rootMargin: "0px 0px -6% 0px" },
    );
    io.observe(el);
    return () => io.disconnect();
  }, []);

  return (
    <Tag
      ref={ref as never}
      style={delay ? ({ "--d": `${delay}ms` } as React.CSSProperties) : undefined}
      className={cn(className)}
    >
      {children}
    </Tag>
  );
}
