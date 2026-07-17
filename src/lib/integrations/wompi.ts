import crypto from "crypto";
import { siteConfig } from "@/lib/config/site";

/**
 * Integración con Wompi (misma cuenta que el proyecto XIAOMI, vía variables de
 * entorno). La clave de integridad y la de eventos son SECRETAS y solo se usan
 * en el servidor; la pública puede llegar al cliente.
 *
 * Variables de entorno (agregar en Vercel con los mismos valores de XIAOMI):
 *   WOMPI_PUBLIC_KEY       — clave pública (pub_prod_… / pub_test_…)
 *   WOMPI_INTEGRITY_SECRET — secreto de integridad (firma del widget)
 *   WOMPI_EVENTS_SECRET    — secreto de eventos (validación del webhook)
 */

export function wompiConfig() {
  return {
    publicKey: process.env.WOMPI_PUBLIC_KEY ?? "",
    integritySecret: process.env.WOMPI_INTEGRITY_SECRET ?? "",
    eventsSecret: process.env.WOMPI_EVENTS_SECRET ?? "",
  };
}

export function isWompiConfigured(): boolean {
  const { publicKey, integritySecret } = wompiConfig();
  return Boolean(publicKey && integritySecret);
}

/** URL pública absoluta del sitio para el redirectUrl de la pasarela. */
export function appUrl(): string {
  return (process.env.APP_URL ?? siteConfig.url).replace(/\/+$/, "");
}

/** Referencia única de la transacción, legible en el panel de Wompi. */
export function buildReference(planId: string): string {
  const rand = Math.floor(100000 + Math.random() * 900000);
  return `CIC-${planId}-${rand}-${Date.now()}`;
}

/**
 * Extrae el planId de una referencia `CIC-<planId>-<rand>-<ts>`. El planId
 * puede contener guiones (p. ej. "alianza-90"), así que se descartan el prefijo
 * "CIC" y los dos últimos segmentos (rand y timestamp) y se une el resto.
 */
export function planIdFromReference(reference: string): string | undefined {
  const parts = reference.split("-");
  if (parts.length < 4 || parts[0] !== "CIC") return undefined;
  return parts.slice(1, -2).join("-");
}

/**
 * Firma de integridad del widget de Wompi:
 *   sha256( reference + amountInCents + currency + integritySecret )
 */
export function integritySignature(reference: string, amountInCents: number, currency = "COP"): string {
  const { integritySecret } = wompiConfig();
  return crypto
    .createHash("sha256")
    .update(`${reference}${amountInCents}${currency}${integritySecret}`)
    .digest("hex");
}
