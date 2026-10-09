"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import { ArrowRight, X } from "lucide-react";
import { useComparar } from "@/lib/cliente/almacenes";

/**
 * Bandeja flotante: aparece al elegir el primer inmueble para comparar y lleva
 * a /comparar con la selección en la URL (enlace compartible).
 */
export function BandejaComparar() {
  const { ids, vaciar } = useComparar();
  const pathname = usePathname();
  // En la propia página de comparar la bandeja sobra: ahí ya está todo a la vista.
  if (ids.length === 0 || pathname.startsWith("/comparar")) return null;

  const listo = ids.length >= 2;

  return (
    <div
      role="region"
      aria-label="Comparación de inmuebles"
      className="anim-bandeja fixed bottom-5 left-1/2 z-40 flex max-w-[calc(100vw-6.5rem)] items-center gap-1 rounded-full bg-ink py-1.5 pl-5 pr-1.5 text-white shadow-float sm:max-w-none"
    >
      <p className="mr-2 truncate text-sm">
        <span className="tnum font-semibold">{ids.length}</span>{" "}
        <span className="text-white/70">{listo ? "para comparar" : "elegido · añade otro"}</span>
      </p>
      <button
        type="button"
        onClick={vaciar}
        aria-label="Vaciar la comparación"
        className="flex h-9 w-9 items-center justify-center rounded-full text-white/70 transition-colors hover:bg-white/10 hover:text-white"
      >
        <X className="h-4 w-4" aria-hidden />
      </button>
      {listo ? (
        <Link
          href={`/comparar?s=${ids.join(",")}`}
          className="inline-flex h-10 items-center gap-1.5 rounded-full bg-white px-4 text-sm font-medium text-ink transition-colors hover:bg-brand-50"
        >
          Comparar <ArrowRight className="h-4 w-4" aria-hidden />
        </Link>
      ) : (
        <span className="inline-flex h-10 items-center rounded-full bg-white/10 px-4 text-sm text-white/60">Comparar</span>
      )}
    </div>
  );
}
