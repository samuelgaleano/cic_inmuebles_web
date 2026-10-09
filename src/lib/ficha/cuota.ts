/**
 * Simulador de cuota de crédito hipotecario: cuota fija mensual en pesos,
 * tasa efectiva anual, sistema francés. Es una ESTIMACIÓN ILUSTRATIVA: no
 * incluye seguros, avalúo, notariado ni la tasa real que otorgue un banco.
 * La tasa por defecto es un ejemplo editable, no una oferta ni un dato de mercado.
 */

export const LIMITES = {
  inicialPct: { min: 20, max: 90 },
  plazoAnios: { min: 5, max: 30 },
  tasaEA: { min: 0, max: 40 },
} as const;

/** Valores iniciales del simulador (ilustrativos; el usuario los ajusta). */
export const VALORES_EJEMPLO = { inicialPct: 30, plazoAnios: 15, tasaEA: 12 } as const;

export interface EntradaCuota {
  precio: number;
  inicialPct: number;
  plazoAnios: number;
  tasaEA: number;
}

export interface ResultadoCuota {
  inicialPct: number;
  plazoAnios: number;
  tasaEA: number;
  inicial: number;
  prestamo: number;
  cuota: number;
  totalPagado: number;
  totalIntereses: number;
}

const limitar = (v: number, { min, max }: { min: number; max: number }) =>
  Math.min(max, Math.max(min, Number.isFinite(v) ? v : min));

export function calcularCuota(e: EntradaCuota): ResultadoCuota {
  const inicialPct = limitar(e.inicialPct, LIMITES.inicialPct);
  const plazoAnios = limitar(e.plazoAnios, LIMITES.plazoAnios);
  const tasaEA = limitar(e.tasaEA, LIMITES.tasaEA);

  if (!Number.isFinite(e.precio) || e.precio <= 0) {
    return { inicialPct, plazoAnios, tasaEA, inicial: 0, prestamo: 0, cuota: 0, totalPagado: 0, totalIntereses: 0 };
  }

  const inicial = Math.round((e.precio * inicialPct) / 100);
  const prestamo = e.precio - inicial;
  const meses = Math.round(plazoAnios * 12);
  const i = Math.pow(1 + tasaEA / 100, 1 / 12) - 1; // tasa mensual equivalente a la efectiva anual

  const cuota =
    i === 0 ? Math.round(prestamo / meses) : Math.round((prestamo * i) / (1 - Math.pow(1 + i, -meses)));
  const totalPagado = cuota * meses;
  const totalIntereses = i === 0 ? 0 : Math.max(0, totalPagado - prestamo);

  return { inicialPct, plazoAnios, tasaEA, inicial, prestamo, cuota, totalPagado, totalIntereses };
}
