/**
 * Lista de identificadores guardada en el navegador (favoritos, comparador).
 * Pensada para `useSyncExternalStore`: `leer()` devuelve SIEMPRE la misma
 * referencia mientras la lista no cambie, `suscribir` avisa de cambios propios
 * y de otras pestañas, y cualquier fallo del almacenamiento (modo privado,
 * cuota, SSR) degrada a memoria en vez de romper la página.
 */

export interface AlmacenSimple {
  getItem(clave: string): string | null;
  setItem(clave: string, valor: string): void;
}

export type ResultadoAlternar = "agregado" | "quitado" | "lleno";

export interface ListaLocal {
  leer(): readonly string[];
  tiene(id: string): boolean;
  alternar(id: string): ResultadoAlternar;
  quitar(id: string): void;
  vaciar(): void;
  suscribir(fn: () => void): () => void;
}

const VACIA: readonly string[] = Object.freeze([]);

function depurar(valor: unknown, max: number): string[] {
  if (!Array.isArray(valor)) return [];
  const vistos: string[] = [];
  for (const v of valor) {
    if (typeof v === "string" && v && !vistos.includes(v)) vistos.push(v);
    if (vistos.length >= max) break;
  }
  return vistos;
}

export function crearListaLocal(clave: string, max: number, almacen?: AlmacenSimple): ListaLocal {
  const oyentes = new Set<() => void>();
  let actual: readonly string[] | null = null;

  const cargar = (): readonly string[] => {
    try {
      const crudo = almacen?.getItem(clave);
      const lista = crudo ? depurar(JSON.parse(crudo), max) : [];
      return lista.length ? lista : VACIA;
    } catch {
      return VACIA;
    }
  };

  const guardar = (lista: string[]) => {
    actual = lista.length ? lista : VACIA;
    try {
      almacen?.setItem(clave, JSON.stringify(lista));
    } catch {
      // Sin almacenamiento: se queda en memoria durante la sesión.
    }
    oyentes.forEach((fn) => fn());
  };

  const leer = (): readonly string[] => {
    if (actual === null) actual = cargar();
    return actual;
  };

  return {
    leer,
    tiene: (id) => leer().includes(id),
    alternar(id) {
      const lista = [...leer()];
      const i = lista.indexOf(id);
      if (i >= 0) {
        lista.splice(i, 1);
        guardar(lista);
        return "quitado";
      }
      if (lista.length >= max) return "lleno";
      lista.push(id);
      guardar(lista);
      return "agregado";
    },
    quitar(id) {
      if (leer().includes(id)) guardar(leer().filter((x) => x !== id));
    },
    vaciar() {
      guardar([]);
    },
    suscribir(fn) {
      oyentes.add(fn);
      // Cambios hechos en otra pestaña: se recarga desde el almacén.
      const alOtraPestana = (e: StorageEvent) => {
        if (e.key === clave) {
          actual = cargar();
          fn();
        }
      };
      if (typeof window !== "undefined") window.addEventListener("storage", alOtraPestana);
      return () => {
        oyentes.delete(fn);
        if (typeof window !== "undefined") window.removeEventListener("storage", alOtraPestana);
      };
    },
  };
}
