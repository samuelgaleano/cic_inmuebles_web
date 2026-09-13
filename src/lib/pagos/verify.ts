import crypto from "crypto";

export type WompiEvent = Record<string, unknown>;

/** Lee un valor anidado ("transaction.amount_in_cents") desde el payload. */
export function pick(obj: unknown, path: string): unknown {
  return path.split(".").reduce<unknown>((acc, key) => {
    if (acc && typeof acc === "object") return (acc as Record<string, unknown>)[key];
    return undefined;
  }, obj);
}

/**
 * Verifica el checksum oficial de Wompi:
 *   sha256( valores de signature.properties (en orden) + timestamp + eventsSecret )
 * Las properties se leen del propio evento porque Wompi avisa que pueden variar.
 * No se rechaza por antigüedad del timestamp: los reintentos de Wompi (30 min,
 * 3 h, 24 h) conservan el timestamp original; el anti-replay lo da la
 * restricción UNIQUE de pagos_eventos.
 */
export function verifyChecksum(payload: WompiEvent, eventsSecret: string): boolean {
  const signature = payload.signature as { properties?: string[]; checksum?: string } | undefined;
  const props = signature?.properties;
  const checksum = signature?.checksum;
  if (!Array.isArray(props) || !checksum) return false;

  const concatenated = props.map((p) => String(pick(payload.data, p) ?? "")).join("");
  const computed = crypto
    .createHash("sha256")
    .update(`${concatenated}${payload.timestamp ?? ""}${eventsSecret}`)
    .digest("hex");

  const a = Buffer.from(computed, "utf8");
  const b = Buffer.from(String(checksum).toLowerCase(), "utf8");
  return a.length === b.length && crypto.timingSafeEqual(a, b);
}
