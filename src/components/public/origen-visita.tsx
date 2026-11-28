"use client";

import { useEffect, useMemo } from "react";
import { capturarOrigen, useOrigenCrudo } from "@/lib/cliente/origen";
import { CAMPOS_ORIGEN, limpiarOrigen, type OrigenVisita } from "@/lib/leads/origen";

/** Anota de dónde llegó la visita en su primera página (no pinta nada). Va en el layout público. */
export function CapturaOrigen() {
  useEffect(() => {
    capturarOrigen();
  }, []);
  return null;
}

/** Campos ocultos con el origen de la visita, para los formularios de leads. */
export function CamposOrigen() {
  const crudo = useOrigenCrudo();
  const origen = useMemo<OrigenVisita>(() => {
    if (!crudo) return {};
    try {
      return limpiarOrigen(JSON.parse(crudo)) ?? {};
    } catch {
      return {};
    }
  }, [crudo]);

  return (
    <>
      {(Object.keys(CAMPOS_ORIGEN) as (keyof OrigenVisita)[]).map((k) =>
        origen[k] ? <input key={k} type="hidden" name={CAMPOS_ORIGEN[k]} value={origen[k]} /> : null,
      )}
    </>
  );
}
