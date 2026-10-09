"use client";

import { useId, useState } from "react";
import { calcularCuota, LIMITES, VALORES_EJEMPLO } from "@/lib/ficha/cuota";
import { formatPrice } from "@/lib/utils/format";

function Control({
  etiqueta,
  valor,
  salida,
  min,
  max,
  paso,
  onCambiar,
}: {
  etiqueta: string;
  valor: number;
  salida: string;
  min: number;
  max: number;
  paso: number;
  onCambiar: (n: number) => void;
}) {
  const id = useId();
  return (
    <div>
      <div className="flex items-baseline justify-between gap-4">
        <label htmlFor={id} className="text-[14px] font-medium">{etiqueta}</label>
        <output htmlFor={id} className="tnum text-[15px] font-semibold">{salida}</output>
      </div>
      <input
        id={id}
        type="range"
        min={min}
        max={max}
        step={paso}
        value={valor}
        onChange={(e) => onCambiar(Number(e.target.value))}
        style={{ "--p": `${((valor - min) / (max - min)) * 100}%` } as React.CSSProperties}
        className="rango mt-3 w-full"
      />
    </div>
  );
}

/**
 * Cuota mensual estimada. Es ilustrativa y lo dice: la tasa de partida es un
 * ejemplo editable (no una oferta ni un dato de mercado) y lo que financia
 * cada entidad lo define el banco.
 */
export function SimuladorCuota({ precio }: { precio: number }) {
  const [inicialPct, setInicialPct] = useState<number>(VALORES_EJEMPLO.inicialPct);
  const [plazoAnios, setPlazoAnios] = useState<number>(VALORES_EJEMPLO.plazoAnios);
  const [tasaEA, setTasaEA] = useState<number>(VALORES_EJEMPLO.tasaEA);
  const tasaId = useId();

  const r = calcularCuota({ precio, inicialPct, plazoAnios, tasaEA });

  return (
    <section aria-labelledby="cuota-titulo">
      <h2 id="cuota-titulo" className="t-title">Cuota mensual estimada</h2>
      <p className="mt-2 max-w-xl text-muted">
        Mueve los controles para ver cómo cambia la cuota. Es una simulación orientativa, no una oferta de crédito.
      </p>

      <div className="mt-8 grid gap-10 rounded-[var(--radius-card)] bg-surface p-6 sm:p-8 md:grid-cols-[1fr_1.1fr]">
        <div>
          <p className="text-[14px] text-muted">Pagarías cada mes</p>
          <p aria-live="polite" className="tnum mt-1 text-[2.5rem] font-semibold leading-none tracking-[-0.03em] sm:text-[3rem]">
            {formatPrice(r.cuota)}
          </p>
          <dl className="mt-6 space-y-2 text-[15px]">
            <div className="flex justify-between gap-4 border-t border-line-strong/60 pt-2">
              <dt className="text-muted">Cuota inicial</dt>
              <dd className="tnum font-medium">{formatPrice(r.inicial)}</dd>
            </div>
            <div className="flex justify-between gap-4 border-t border-line-strong/60 pt-2">
              <dt className="text-muted">Valor a financiar</dt>
              <dd className="tnum font-medium">{formatPrice(r.prestamo)}</dd>
            </div>
            <div className="flex justify-between gap-4 border-t border-line-strong/60 pt-2">
              <dt className="text-muted">Intereses en {plazoAnios} años</dt>
              <dd className="tnum font-medium">{formatPrice(r.totalIntereses)}</dd>
            </div>
          </dl>
        </div>

        <div className="space-y-6">
          <Control
            etiqueta="Cuota inicial"
            valor={inicialPct}
            salida={`${inicialPct} %`}
            min={LIMITES.inicialPct.min}
            max={LIMITES.inicialPct.max}
            paso={5}
            onCambiar={setInicialPct}
          />
          <Control
            etiqueta="Plazo"
            valor={plazoAnios}
            salida={`${plazoAnios} años`}
            min={LIMITES.plazoAnios.min}
            max={LIMITES.plazoAnios.max}
            paso={1}
            onCambiar={setPlazoAnios}
          />
          <div>
            <label htmlFor={tasaId} className="text-[14px] font-medium">Tasa efectiva anual (de ejemplo)</label>
            <div className="mt-2 flex items-center gap-3">
              <input
                id={tasaId}
                type="number"
                inputMode="decimal"
                min={LIMITES.tasaEA.min}
                max={LIMITES.tasaEA.max}
                step={0.25}
                value={tasaEA}
                onChange={(e) => setTasaEA(Number(e.target.value))}
                className="tnum h-12 w-28 rounded-[var(--radius-field)] border border-field bg-white px-4 text-base focus:border-brand-700 focus:outline-none focus:ring-4 focus:ring-brand-700/15"
              />
              <span className="text-[15px] text-muted">% E.A.</span>
            </div>
          </div>
        </div>
      </div>

      <p className="mt-4 max-w-2xl text-[13px] leading-relaxed text-muted">
        La tasa es un valor de ejemplo que puedes cambiar; la real, el porcentaje que financia cada entidad y los costos
        adicionales (seguros, avalúo, notariado) los define el banco. Consulta con tu entidad antes de decidir.
      </p>
    </section>
  );
}
