"use client";

import { useEffect, useMemo, useState } from "react";
import Link from "next/link";
import { ArrowRight, MessageCircle } from "lucide-react";
import { buttonVariants } from "@/components/ui/button";
import { siteConfig, whatsappLink } from "@/lib/config/site";
import { chipsManuales } from "@/lib/search/etiquetas";
import type { ItemIndice } from "@/lib/search/indice";
import { quitarSpans, type Chip, type ContextoBusqueda } from "@/lib/search/interpretar";
import { buscar, ESTADO_VACIO, type EstadoBusqueda, type Manual } from "@/lib/search/motor";
import { aQuery, leerParams } from "@/lib/search/url";
import { Buscador, Sugerencias, type ChipVista } from "./buscador";
import { HojaFiltros } from "./hoja-filtros";
import { LeadForm } from "./lead-form";
import { TarjetaInmueble } from "./tarjeta-inmueble";

/** Un chip de la frase queda sin efecto cuando el visitante fijó ese mismo campo a mano. */
const CAMPOS_DEL_CHIP: Record<Chip["tipo"], (keyof Manual)[]> = {
  tipo: ["tipo"],
  precio: ["precioMin", "precioMax"],
  habitaciones: ["habitacionesMin"],
  banos: ["banosMin"],
  parqueaderos: ["parqueaderosMin"],
  area: ["areaMin", "areaMax"],
  sector: ["sectores"],
  ciudad: ["ciudad"],
  termino: [],
};

