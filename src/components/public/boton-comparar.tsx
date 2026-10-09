"use client";

import { useEffect, useState } from "react";
import { Check, Plus } from "lucide-react";
import { MAX_COMPARAR, useComparar } from "@/lib/cliente/almacenes";
import { cn } from "@/lib/utils/cn";

/** Añade o quita un inmueble de la comparación (hasta 3). */
export function BotonComparar({
  id,
  titulo,
  className,
}: {
  id: string;
  titulo: string;
  className?: string;
}) {
  const { tiene, alternar } = useComparar();
  const [aviso, setAviso] = useState(false);
  const activo = tiene(id);

  useEffect(() => {
    if (!aviso) return;
    const t = setTimeout(() => setAviso(false), 2600);
    return () => clearTimeout(t);
  }, [aviso]);

  const onClick = (e: React.MouseEvent) => {
    e.preventDefault();
    e.stopPropagation();
    if (alternar(id) === "lleno") setAviso(true);
  };

  return (
    <span className={cn("relative z-10 inline-flex", className)}>
      <button
        type="button"
        onClick={onClick}
        aria-pressed={activo}
        aria-label={activo ? `Quitar «${titulo}» de la comparación` : `Comparar «${titulo}»`}
        className={cn(
          "inline-flex h-8 items-center gap-1.5 rounded-full border px-3 text-[13px] font-medium transition-colors duration-200",
          activo
            ? "border-brand-700 bg-brand-700 text-white hover:bg-brand-800"
            : "border-line-strong bg-white text-ink hover:border-ink",
        )}
      >
        {activo ? <Check className="h-3.5 w-3.5" aria-hidden /> : <Plus className="h-3.5 w-3.5" aria-hidden />}
        Comparar
      </button>
      <span role="status" className="sr-only">
        {aviso ? `Solo puedes comparar ${MAX_COMPARAR} inmuebles a la vez.` : ""}
      </span>
      {aviso && (
        <span aria-hidden className="anim-chip absolute bottom-full left-0 mb-2 whitespace-nowrap rounded-lg bg-ink px-3 py-1.5 text-xs text-white">
          Máximo {MAX_COMPARAR} a la vez. Quita uno para añadir otro.
        </span>
      )}
    </span>
  );
}
