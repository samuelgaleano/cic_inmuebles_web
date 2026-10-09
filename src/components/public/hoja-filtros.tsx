"use client";

import { useMemo, useRef, useState } from "react";
import { SlidersHorizontal, X } from "lucide-react";
import { PROPERTY_STATUS_PUBLIC_LABELS, PROPERTY_TYPE_LABELS, type PropertyStatus, type PropertyType } from "@/lib/domain";
import type { ItemIndice } from "@/lib/search/indice";
import type { ContextoBusqueda } from "@/lib/search/interpretar";
import { buscar, ETIQUETA_ORDEN, ORDENES, type EstadoBusqueda, type Manual, type Orden } from "@/lib/search/motor";
import { bloquearScroll } from "@/lib/cliente/scroll";
import { cn } from "@/lib/utils/cn";

const campo =
  "h-12 w-full rounded-[var(--radius-field)] border border-line-strong bg-white px-4 text-base text-ink transition-colors focus:border-brand-600 focus:outline-none focus:ring-4 focus:ring-brand-600/15";

function Grupo({ titulo, children }: { titulo: string; children: React.ReactNode }) {
  return (
    <fieldset className="border-t border-line py-5 first:border-t-0 first:pt-0">
      <legend className="mb-3 text-[15px] font-semibold tracking-[-0.01em]">{titulo}</legend>
      {children}
    </fieldset>
  );
}

function Segmentos<T extends string | number | undefined>({
  valor,
  opciones,
  onCambiar,
}: {
  valor: T;
  opciones: { valor: T; etiqueta: string }[];
  onCambiar: (v: T) => void;
}) {
  return (
    <div className="flex flex-wrap gap-2">
      {opciones.map((o) => (
        <button
          key={String(o.valor ?? "todos")}
          type="button"
          aria-pressed={valor === o.valor}
          onClick={() => onCambiar(o.valor)}
          className={cn(
            "h-10 rounded-full border px-4 text-[14px] font-medium transition-colors duration-200",
            valor === o.valor ? "border-ink bg-ink text-white" : "border-line-strong bg-white text-ink hover:border-ink",
          )}
        >
          {o.etiqueta}
        </button>
      ))}
    </div>
  );
}

const aMillones = (pesos?: number) => (pesos == null ? "" : String(Math.round((pesos / 1e6) * 10) / 10));
const dePesos = (texto: string): number | undefined => {
  const n = Number(texto.replace(",", "."));
  return Number.isFinite(n) && n > 0 ? Math.round(n * 1e6) : undefined;
};
const deNumero = (texto: string): number | undefined => {
  const n = Number(texto);
  return Number.isFinite(n) && n > 0 ? Math.round(n) : undefined;
};

/**
 * Hoja lateral de filtros (en móvil sube desde abajo). El visitante ve en
 * vivo cuántos inmuebles quedan antes de aplicar. Es un <dialog> modal: foco
 * atrapado, Escape cierra y el fondo queda inerte sin código extra.
 */
