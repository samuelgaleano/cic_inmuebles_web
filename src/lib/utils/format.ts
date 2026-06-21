/** Utilidades de formato pensadas para Colombia (es-CO, COP). */

const copFormatter = new Intl.NumberFormat("es-CO", {
  style: "currency",
  currency: "COP",
  maximumFractionDigits: 0,
});

const numberFormatter = new Intl.NumberFormat("es-CO");

/** Formatea un precio en pesos colombianos: 350000000 -> "$ 350.000.000". */
export function formatPrice(amount: number, currency: string = "COP"): string {
  if (currency === "COP") return copFormatter.format(amount);
  return new Intl.NumberFormat("es-CO", {
    style: "currency",
    currency,
    maximumFractionDigits: 0,
  }).format(amount);
}

/** Versión compacta para tarjetas: 350000000 -> "$350 M". */
export function formatPriceCompact(amount: number): string {
  if (amount >= 1_000_000_000) {
    return `$${(amount / 1_000_000_000).toLocaleString("es-CO", { maximumFractionDigits: 1 })} mil M`;
  }
  if (amount >= 1_000_000) {
    return `$${(amount / 1_000_000).toLocaleString("es-CO", { maximumFractionDigits: 0 })} M`;
  }
  return copFormatter.format(amount);
}

/** Formatea un número con separadores de miles. */
export function formatNumber(value: number): string {
  return numberFormatter.format(value);
}

/** Formatea un área en metros cuadrados: 85 -> "85 m²". */
export function formatArea(m2: number): string {
  return `${numberFormatter.format(m2)} m²`;
}
