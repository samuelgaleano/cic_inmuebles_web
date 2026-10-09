"use client";

import { useEffect, useId, useState } from "react";
import { ArrowRight, Search, X } from "lucide-react";
import { cn } from "@/lib/utils/cn";

export interface ChipVista {
  id: string;
  etiqueta: string;
  /** "texto" viene de la frase; "filtro" de la hoja de filtros. */
  origen: "texto" | "filtro";
  onQuitar: () => void;
}

const BASE = "Describe lo que buscas…";

/**
 * Marcador que "escribe" búsquedas reales del inventario. Sin movimiento
 * (prefers-reduced-motion) o mientras hay texto, queda el marcador fijo.
 */
function usePlaceholder(frases: string[], activo: boolean): string {
  const [escrito, setEscrito] = useState("");
  const clave = frases.join("|");

  useEffect(() => {
    if (!activo || !clave) return;
    if (window.matchMedia("(prefers-reduced-motion: reduce)").matches) return;
    const lista = clave.split("|");
    let i = 0;
    let n = 0;
    let borrando = false;
    let t: ReturnType<typeof setTimeout>;

    const paso = () => {
      const f = lista[i];
      if (!borrando) {
        n++;
        setEscrito(f.slice(0, n));
        if (n >= f.length) {
          borrando = true;
          t = setTimeout(paso, 2100);
        } else {
          t = setTimeout(paso, 38 + (n % 5) * 9);
        }
      } else {
        n = Math.max(0, n - 2);
        setEscrito(f.slice(0, n));
        if (n === 0) {
          borrando = false;
          i = (i + 1) % lista.length;
          t = setTimeout(paso, 420);
        } else {
          t = setTimeout(paso, 16);
        }
      }
    };
    t = setTimeout(paso, 700);
    return () => clearTimeout(t);
  }, [clave, activo]);

  return activo && escrito ? escrito : BASE;
}

/**
 * Campo de búsqueda por frase. Es "tonto" a propósito: recibe el texto y lo
 * entendido (chips) y avisa de los cambios; quien lo usa decide qué hacer con
 * los resultados (vista previa en la home, rejilla en el catálogo).
 */
export function Buscador({
  valor,
  onCambiar,
  onEnviar,
  chips,
  total,
  sugerencias,
  grande = false,
  autoFocus,
}: {
  valor: string;
  onCambiar: (texto: string) => void;
  onEnviar?: () => void;
  chips: ChipVista[];
  /** Cuántos inmuebles cumplen lo pedido (se anuncia a lectores de pantalla). */
  total?: number;
  sugerencias: string[];
  grande?: boolean;
  autoFocus?: boolean;
}) {
  const id = useId();
  const [enfocado, setEnfocado] = useState(false);
  const placeholder = usePlaceholder(sugerencias, !valor && !enfocado);

  return (
    <form
      role="search"
      onSubmit={(e) => {
        e.preventDefault();
        onEnviar?.();
      }}
    >
      <label htmlFor={`${id}-q`} className="sr-only">
        Describe el inmueble que buscas: zona, alcobas, presupuesto
      </label>
      <div
        className={cn(
          "flex items-center gap-3 rounded-full border border-field bg-white pl-5 pr-1.5 shadow-float transition-[border-color,box-shadow] duration-200 focus-within:border-brand-600 focus-within:ring-4 focus-within:ring-brand-600/15",
          grande ? "h-16 sm:h-[4.5rem]" : "h-14",
        )}
      >
        <Search className="h-5 w-5 shrink-0 text-muted" aria-hidden />
        <input
          id={`${id}-q`}
          type="text"
          inputMode="search"
          enterKeyHint="search"
          autoComplete="off"
          autoCapitalize="off"
          spellCheck={false}
          autoFocus={autoFocus}
          value={valor}
          maxLength={200}
          onChange={(e) => onCambiar(e.target.value)}
          onFocus={() => setEnfocado(true)}
          onBlur={() => setEnfocado(false)}
          placeholder={placeholder}
          aria-describedby={`${id}-estado`}
          className={cn(
            "min-w-0 flex-1 bg-transparent tracking-[-0.01em] text-ink outline-none placeholder:text-muted/80",
            grande ? "text-[1.0625rem] sm:text-[1.25rem]" : "text-[1.0625rem]",
          )}
        />
        {valor && (
          <button
            type="button"
            onClick={() => onCambiar("")}
            aria-label="Borrar búsqueda"
            className="flex h-9 w-9 shrink-0 items-center justify-center rounded-full text-muted transition-colors hover:bg-ink/[0.06] hover:text-ink"
          >
            <X className="h-4 w-4" aria-hidden />
          </button>
        )}
        <button
          type="submit"
          aria-label="Buscar"
          className={cn(
            "flex shrink-0 items-center justify-center rounded-full bg-ink text-white transition-transform duration-200 hover:scale-105 active:scale-95",
            grande ? "h-12 w-12 sm:h-[3.25rem] sm:w-[3.25rem]" : "h-11 w-11",
          )}
        >
          <ArrowRight className="h-5 w-5" aria-hidden />
        </button>
      </div>

      <div id={`${id}-estado`} aria-live="polite" className="mt-4 min-h-8">
        {chips.length > 0 ? (
          <ul className="flex flex-wrap items-center gap-2">
            <li className="mr-1 text-[13px] text-muted">Entendí</li>
            {chips.map((c) => (
              <li key={c.id} className="anim-chip">
                <span
                  className={cn(
                    "inline-flex h-8 items-center gap-1 rounded-full pl-3.5 pr-1 text-[14px] font-medium",
                    c.origen === "texto" ? "bg-brand-50 text-brand-900" : "bg-ink/[0.06] text-ink",
                  )}
                >
                  {c.etiqueta}
                  <button
                    type="button"
                    onClick={c.onQuitar}
                    aria-label={`Quitar «${c.etiqueta}»`}
                    className="flex h-6 w-6 items-center justify-center rounded-full text-current/70 transition-colors hover:bg-black/10 hover:text-current"
                  >
                    <X className="h-3.5 w-3.5" aria-hidden />
                  </button>
                </span>
              </li>
            ))}
            {total != null && (
              <li className="ml-auto text-[14px] text-muted">
                <span key={total} className="anim-cifra tnum font-semibold text-ink">{total}</span>{" "}
                {total === 1 ? "inmueble" : "inmuebles"}
              </li>
            )}
          </ul>
        ) : (
          <p className="sr-only">Escribe una frase y los filtros se arman solos.</p>
        )}
      </div>
    </form>
  );
}

/** Sugerencias hechas con datos reales del inventario. */
export function Sugerencias({ frases, onElegir }: { frases: string[]; onElegir: (f: string) => void }) {
  if (frases.length === 0) return null;
  return (
    <div className="flex flex-wrap items-center gap-2">
      <span className="mr-1 text-[13px] text-muted">Prueba con</span>
      {frases.map((f) => (
        <button
          key={f}
          type="button"
          onClick={() => onElegir(f)}
          className="h-8 rounded-full border border-line-strong bg-white px-3.5 text-[14px] text-ink transition-colors hover:border-ink"
        >
          {f}
        </button>
      ))}
    </div>
  );
}
