"use client";

/**
 * Listas del visitante guardadas en su navegador (sin cuentas): favoritos y
 * comparador. Un solo objeto por lista para toda la app; se crean la primera
 * vez que el navegador las pide (en el servidor nunca se instancian).
 */
import { useSyncExternalStore } from "react";
import { crearListaLocal, type AlmacenSimple, type ListaLocal } from "./lista-local";

export const MAX_FAVORITOS = 30;
export const MAX_COMPARAR = 3;

function almacenNavegador(): AlmacenSimple | undefined {
  try {
    return typeof window !== "undefined" ? window.localStorage : undefined;
  } catch {
    return undefined; // acceso bloqueado (modo privado, políticas del navegador)
  }
}

let favoritos: ListaLocal | undefined;
let comparar: ListaLocal | undefined;

const listaFavoritos = () => (favoritos ??= crearListaLocal("cic:favoritos", MAX_FAVORITOS, almacenNavegador()));
const listaComparar = () => (comparar ??= crearListaLocal("cic:comparar", MAX_COMPARAR, almacenNavegador()));

const VACIA: readonly string[] = Object.freeze([]);

// Funciones estables (a nivel de módulo): useSyncExternalStore no se re-suscribe en cada render.
const suscribirFavoritos = (fn: () => void) => listaFavoritos().suscribir(fn);
const leerFavoritos = () => listaFavoritos().leer();
const suscribirComparar = (fn: () => void) => listaComparar().suscribir(fn);
const leerComparar = () => listaComparar().leer();
const servidor = () => VACIA;

export function useFavoritos() {
  const ids = useSyncExternalStore(suscribirFavoritos, leerFavoritos, servidor);
  return {
    ids,
    tiene: (id: string) => ids.includes(id),
    alternar: (id: string) => listaFavoritos().alternar(id),
    quitar: (id: string) => listaFavoritos().quitar(id),
    vaciar: () => listaFavoritos().vaciar(),
    /** Reemplaza los favoritos por una selección compartida (se recorta al máximo). */
    reemplazar: (nuevos: string[]) => {
      const l = listaFavoritos();
      l.vaciar();
      for (const id of nuevos.slice(0, MAX_FAVORITOS)) l.alternar(id);
    },
  };
}

export function useComparar() {
  const ids = useSyncExternalStore(suscribirComparar, leerComparar, servidor);
  return {
    ids,
    tiene: (id: string) => ids.includes(id),
    alternar: (id: string) => listaComparar().alternar(id),
    quitar: (id: string) => listaComparar().quitar(id),
    vaciar: () => listaComparar().vaciar(),
    /** Reemplaza la comparación por la de un enlace compartido (se recorta al máximo). */
    reemplazar: (nuevos: string[]) => {
      const l = listaComparar();
      l.vaciar();
      for (const id of nuevos.slice(0, MAX_COMPARAR)) l.alternar(id);
    },
  };
}
