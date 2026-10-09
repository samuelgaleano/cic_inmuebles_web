/**
 * Contexto de precio: cuánto cuesta el m² de un inmueble frente al promedio del
 * portafolio de CIC. Es una comparación INTERNA (entre lo que CIC publica), no
 * un avalúo ni una referencia de mercado, y la interfaz lo dice así.
 */

export interface ItemValor {
  id: string;
  precio: number;
  area?: number;
  estado: "disponible" | "en_proceso" | "vendido";
}

export interface ContextoPrecio {
  /** COP por m² de este inmueble. */
  porM2: number;
  /** Promedio de COP por m² de los demás inmuebles comparables. */
  promedio: number;
  /** Diferencia porcentual redondeada (negativa = más barato que el promedio). */
  diferenciaPct: number;
  /** Con cuántos inmuebles se comparó. */
  n: number;
}

/** Mínimo de inmuebles comparables para que el promedio diga algo. */
export const MIN_COMPARABLES = 3;

export function precioPorM2(precio: number, area?: number): number | undefined {
  return area && area > 0 && precio > 0 ? Math.round(precio / area) : undefined;
}

export function contextoDePrecio(item: ItemValor, portafolio: ItemValor[]): ContextoPrecio | undefined {
  const propio = precioPorM2(item.precio, item.area);
  if (propio === undefined) return undefined;

  const otros = portafolio
    .filter((p) => p.id !== item.id && p.estado !== "vendido")
    .map((p) => precioPorM2(p.precio, p.area))
    .filter((v): v is number => v !== undefined);
  if (otros.length < MIN_COMPARABLES) return undefined;

  const promedio = Math.round(otros.reduce((a, b) => a + b, 0) / otros.length);
  return {
    porM2: propio,
    promedio,
    diferenciaPct: Math.round(((propio - promedio) / promedio) * 100),
    n: otros.length,
  };
}

/** "12 % por debajo del promedio…" / "en línea con…" / "8 % por encima…" */
export function fraseContexto(c: ContextoPrecio): string {
  const base = `de los ${c.n} inmuebles comparables del portafolio de CIC`;
  if (Math.abs(c.diferenciaPct) < 3) return `En línea con el promedio ${base}.`;
  const sentido = c.diferenciaPct < 0 ? "por debajo" : "por encima";
  return `${Math.abs(c.diferenciaPct)} % ${sentido} del promedio ${base}.`;
}