export function HojaFiltros({
  indice,
  ctx,
  estado,
  onAplicar,
  cantidadActivos,
}: {
  indice: ItemIndice[];
  ctx: ContextoBusqueda;
  estado: EstadoBusqueda;
  onAplicar: (manual: Manual, orden: Orden) => void;
  /** Filtros elegidos a mano ahora mismo (para el contador del botón). */
  cantidadActivos: number;
}) {
  const ref = useRef<HTMLDialogElement>(null);
  const [manual, setManual] = useState<Manual>(estado.manual);
  const [orden, setOrden] = useState<Orden>(estado.orden);

  const abrir = () => {
    setManual(estado.manual);
    setOrden(estado.orden);
    ref.current?.showModal();
    bloquearScroll(true);
  };
  const cerrar = () => {
    ref.current?.close();
    bloquearScroll(false);
  };
  const aplicar = () => {
    onAplicar(manual, orden);
    cerrar();
  };

  const opciones = useMemo(() => {
    const tipos = [...new Set(indice.map((i) => i.tipo))] as PropertyType[];
    const estados = [...new Set(indice.map((i) => i.estado))] as PropertyStatus[];
    const maxHab = Math.min(5, Math.max(0, ...indice.map((i) => i.habitaciones ?? 0)));
    const maxBanos = Math.min(4, Math.max(0, ...indice.map((i) => i.banos ?? 0)));
    const precios = indice.map((i) => i.precio).filter((n) => n > 0);
    return {
      tipos,
      estados,
      maxHab,
      maxBanos,
      precioMin: precios.length ? Math.min(...precios) : undefined,
      precioMax: precios.length ? Math.max(...precios) : undefined,
      conParqueadero: indice.some((i) => (i.parqueaderos ?? 0) > 0),
    };
  }, [indice]);

  // Cuántos quedarían con lo elegido, incluida la frase que ya escribió.
  const cuantos = useMemo(
    () => buscar(indice, { texto: estado.texto, manual, orden }, ctx).resultados.length,
    [indice, ctx, estado.texto, manual, orden],
  );

  const fijar = (parche: Partial<Manual>) =>
    setManual((m) => {
      const siguiente = { ...m, ...parche };
      for (const k of Object.keys(siguiente) as (keyof Manual)[]) if (siguiente[k] === undefined) delete siguiente[k];
      return siguiente;
    });

  const escala = (max: number) => [
    { valor: undefined as number | undefined, etiqueta: "Cualquiera" },
    ...Array.from({ length: max }, (_, i) => ({ valor: i + 1 as number | undefined, etiqueta: `${i + 1}+` })),
  ];

  return (
    <>
      <button
        type="button"
        onClick={abrir}
        className="inline-flex h-11 shrink-0 items-center gap-2 rounded-full border border-line-strong bg-white px-5 text-[15px] font-medium transition-colors hover:border-ink"
      >
        <SlidersHorizontal className="h-4 w-4" aria-hidden />
        Filtros
        {cantidadActivos > 0 && (
          <span className="tnum flex h-5 min-w-5 items-center justify-center rounded-full bg-ink px-1.5 text-[11px] font-semibold text-white">
            {cantidadActivos}
          </span>
        )}
      </button>

      <dialog
        ref={ref}
        aria-label="Filtros"
        onClick={(e) => e.target === e.currentTarget && cerrar()}
        onClose={() => bloquearScroll(false)}
        className="hoja h-dvh w-screen items-end open:flex sm:items-stretch sm:justify-end"
      >
        <div className="flex h-[88dvh] w-full flex-col rounded-t-[1.75rem] bg-white sm:h-dvh sm:max-w-[28rem] sm:rounded-none sm:rounded-l-[1.75rem]">
          <div className="flex items-center justify-between px-6 pb-2 pt-5">
            <h2 className="text-[1.375rem] font-semibold tracking-[-0.02em]">Filtros</h2>
            <button
              type="button"
              onClick={cerrar}
              aria-label="Cerrar filtros"
              className="flex h-10 w-10 items-center justify-center rounded-full transition-colors hover:bg-ink/[0.06]"
            >
              <X className="h-5 w-5" aria-hidden />
            </button>
          </div>

          <div className="flex-1 overflow-y-auto px-6 pb-6 pt-3">
            {ctx.sectores.length > 1 && (
              <Grupo titulo="Sector">
                <div className="flex flex-wrap gap-2">
                  {ctx.sectores.map((s) => {
                    const activo = manual.sectores?.includes(s) ?? false;
                    return (
                      <button
                        key={s}
                        type="button"
                        aria-pressed={activo}
                        onClick={() => {
                          const actuales = manual.sectores ?? [];
                          const siguientes = activo ? actuales.filter((x) => x !== s) : [...actuales, s];
                          fijar({ sectores: siguientes.length ? siguientes : undefined });
                        }}
                        className={cn(
                          "h-10 rounded-full border px-4 text-[14px] font-medium transition-colors duration-200",
                          activo ? "border-ink bg-ink text-white" : "border-line-strong bg-white text-ink hover:border-ink",
                        )}
                      >
                        {s}
                      </button>
                    );
                  })}
                </div>
              </Grupo>
            )}

            {opciones.tipos.length > 1 && (
              <Grupo titulo="Tipo de inmueble">
                <Segmentos
                  valor={manual.tipo}
                  opciones={[{ valor: undefined, etiqueta: "Todos" }, ...opciones.tipos.map((t) => ({ valor: t as PropertyType | undefined, etiqueta: PROPERTY_TYPE_LABELS[t] }))]}
                  onCambiar={(v) => fijar({ tipo: v })}
                />
              </Grupo>
            )}

            {ctx.ciudades.length > 1 && (
              <Grupo titulo="Ciudad">
                <Segmentos
                  valor={manual.ciudad}
                  opciones={[{ valor: undefined, etiqueta: "Todas" }, ...ctx.ciudades.map((c) => ({ valor: c as string | undefined, etiqueta: c }))]}
                  onCambiar={(v) => fijar({ ciudad: v })}
                />
              </Grupo>
            )}

            {opciones.maxHab > 0 && (
              <Grupo titulo="Habitaciones">
                <Segmentos valor={manual.habitacionesMin} opciones={escala(opciones.maxHab)} onCambiar={(v) => fijar({ habitacionesMin: v })} />
              </Grupo>
            )}

            {opciones.maxBanos > 0 && (
              <Grupo titulo="Baños">
                <Segmentos valor={manual.banosMin} opciones={escala(opciones.maxBanos)} onCambiar={(v) => fijar({ banosMin: v })} />
              </Grupo>
            )}

            {opciones.conParqueadero && (
              <Grupo titulo="Parqueadero">
                <Segmentos
                  valor={manual.parqueaderosMin}
                  opciones={[
                    { valor: undefined as number | undefined, etiqueta: "Cualquiera" },
                    { valor: 1 as number | undefined, etiqueta: "Con parqueadero" },
                    { valor: 2 as number | undefined, etiqueta: "2 o más" },
                  ]}
                  onCambiar={(v) => fijar({ parqueaderosMin: v })}
                />
              </Grupo>
            )}

            <Grupo titulo="Precio (millones de pesos)">
              <div className="grid grid-cols-2 gap-3">
                <label className="block">
                  <span className="mb-1.5 block text-[13px] text-muted">Desde</span>
                  <input
                    type="number"
                    inputMode="decimal"
                    min={0}
                    step={10}
                    placeholder={opciones.precioMin ? aMillones(opciones.precioMin) : "0"}
                    value={aMillones(manual.precioMin)}
                    onChange={(e) => fijar({ precioMin: dePesos(e.target.value) })}
                    className={cn(campo, "tnum")}
                  />
                </label>
                <label className="block">
                  <span className="mb-1.5 block text-[13px] text-muted">Hasta</span>
                  <input
                    type="number"
                    inputMode="decimal"
                    min={0}
                    step={10}
                    placeholder={opciones.precioMax ? aMillones(opciones.precioMax) : "0"}
                    value={aMillones(manual.precioMax)}
                    onChange={(e) => fijar({ precioMax: dePesos(e.target.value) })}
                    className={cn(campo, "tnum")}
                  />
                </label>
              </div>
            </Grupo>

            <Grupo titulo="Área (m²)">
              <div className="grid grid-cols-2 gap-3">
                <label className="block">
                  <span className="mb-1.5 block text-[13px] text-muted">Desde</span>
                  <input
                    type="number"
                    inputMode="numeric"
                    min={0}
                    value={manual.areaMin ?? ""}
                    onChange={(e) => fijar({ areaMin: deNumero(e.target.value) })}
                    className={cn(campo, "tnum")}
                  />
                </label>
                <label className="block">
                  <span className="mb-1.5 block text-[13px] text-muted">Hasta</span>
                  <input
                    type="number"
                    inputMode="numeric"
                    min={0}
                    value={manual.areaMax ?? ""}
                    onChange={(e) => fijar({ areaMax: deNumero(e.target.value) })}
                    className={cn(campo, "tnum")}
                  />
                </label>
              </div>
            </Grupo>

            {opciones.estados.length > 1 && (
              <Grupo titulo="Disponibilidad">
                <Segmentos
                  valor={manual.estado}
                  opciones={[{ valor: undefined, etiqueta: "Todos" }, ...opciones.estados.map((s) => ({ valor: s as PropertyStatus | undefined, etiqueta: PROPERTY_STATUS_PUBLIC_LABELS[s] }))]}
                  onCambiar={(v) => fijar({ estado: v })}
                />
              </Grupo>
            )}

            <Grupo titulo="Ordenar por">
              <select
                value={orden}
                onChange={(e) => setOrden(e.target.value as Orden)}
                className={campo}
                aria-label="Ordenar por"
              >
                {ORDENES.map((o) => (
                  <option key={o} value={o}>{ETIQUETA_ORDEN[o]}</option>
                ))}
              </select>
            </Grupo>
          </div>

          <div className="flex items-center gap-3 border-t border-line px-6 py-4">
            <button
              type="button"
              onClick={() => {
                setManual({});
                setOrden("relevancia");
              }}
              className="h-12 rounded-full px-5 text-[15px] font-medium text-ink transition-colors hover:bg-ink/[0.06]"
            >
              Limpiar
            </button>
            <button
              type="button"
              onClick={aplicar}
              className="h-12 flex-1 rounded-full bg-brand-700 px-6 text-[15px] font-medium text-white transition-colors hover:bg-brand-800 active:scale-[0.98]"
            >
              {cuantos === 0 ? "Sin resultados con estos filtros" : <>Ver <span className="tnum">{cuantos}</span> {cuantos === 1 ? "inmueble" : "inmuebles"}</>}
            </button>
          </div>
        </div>
      </dialog>
    </>
  );
}
