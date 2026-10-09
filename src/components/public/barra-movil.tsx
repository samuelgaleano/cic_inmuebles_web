"use client";

import { useEffect, useRef, useState } from "react";
import { cn } from "@/lib/utils/cn";

/**
 * Barra inferior solo para móvil: precio y "Agendar visita" siempre a mano.
 * Aparece cuando el visitante pasa el encabezado y se oculta mientras la
 * tarjeta de contacto ya está en pantalla (no estorba lo que ya muestra).
 */
export function BarraMovil({ titulo, precio, ancla = "#visita" }: { titulo: string; precio: string; ancla?: string }) {
  const [pasoEncabezado, setPasoEncabezado] = useState(false);
  const [contactoVisible, setContactoVisible] = useState(false);
  const centinela = useRef<HTMLDivElement>(null);

  useEffect(() => {
    const el = centinela.current;
    if (!el) return;
    const io = new IntersectionObserver(([e]) => setPasoEncabezado(!e.isIntersecting && e.boundingClientRect.top < 0), {
      threshold: 0,
    });
    io.observe(el);
    return () => io.disconnect();
  }, []);

  useEffect(() => {
    const destino = document.querySelector(ancla);
    if (!destino) return;
    const io = new IntersectionObserver(([e]) => setContactoVisible(e.isIntersecting), { threshold: 0.2 });
    io.observe(destino);
    return () => io.disconnect();
  }, [ancla]);

  const visible = pasoEncabezado && !contactoVisible;

  return (
    <>
      <div ref={centinela} aria-hidden className="pointer-events-none absolute left-0 top-[28rem] h-px w-px" />
      <div
        className={cn(
          "fixed inset-x-0 bottom-0 z-40 border-t border-line bg-white/90 px-5 pb-[max(0.75rem,env(safe-area-inset-bottom))] pt-3 backdrop-blur-xl transition-transform duration-500 ease-[var(--ease-fluid)] lg:hidden",
          visible ? "translate-y-0" : "translate-y-full",
        )}
        inert={!visible}
      >
        <div className="flex items-center justify-between gap-4">
          <div className="min-w-0">
            <p className="truncate text-[13px] text-muted">{titulo}</p>
            <p className="tnum text-[1.0625rem] font-semibold tracking-[-0.01em]">{precio}</p>
          </div>
          <a
            href={ancla}
            className="inline-flex h-11 shrink-0 items-center rounded-full bg-brand-700 px-6 text-[15px] font-medium text-white transition-colors hover:bg-brand-800 active:scale-[0.97]"
          >
            Agendar visita
          </a>
        </div>
      </div>
    </>
  );
}
