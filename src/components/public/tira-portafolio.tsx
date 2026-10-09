"use client";

import { useCallback, useEffect, useRef, useState } from "react";
import { ChevronLeft, ChevronRight } from "lucide-react";
import { cn } from "@/lib/utils/cn";
import { TarjetaInmueble, type DatosTarjeta } from "./tarjeta-inmueble";

/**
 * El portafolio como una tira horizontal con ajuste por tarjeta (scroll-snap).
 * En navegadores con scroll-driven animations cada foto se desliza dentro de su
 * marco al pasar; sin ellas la tira funciona igual, solo que quieta.
 */
export function TiraPortafolio({
  titulo,
  descripcion,
  items,
}: {
  titulo: string;
  descripcion?: string;
  items: DatosTarjeta[];
}) {
  const lista = useRef<HTMLUListElement>(null);
  const [borde, setBorde] = useState({ inicio: true, fin: false });

  const medir = useCallback(() => {
    const el = lista.current;
    if (!el) return;
    setBorde({ inicio: el.scrollLeft < 8, fin: el.scrollLeft + el.clientWidth >= el.scrollWidth - 8 });
  }, []);

  useEffect(() => {
    medir();
    window.addEventListener("resize", medir);
    return () => window.removeEventListener("resize", medir);
  }, [medir]);

  const mover = (dir: 1 | -1) => {
    const el = lista.current;
    if (!el) return;
    el.scrollBy({ left: dir * Math.max(280, el.clientWidth * 0.72), behavior: "smooth" });
  };

  const boton = (dir: 1 | -1, desactivado: boolean) => (
    <button
      type="button"
      onClick={() => mover(dir)}
      disabled={desactivado}
      aria-label={dir === 1 ? "Ver más inmuebles" : "Ver los anteriores"}
      className={cn(
        "flex h-11 w-11 items-center justify-center rounded-full bg-ink/[0.06] text-ink transition-[background-color,opacity] duration-200 hover:bg-ink/[0.12]",
        "disabled:cursor-default disabled:opacity-35 disabled:hover:bg-ink/[0.06]",
      )}
    >
      {dir === 1 ? <ChevronRight className="h-5 w-5" aria-hidden /> : <ChevronLeft className="h-5 w-5" aria-hidden />}
    </button>
  );

  return (
    <div>
      <div className="wrap flex items-end justify-between gap-6">
        <div>
          <h2 id="portafolio" className="t-headline">{titulo}</h2>
          {descripcion && <p className="mt-3 text-[1.0625rem] text-muted sm:text-[1.1875rem]">{descripcion}</p>}
        </div>
        <div className="hidden shrink-0 gap-2 sm:flex">
          {boton(-1, borde.inicio)}
          {boton(1, borde.fin)}
        </div>
      </div>

      <ul
        ref={lista}
        onScroll={medir}
        tabIndex={0}
        aria-labelledby="portafolio"
        className="pad-tira mt-10 flex snap-x snap-mandatory gap-5 overflow-x-auto pb-6 [scrollbar-width:none] [&::-webkit-scrollbar]:hidden"
      >
        {items.map((p, i) => (
          <li key={p.slug} className="w-[72vw] max-w-[21.5rem] shrink-0 snap-start sm:w-[21.5rem]">
            <TarjetaInmueble datos={p} proporcion="4/5" parallax comparar={false} prioridad={i < 2} />
          </li>
        ))}
      </ul>
    </div>
  );
}
