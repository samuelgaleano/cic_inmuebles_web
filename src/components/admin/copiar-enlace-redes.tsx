"use client";

import { useState } from "react";
import { Check, Link2 } from "lucide-react";
import { enlaceParaRed, REDES, ETIQUETA_RED, type Red } from "@/lib/utils/enlace-redes";

/**
 * «Copiar enlace para Instagram / TikTok / Facebook»: copia la URL de la ficha con utm_source=<red>,
 * utm_medium=social y utm_campaign=<slug>, para saber de qué red llegó cada lead.
 */
export function CopiarEnlaceRedes({ slug }: { slug: string }) {
  const [copiado, setCopiado] = useState<Red | null>(null);
  const [fallo, setFallo] = useState<string | null>(null);

  async function copiar(red: Red) {
    const url = enlaceParaRed(slug, red);
    try {
      await navigator.clipboard.writeText(url);
      setFallo(null);
      setCopiado(red);
      window.setTimeout(() => setCopiado((r) => (r === red ? null : r)), 2000);
    } catch {
      // Sin permiso de portapapeles (http, navegador viejo): se muestra para copiarlo a mano.
      setFallo(url);
    }
  }

  return (
    <div className="flex flex-col items-start gap-1">
      <div className="flex flex-wrap gap-1" role="group" aria-label="Copiar enlace para redes">
        {REDES.map((red) => (
          <button
            key={red}
            type="button"
            onClick={() => copiar(red)}
            className="inline-flex min-h-11 items-center gap-1 rounded-lg border border-line bg-white px-2.5 text-xs font-semibold text-ink-soft transition-colors hover:border-ink hover:text-ink sm:min-h-9"
            aria-label={`Copiar enlace para ${ETIQUETA_RED[red]}`}
          >
            {copiado === red ? <Check className="h-3.5 w-3.5 text-brand-600" aria-hidden /> : <Link2 className="h-3.5 w-3.5" aria-hidden />}
            {copiado === red ? "Copiado" : ETIQUETA_RED[red]}
          </button>
        ))}
      </div>
      <span className="sr-only" aria-live="polite">
        {copiado ? `Enlace para ${ETIQUETA_RED[copiado]} copiado` : ""}
      </span>
      {fallo && <input readOnly value={fallo} onFocus={(e) => e.currentTarget.select()} className="w-64 rounded border border-line px-2 py-1 text-[11px] text-ink-soft" aria-label="Enlace para copiar" />}
    </div>
  );
}
