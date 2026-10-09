"use client";

import { useState } from "react";
import { Heart } from "lucide-react";
import { useFavoritos } from "@/lib/cliente/almacenes";
import { cn } from "@/lib/utils/cn";

/**
 * Corazón de favoritos. `foto` es el círculo blanco que flota sobre una imagen;
 * `plano` es un botón de texto para la ficha. Al guardar, el corazón late una vez.
 */
export function BotonFavorito({
  id,
  titulo,
  variante = "foto",
  className,
}: {
  id: string;
  titulo: string;
  variante?: "foto" | "plano";
  className?: string;
}) {
  const { tiene, alternar } = useFavoritos();
  const [late, setLate] = useState(false);
  const activo = tiene(id);

  const onClick = (e: React.MouseEvent) => {
    e.preventDefault();
    e.stopPropagation();
    if (alternar(id) === "agregado") setLate(true);
  };

  const corazon = (
    <Heart
      aria-hidden
      onAnimationEnd={() => setLate(false)}
      className={cn("h-[18px] w-[18px] transition-colors", activo ? "fill-brand-600 text-brand-600" : "text-ink", late && "anim-latido")}
    />
  );

  if (variante === "plano") {
    return (
      <button
        type="button"
        onClick={onClick}
        aria-pressed={activo}
        className={cn(
          "inline-flex h-11 items-center gap-2 rounded-full px-4 text-[15px] font-medium text-ink transition-colors hover:bg-ink/[0.06]",
          className,
        )}
      >
        {corazon}
        {activo ? "Guardado en favoritos" : "Guardar en favoritos"}
      </button>
    );
  }

  return (
    <button
      type="button"
      onClick={onClick}
      aria-pressed={activo}
      aria-label={activo ? `Quitar «${titulo}» de favoritos` : `Guardar «${titulo}» en favoritos`}
      className={cn(
        "relative z-10 flex h-9 w-9 items-center justify-center rounded-full bg-white/95 transition-transform duration-200 hover:scale-105 active:scale-95",
        className,
      )}
    >
      {corazon}
    </button>
  );
}
