import crypto from "crypto";
import { siteConfig } from "@/lib/config/site";

/**
 * Integración con Wompi. La clave de integridad, la de eventos y la privada son
 * SECRETAS y solo se usan en el servidor; la pública puede llegar al cliente.
 *
 * Variables de entorno:
 *   WOMPI_PUBLIC_KEY       — clave pública (pub_prod_… / pub_test_…)
 *   WOMPI_PRIVATE_KEY      — llave privada (consulta de transacciones)
 *   WOMPI_INTEGRITY_SECRET — secreto de integridad (firma del widget)
 *   WOMPI_EVENTS_SECRET    — secreto de eventos (validación del webhook)
 */

export function wompiConfig() {
  return {
    publicKey: process.env.WOMPI_PUBLIC_KEY ?? "",
    privateKey: process.env.WOMPI_PRIVATE_KEY ?? "",
    integritySecret: process.env.WOMPI_INTEGRITY_SECRET ?? "",
    eventsSecret: process.env.WOMPI_EVENTS_SECRET ?? "",
  };
}

export type WompiEnvironment = "prod" | "test" | "mixto" | "ninguno";

/**
 * Ambiente que declaran las llaves. Todas las definidas deben coincidir: una
 * mezcla apuntaba antes en silencio al ambiente equivocado.
 */
export function wompiEnvironment(): WompiEnvironment {
  const keys = Object.values(wompiConfig()).filter(Boolean);
  if (keys.length === 0) return "ninguno";
  const envs = new Set(keys.map((k) => (k.includes("_test_") || k.startsWith("test_") ? "test" : "prod")));
  if (envs.size > 1) return "mixto";
  return envs.has("test") ? "test" : "prod";
}

export function wompiApiBase(): string {
  return wompiEnvironment() === "test" ? "https://sandbox.wompi.co/v1" : "https://production.wompi.co/v1";
}

export interface WompiTransaction {
  id: string;
  status: string;
  reference: string;
  amountInCents: number | undefined;
  currency: string | undefined;
  customerEmail: string | null;
}

/** Los ids de Wompi tienen la forma "1292-1602113476-10985". */
export const WOMPI_TX_ID = /^[A-Za-z0-9-]{8,80}$/;

const API_TIMEOUT_MS = 8_000;

type ApiTransaction = {
  id?: string;
  status?: string;
  reference?: string;
  amount_in_cents?: number;
  currency?: string;
  customer_email?: string | null;
};

function toTransaction(d: ApiTransaction | undefined): WompiTransaction | null {
  if (!d?.id || !d.status) return null;
  return {
    id: d.id,
    status: d.status,
    reference: d.reference ?? "",
    amountInCents: typeof d.amount_in_cents === "number" ? d.amount_in_cents : undefined,
    currency: d.currency,
    customerEmail: d.customer_email ?? null,
  };
}

async function apiGet<T>(path: string): Promise<T | null> {
  const { privateKey } = wompiConfig();
  if (!privateKey) return null;
  try {
    const res = await fetch(`${wompiApiBase()}${path}`, {
      headers: { Authorization: `Bearer ${privateKey}` },
      cache: "no-store",
      signal: AbortSignal.timeout(API_TIMEOUT_MS),
    });
    if (!res.ok) return null;
    return (await res.json()) as T;
  } catch {
    return null;
  }
}

/**
 * Consulta la transacción a la API de Wompi con la llave privada. Es la fuente
 * de verdad: el checksum del webhook cubre id, status y monto, pero NO la
 * referencia ni el correo, así que esos campos nunca se toman del payload.
 * Devuelve null si no se pudo consultar; el llamador decide qué hacer.
 */
export async function fetchTransaction(transactionId: string): Promise<WompiTransaction | null> {
  if (!WOMPI_TX_ID.test(transactionId)) return null;
  const json = await apiGet<{ data?: ApiTransaction }>(`/transactions/${encodeURIComponent(transactionId)}`);
  return toTransaction(json?.data);
}

/**
 * Transacciones de una referencia (una referencia puede tener varios intentos
 * de pago). Permite descubrir pagos que no llegaron ni por webhook ni por el
 * retorno del widget. null si la API no respondió; [] si no hay ninguna.
 */
export async function fetchTransactionsByReference(reference: string): Promise<WompiTransaction[] | null> {
  if (!reference) return null;
  const json = await apiGet<{ data?: ApiTransaction[] }>(`/transactions?reference=${encodeURIComponent(reference)}`);
  if (!json) return null;
  return (json.data ?? []).map(toTransaction).filter((t): t is WompiTransaction => t !== null);
}

/**
 * La pasarela solo se activa con las cuatro llaves: sin la privada no se
 * puede confirmar ningún pago y sin la de eventos el webhook no valida nada.
 */
export function isWompiConfigured(): boolean {
  const { publicKey, privateKey, integritySecret, eventsSecret } = wompiConfig();
  if (!publicKey || !privateKey || !integritySecret || !eventsSecret) return false;
  if (wompiEnvironment() === "mixto") {
    console.error("[pago] llaves de Wompi de ambientes distintos: pasarela desactivada");
    return false;
  }
  return true;
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
