import { describe, expect, it, vi } from "vitest";
import { crearListaLocal, type AlmacenSimple } from "./lista-local";

function almacen(inicial?: Record<string, string>): AlmacenSimple & { datos: Record<string, string> } {
  const datos: Record<string, string> = { ...inicial };
  return {
    datos,
    getItem: (k) => datos[k] ?? null,
    setItem: (k, v) => {
      datos[k] = v;
    },
  };
}

describe("crearListaLocal", () => {
  it("alterna elementos y conserva el orden de llegada", () => {
    const l = crearListaLocal("k", 5, almacen());
    l.alternar("a");
    l.alternar("b");
    expect(l.leer()).toEqual(["a", "b"]);
    l.alternar("a");
    expect(l.leer()).toEqual(["b"]);
    expect(l.tiene("b")).toBe(true);
    expect(l.tiene("a")).toBe(false);
  });

  it("respeta el máximo: el elemento nuevo desplaza al más antiguo solo si se pide, si no se rechaza", () => {
    const l = crearListaLocal("k", 2, almacen());
    expect(l.alternar("a")).toBe("agregado");
    expect(l.alternar("b")).toBe("agregado");
    expect(l.alternar("c")).toBe("lleno");
    expect(l.leer()).toEqual(["a", "b"]);
  });

  it("persiste y lee de nuevo desde el almacén", () => {
    const a = almacen();
    crearListaLocal("k", 5, a).alternar("x");
    expect(crearListaLocal("k", 5, a).leer()).toEqual(["x"]);
  });

  it("datos corruptos o ajenos se ignoran sin lanzar", () => {
    expect(crearListaLocal("k", 5, almacen({ k: "{no es json" })).leer()).toEqual([]);
    expect(crearListaLocal("k", 5, almacen({ k: JSON.stringify({ a: 1 }) })).leer()).toEqual([]);
    expect(crearListaLocal("k", 3, almacen({ k: JSON.stringify(["a", 2, null, "b", "a", "c", "d"]) })).leer()).toEqual(["a", "b", "c"]);
  });

  it("sin almacén (modo privado, SSR) funciona en memoria sin lanzar", () => {
    const roto: AlmacenSimple = {
      getItem: () => {
        throw new Error("bloqueado");
      },
      setItem: () => {
        throw new Error("bloqueado");
      },
    };
    const l = crearListaLocal("k", 5, roto);
    l.alternar("a");
    expect(l.leer()).toEqual(["a"]);
  });

  it("avisa a los suscriptores en cada cambio y deja de avisar al desuscribirse", () => {
    const l = crearListaLocal("k", 5, almacen());
    const fn = vi.fn();
    const baja = l.suscribir(fn);
    l.alternar("a");
    l.alternar("b");
    expect(fn).toHaveBeenCalledTimes(2);
    baja();
    l.alternar("c");
    expect(fn).toHaveBeenCalledTimes(2);
  });

  it("la lectura es estable entre cambios (misma referencia) para useSyncExternalStore", () => {
    const l = crearListaLocal("k", 5, almacen());
    l.alternar("a");
    expect(l.leer()).toBe(l.leer());
    const antes = l.leer();
    l.alternar("b");
    expect(l.leer()).not.toBe(antes);
  });

  it("vaciar deja la lista vacía", () => {
    const l = crearListaLocal("k", 5, almacen());
    l.alternar("a");
    l.vaciar();
    expect(l.leer()).toEqual([]);
  });
});
