"use client";

import { useRef } from "react";
import { estadoPropuestaAction } from "@/lib/actions/admin-crm";
import { ESTADOS_PROPUESTA, ESTADO_PROPUESTA_LABELS, type EstadoPropuesta } from "@/lib/crm/tipos";

/** Cambia el estado de un inmueble propuesto a un comprador (propuesto, visitó, ofertó, descartado) al elegirlo. */
export function PropuestaEstadoForm({
  busquedaId,
  propertyId,
  contactoId,
  estado,
}: {
  busquedaId: string;
  propertyId: string;
  contactoId: string;
  estado: EstadoPropuesta;
}) {
  const ref = useRef<HTMLFormElement>(null);
  return (
    <form action={estadoPropuestaAction} ref={ref}>
      <input type="hidden" name="busquedaId" value={busquedaId} />
      <input type="hidden" name="propertyId" value={propertyId} />
      <input type="hidden" name="contactoId" value={contactoId} />
      <select
        name="estado"
        defaultValue={estado}
        aria-label="Estado de la propuesta"
        onChange={() => ref.current?.requestSubmit()}
        className="h-8 rounded-lg border border-line bg-surface px-2 text-xs font-semibold text-ink-soft focus:border-brand-500 focus:bg-white focus:outline-none focus:ring-2 focus:ring-brand-200"
      >
        {ESTADOS_PROPUESTA.map((s) => (
          <option key={s} value={s}>
            {ESTADO_PROPUESTA_LABELS[s]}
          </option>
        ))}
      </select>
    </form>
  );
}