export function Catalogo({
  indice,
  ctx,
  sugerencias,
}: {
  indice: ItemIndice[];
  ctx: ContextoBusqueda;
  sugerencias: string[];
}) {
  // La página es estática: el servidor siempre entrega el catálogo completo y el navegador aplica los
  // filtros que traiga la URL (enlaces compartidos ?q=…) justo después de hidratar.
  const [estado, setEstado] = useState<EstadoBusqueda>(ESTADO_VACIO);
  const [hidratado, setHidratado] = useState(false);
  const busqueda = useMemo(() => buscar(indice, estado, ctx), [indice, estado, ctx]);

  useEffect(() => {
    const desdeUrl = leerParams(new URLSearchParams(window.location.search));
    // eslint-disable-next-line react-hooks/set-state-in-effect -- leer la URL solo es posible en el navegador
    if (aQuery(desdeUrl)) setEstado(desdeUrl);
    setHidratado(true);
  }, []);

  // La URL refleja la búsqueda (enlace compartible) sin pasar por el servidor.
  useEffect(() => {
    // Antes de leer la URL inicial no se escribe: se borrarían los filtros del enlace recibido.
    if (!hidratado) return;
    const t = setTimeout(() => {
      const deseada = aQuery(estado);
      const actual = aQuery(leerParams(new URLSearchParams(window.location.search)));
      if (deseada !== actual) window.history.replaceState(null, "", `/inmuebles${deseada}`);
    }, 350);
    return () => clearTimeout(t);
  }, [estado, hidratado]);

  const chips: ChipVista[] = [
    ...busqueda.interpretacion.chips
      .filter((c) => !CAMPOS_DEL_CHIP[c.tipo].some((k) => estado.manual[k] !== undefined))
      .map((c) => ({
        id: c.id,
        etiqueta: c.etiqueta,
        origen: "texto" as const,
        onQuitar: () => setEstado((e) => ({ ...e, texto: quitarSpans(e.texto, c.spans) })),
      })),
    ...chipsManuales(estado.manual).map((c) => ({
      id: c.id,
      etiqueta: c.etiqueta,
      origen: "filtro" as const,
      onQuitar: () => setEstado((e) => ({ ...e, manual: c.quitar(e.manual) })),
    })),
  ];

  const { resultados, relajaciones } = busqueda;
  const loQueBusca = estado.texto.trim() || chips.map((c) => c.etiqueta).join(", ") || "un inmueble";
  const hayCriterios = chips.length > 0;
  const total = indice.length;

  return (
    <div className="wrap">
      <div className="max-w-3xl">
        <Buscador
          grande
          valor={estado.texto}
          onCambiar={(texto) => setEstado((e) => ({ ...e, texto }))}
          chips={chips}
          sugerencias={sugerencias}
        />
        {!hayCriterios && !estado.texto && <Sugerencias frases={sugerencias} onElegir={(f) => setEstado((e) => ({ ...e, texto: f }))} />}
      </div>

      <div className="mt-8 flex items-center justify-between gap-4 border-b border-line pb-4">
        <p aria-live="polite" className="text-[15px] text-muted">
          <span key={resultados.length} className="anim-cifra tnum font-semibold text-ink">{resultados.length}</span>
          {hayCriterios ? <> de <span className="tnum">{total}</span></> : null}{" "}
          {resultados.length === 1 && !hayCriterios ? "inmueble" : "inmuebles"}
        </p>
        <HojaFiltros
          indice={indice}
          ctx={ctx}
          estado={estado}
          cantidadActivos={chipsManuales(estado.manual).length}
          onAplicar={(manual, orden) => setEstado((e) => ({ ...e, manual, orden }))}
        />
      </div>

      {resultados.length > 0 ? (
        <>
        <h2 className="sr-only">Inmuebles</h2>
        <ul className="mt-10 grid gap-x-6 gap-y-14 sm:grid-cols-2 lg:grid-cols-3">
          {resultados.map(({ item, razones }, i) => (
            <li key={item.slug} className="anim-sube" style={{ "--d": `${Math.min(i, 8) * 45}ms` } as React.CSSProperties}>
              <TarjetaInmueble datos={item} razones={razones} prioridad={i < 3} />
            </li>
          ))}
        </ul>
        {/* Enlace cruzado al embudo de vendedores: quien mira el catálogo a veces también tiene uno para vender. */}
        <p className="mt-16 text-center text-[15px] text-muted">
          ¿Tienes un inmueble para vender?{" "}
          <Link href="/vender" className="font-medium text-ink underline underline-offset-4 hover:text-brand-700">
            Lo publicamos sin costo inicial
          </Link>
        </p>
        </>
      ) : (
        <div className="mx-auto mt-16 max-w-xl text-center">
          <h2 className="t-title">Ningún inmueble cumple todo eso a la vez.</h2>
          {relajaciones.length > 0 ? (
            <>
              <p className="mt-3 text-muted">Esto es lo que más se acerca, con lo que hay publicado hoy:</p>
              <ul className="mt-6 divide-y divide-line overflow-hidden rounded-[var(--radius-card)] border border-line text-left">
                {relajaciones.map((r) => (
                  <li key={r.etiqueta}>
                    <button
                      type="button"
                      onClick={() => setEstado((e) => ({ ...ESTADO_VACIO, orden: e.orden, manual: { ...r.filtros, estado: e.manual.estado } }))}
                      className="group flex w-full items-center justify-between gap-4 px-5 py-4 text-left transition-colors hover:bg-surface"
                    >
                      <span className="text-[15px] font-medium">{r.etiqueta}</span>
                      <span className="flex shrink-0 items-center gap-2 text-[14px] text-muted">
                        <span className="tnum">{r.total} {r.total === 1 ? "inmueble" : "inmuebles"}</span>
                        <ArrowRight className="h-4 w-4 transition-transform duration-200 group-hover:translate-x-0.5" aria-hidden />
                      </span>
                    </button>
                  </li>
                ))}
              </ul>
            </>
          ) : (
            <p className="mt-3 text-muted">El portafolio es corto y cambia seguido. Déjanos lo que buscas y te escribimos cuando llegue.</p>
          )}
          {/* Quien no encontró lo que busca es el lead más valioso del catálogo: tres salidas, de más a menos directa. */}
          <a
            href={whatsappLink(`Hola ${siteConfig.name}, busco un inmueble: «${loQueBusca}». ¿Me avisan cuando llegue algo así?`)}
            target="_blank"
            rel="noopener noreferrer"
            className={buttonVariants({ variant: "primary", size: "lg", className: "mt-8" })}
          >
            <MessageCircle className="h-5 w-5" aria-hidden /> Avísenme cuando llegue uno
          </a>
          <details className="mx-auto mt-6 max-w-md text-left">
            <summary className="cursor-pointer text-center text-[15px] font-medium text-ink-soft underline underline-offset-4 hover:text-brand-700">
              Prefiero dejar mis datos
            </summary>
            <LeadForm
              tipo="comprador"
              intencion="alerta"
              mensajeInicial={`Avísenme si llega: ${loQueBusca}`}
              submitLabel="Avísenme"
              className="mt-5"
            />
          </details>
          <button
            type="button"
            onClick={() => setEstado(ESTADO_VACIO)}
            className="mt-6 text-[15px] font-medium text-ink-soft underline underline-offset-4 hover:text-brand-700"
          >
            Ver los {indice.length} inmuebles publicados
          </button>
        </div>
      )}
    </div>
  );
}
