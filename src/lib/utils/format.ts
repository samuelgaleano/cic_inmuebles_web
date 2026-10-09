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

/** Versión compacta: 405000000 -> "$405 M" · 1420000000 -> "$1.420 M" · 1250000 -> "$1,3 M". */
export function formatPriceCompact(amount: number): string {
  if (amount >= 1_000_000) {
    const m = amount / 1_000_000;
    const r = Math.abs(m - Math.round(m)) < 0.05 ? Math.round(m) : Math.round(m * 10) / 10;
    const entero = String(Math.trunc(r)).replace(/\B(?=(\d{3})+(?!\d))/g, ".");
    const decimal = r % 1 === 0 ? "" : `,${Math.round((r % 1) * 10)}`;
    return `$${entero}${decimal} M`;
  }
  return copFormatter.format(amount);
}

/** Precio para mostrar: un 0 (dato sin cargar) no se anuncia como "$ 0". */
export function formatPriceOrConsult(amount: number): string {
  return amount > 0 ? formatPrice(amount) : "Consultar precio";
}

/** Formatea un número con separadores de miles. */
export function formatNumber(value: number): string {
  return numberFormatter.format(value);
}

/** Formatea un área en metros cuadrados: 85 -> "85 m²". */
export function formatArea(m2: number): string {
  return `${numberFormatter.format(m2)} m²`;
}
