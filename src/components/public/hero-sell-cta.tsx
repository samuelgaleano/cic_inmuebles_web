"use client";

import { useRef } from "react";
import Link from "next/link";
import { Banknote } from "lucide-react";

/**
 * CTA secundario del héroe, dirigido al propietario que quiere vender.
 * Efecto "magnético": el botón sigue ligeramente al cursor dentro de su
 * zona y un resplandor circular seguido del puntero refuerza la interacción
 * (mismo patrón de mouse-tracking que la galería de la ficha).
 */
export function HeroSellCta() {
  const zoneRef = useRef<HTMLDivElement>(null);

  const onMove = (e: React.MouseEvent<HTMLDivElement>) => {
    const el = zoneRef.current;
    if (!el) return;
    const r = el.getBoundingClientRect();
    const dx = e.clientX - r.left - r.width / 2;
    const dy = e.clientY - r.top - r.height / 2;
    el.style.transform = `translate(${dx * 0.2}px, ${dy * 0.3}px) scale(1.04)`;
    el.style.setProperty("--x", `${((e.clientX - r.left) / r.width) * 100}%`);
    el.style.setProperty("--y", `${((e.clientY - r.top) / r.height) * 100}%`);
  };
  const onLeave = () => {
    const el = zoneRef.current;
    if (el) el.style.transform = "translate(0px, 0px) scale(1)";
  };

  return (
    <div
      ref={zoneRef}
      onMouseMove={onMove}
      onMouseLeave={onLeave}
      className="group relative -m-3 p-3 transition-transform duration-300 ease-[cubic-bezier(0.16,1,0.3,1)] will-change-transform"
    >
      <span className="absolute -inset-2 -z-10 rounded-2xl bg-accent-400/50 opacity-0 blur-xl transition-opacity duration-500 group-hover:opacity-100" aria-hidden />
      <Link
        href="/vender"
        className="relative inline-flex h-12 items-center justify-center gap-2 overflow-hidden rounded-xl bg-accent-500 px-6 text-[15px] font-semibold tracking-tight text-ink shadow-[0_10px_26px_-12px_rgba(226,173,78,0.9)] transition-shadow duration-300 hover:shadow-[0_18px_40px_-12px_rgba(226,173,78,1)]"
      >
        {/* Brillo diagonal continuo: llama la atención sin requerir el cursor */}
        <span
          aria-hidden
          className="pointer-events-none absolute inset-y-0 left-0 w-1/3 -skew-x-12 bg-white/40 animate-cta-shine"
        />
        {/* Resplandor circular que sigue al cursor */}
        <span
          aria-hidden
          className="pointer-events-none absolute inset-0 opacity-0 transition-opacity duration-300 group-hover:opacity-100"
          style={{
            background:
              "radial-gradient(90px circle at var(--x, 50%) var(--y, 50%), rgba(255,255,255,0.55), transparent 70%)",
          }}
        />
        <span className="relative flex items-center gap-2">
          <Banknote className="h-4 w-4 transition-transform duration-300 group-hover:-translate-y-0.5 group-hover:rotate-6" />
          ¿Vendes? Publícalo fácil
        </span>
      </Link>
    </div>
  );
}
