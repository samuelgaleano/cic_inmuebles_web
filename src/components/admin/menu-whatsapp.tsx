"use client";

import { useEffect, useRef } from "react";
import { ChevronDown, MessageCircle } from "lucide-react";
import type { OpcionWhatsApp } from "@/lib/crm/plantillas-whatsapp";
import { EnlaceContacto } from "./enlace-contacto";

/**
 * «Escribir por WhatsApp» con los mensajes de cada etapa (src/lib/crm/plantillas-whatsapp.ts). Es un <details>:
 * abre sin JavaScript; con él, se cierra al elegir, con Escape o tocando fuera. En el celular cada opción mide 44 px.
 */
export function MenuWhatsApp({
  opciones,
  leadId,
  contactoId,
  enlaceSimple,
  className = "",
}: {
  opciones: OpcionWhatsApp[];
  leadId?: string;
  contactoId?: string;
  /** Chat sin mensaje (siempre al final). */
  enlaceSimple?: string;
  className?: string;
}) {
  const ref = useRef<HTMLDetailsElement>(null);

  useEffect(() => {
    const cerrar = () => ref.current?.removeAttribute("open");
    const fuera = (e: PointerEvent) => {
      if (ref.current?.open && !ref.current.contains(e.target as Node)) cerrar();
    };
    const tecla = (e: KeyboardEvent) => {
      if (e.key === "Escape" && ref.current?.open) {
        cerrar();
        ref.current.querySelector("summary")?.focus();
      }
    };
    document.addEventListener("pointerdown", fuera);
    document.addEventListener("keydown", tecla);
    return () => {
      document.removeEventListener("pointerdown", fuera);
      document.removeEventListener("keydown", tecla);
    };
  }, []);

  if (!opciones.length && !enlaceSimple) return null;
  const alElegir = () => ref.current?.removeAttribute("open");
  return (
    <details ref={ref} className={`group relative ${className}`}>
      <summary className="inline-flex min-h-11 cursor-pointer list-none items-center gap-1.5 rounded-xl bg-emerald-600 px-3.5 text-sm font-semibold text-white transition-colors hover:bg-emerald-700 [&::-webkit-details-marker]:hidden">
        <MessageCircle className="h-4 w-4" aria-hidden /> Escribir por WhatsApp
        <ChevronDown className="h-4 w-4 transition-transform group-open:rotate-180" aria-hidden />
      </summary>
      <ul className="absolute left-0 z-30 mt-2 w-[min(22rem,calc(100vw-4rem))] space-y-1 rounded-2xl border border-line bg-white p-2 shadow-xl sm:left-auto sm:right-0" role="list">
        {opciones.map((o) => (
          <li key={o.id} onClick={alElegir}>
            <EnlaceContacto
              href={o.href}
              leadId={leadId}
              contactoId={contactoId}
              className="flex min-h-11 flex-col justify-center rounded-xl px-3 py-2 text-left transition-colors hover:bg-emerald-50"
            >
              <span className="text-sm font-semibold text-ink">{o.etiqueta}</span>
              <span className="line-clamp-2 text-xs text-muted">{o.texto}</span>
            </EnlaceContacto>
          </li>
        ))}
        {enlaceSimple && (
          <li onClick={alElegir}>
            <EnlaceContacto href={enlaceSimple} leadId={leadId} contactoId={contactoId} className="flex min-h-11 items-center rounded-xl px-3 py-2 text-sm font-semibold text-ink-soft transition-colors hover:bg-surface">
              Abrir el chat sin mensaje
            </EnlaceContacto>
          </li>
        )}
      </ul>
    </details>
  );
}
