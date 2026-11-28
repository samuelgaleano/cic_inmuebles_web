"use client";

import { useEffect, useRef, useState } from "react";
import { MessageCircle } from "lucide-react";
import { whatsappAnunciante, whatsappCic } from "@/lib/ficha/contacto";
import type { PropertyAdvertiser } from "@/lib/domain";
import { cn } from "@/lib/utils/cn";

/**
 * Barra inferior solo para móvil: precio y "Agendar visita" siempre a mano.
 * Aparece cuando el visitante pasa el encabezado y se oculta mientras la
 * tarjeta de contacto (o el bloque de acciones tras la galería) ya está en
 * pantalla: no repite lo que ya se ve.
 */
export function BarraMovil({
  titulo,
  precio,
  codigo,
  url,
  anunciante,
  ancla = "#visita",
  ocultarCon = [],
}: {
  titulo: string;
  precio: string;
  codigo?: string;
  url?: string;
  /** Plan de publicación independiente: suma «Escribir al anunciante» junto al WhatsApp de CIC. */
  anunciante?: PropertyAdvertiser;
  ancla?: string;
  /** Otros bloques que ya muestran estas acciones (selectores CSS). */
  ocultarCon?: string[];
}) {
  const [pasoEncabezado, setPasoEncabezado] = useState(false);
  const [visibles, setVisibles] = useState<Set<string>>(() => new Set());
  const centinela = useRef<HTMLDivElement>(null);
  const selectores = [ancla, ...ocultarCon].join("|");

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
    const observadores = selectores.split("|").flatMap((sel) => {
      const destino = document.querySelector(sel);
      if (!destino) return [];
      const io = new IntersectionObserver(
        ([e]) =>
          setVisibles((prev) => {
            const sig = new Set(prev);
            if (e.isIntersecting) sig.add(sel);
            else sig.delete(sel);
            return sig;
          }),
        { threshold: 0.2 },
      );
      io.observe(destino);
      return [io];
    });
    return () => observadores.forEach((io) => io.disconnect());
  }, [selectores]);

  const visible = pasoEncabezado && visibles.size === 0;
  const inmueble = { titulo, codigo, url };
  const alAnunciante = whatsappAnunciante(anunciante, inmueble);

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
          <div className="flex shrink-0 gap-2">
            {/* En la ficha el botón flotante se oculta en móvil: WhatsApp vive aquí, con el código del inmueble. */}
            {!alAnunciante && (
              <a
                href={whatsappCic(inmueble)}
                target="_blank"
                rel="noopener noreferrer"
                aria-label="Escribir por WhatsApp sobre este inmueble"
                className="inline-flex h-11 w-11 items-center justify-center rounded-full bg-[#25D366] text-ink transition-transform active:scale-[0.97]"
              >
                <MessageCircle className="h-5 w-5" aria-hidden />
              </a>
            )}
            <a
              href={ancla}
              className="inline-flex h-11 items-center rounded-full bg-brand-700 px-5 text-[15px] font-medium text-white transition-colors hover:bg-brand-800 active:scale-[0.97]"
            >
              Agendar visita
            </a>
          </div>
        </div>
        {/* Con anunciante, los dos WhatsApp van en su propia fila: cada uno dice a quién le escribe. */}
        {alAnunciante && (
          <div className="mt-2.5 grid grid-cols-2 gap-2">
            <a
              href={alAnunciante}
              target="_blank"
              rel="noopener noreferrer"
              className="inline-flex h-10 items-center justify-center gap-1.5 rounded-full bg-[#25D366] px-3 text-[14px] font-medium text-ink transition-transform active:scale-[0.97]"
            >
              <MessageCircle className="h-4 w-4 shrink-0" aria-hidden />
              <span className="truncate">Escribir al anunciante</span>
            </a>
            <a
              href={whatsappCic(inmueble)}
              target="_blank"
              rel="noopener noreferrer"
              className="inline-flex h-10 items-center justify-center gap-1.5 rounded-full border border-line-strong bg-white px-3 text-[14px] font-medium text-ink transition-transform active:scale-[0.97]"
            >
              <MessageCircle className="h-4 w-4 shrink-0 text-[#1a9e4f]" aria-hidden />
              <span className="truncate">Escribir a CIC</span>
            </a>
          </div>
        )}
      </div>
    </>
  );
}
