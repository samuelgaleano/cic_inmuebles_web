"use client";

import { useEffect, useState } from "react";
import { Check, Share2 } from "lucide-react";
import { cn } from "@/lib/utils/cn";

/**
 * Compartir: abre la hoja nativa del teléfono (Web Share) y, donde no existe,
 * copia el enlace. Confirma con un cambio de texto, no con un aviso aparte.
 */
export function BotonCompartir({
  url,
  titulo,
  texto,
  className,
}: {
  url: string;
  titulo: string;
  texto?: string;
  className?: string;
}) {
  const [copiado, setCopiado] = useState(false);

  useEffect(() => {
    if (!copiado) return;
    const t = setTimeout(() => setCopiado(false), 2200);
    return () => clearTimeout(t);
  }, [copiado]);

  const compartir = async () => {
    try {
      if (typeof navigator.share === "function") {
        await navigator.share({ title: titulo, text: texto, url });
        return;
      }
      await navigator.clipboard.writeText(url);
      setCopiado(true);
    } catch {
      // El visitante cerró la hoja de compartir o el navegador bloqueó el portapapeles: no hay nada que mostrar.
    }
  };

  return (
    <button
      type="button"
      onClick={compartir}
      className={cn(
        "inline-flex h-11 items-center gap-2 rounded-full px-4 text-[15px] font-medium text-ink transition-colors hover:bg-ink/[0.06]",
        className,
      )}
    >
      {copiado ? <Check className="h-[18px] w-[18px] text-brand-700" aria-hidden /> : <Share2 className="h-[18px] w-[18px]" aria-hidden />}
      <span aria-live="polite">{copiado ? "Enlace copiado" : "Compartir"}</span>
    </button>
  );
}
