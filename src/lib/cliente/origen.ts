"use client";

/**
 * Origen de la visita guardado en sessionStorage la primera vez que la sesión ve una página pública.
 * Sin cookies ni terceros: muere al cerrar la pestaña y solo sale del navegador dentro de un formulario
 * que la persona envía (lead o cobro de un plan).
 */
import { useSyncExternalStore } from "react";
import { limpiarOrigen, origenDePrimeraVista, type OrigenVisita } from "@/lib/leads/origen";

const CLAVE = "cic:origen";
const oyentes = new Set<() => void>();

function sesion(): Storage | undefined {
  try {
    return typeof window !== "undefined" ? window.sessionStorage : undefined;
  } catch {
    return undefined; // almacenamiento bloqueado: el lead entra igual, sin origen
  }
}

/** Anota el origen si esta sesión aún no lo tiene. Lo llama <CapturaOrigen /> en cada página pública. */
export function capturarOrigen(): void {
  const s = sesion();
  if (!s) return;
  try {
    if (s.getItem(CLAVE) !== null) return;
    const o = origenDePrimeraVista({
      search: window.location.search,
      referrer: document.referrer,
      pathname: window.location.pathname,
      host: window.location.host,
    });
    s.setItem(CLAVE, JSON.stringify(o));
  } catch {
    return;
  }
  oyentes.forEach((fn) => fn());
}

function leerCrudo(): string {
  try {
    return sesion()?.getItem(CLAVE) ?? "";
  } catch {
    return "";
  }
}

/** El origen guardado, ya validado (vacío si no hay). */
export function leerOrigen(): OrigenVisita {
  const crudo = leerCrudo();
  if (!crudo) return {};
  try {
    return limpiarOrigen(JSON.parse(crudo)) ?? {};
  } catch {
    return {};
  }
}

const suscribir = (fn: () => void) => {
  oyentes.add(fn);
  return () => {
    oyentes.delete(fn);
  };
};

/** El texto guardado (un string: comparable por valor, estable entre renders). En el servidor, vacío. */
export function useOrigenCrudo(): string {
  return useSyncExternalStore(suscribir, leerCrudo, () => "");
}
