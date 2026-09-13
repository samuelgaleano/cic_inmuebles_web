import crypto from "crypto";
import { pick, type WompiEvent } from "./verify";

/** Evento de ejemplo de docs.wompi.co/docs/colombia/eventos (solo pruebas). */
export function wompiEventFixture(
  overrides: Partial<{ id: string; status: string; reference: string; amountInCents: number; email: string }> = {},
): WompiEvent {
  return {
    event: "transaction.updated",
    data: {
      transaction: {
        id: overrides.id ?? "1234-1610641025-49201",
        amount_in_cents: overrides.amountInCents ?? 4490000,
        reference: overrides.reference ?? "MZQ3X2DE2SMX",
        customer_email: overrides.email ?? "juan.perez@gmail.com",
        currency: "COP",
        payment_method_type: "NEQUI",
        redirect_url: "https://mitienda.com.co/pagos/redireccion",
        status: overrides.status ?? "APPROVED",
        shipping_address: null,
        payment_link_id: null,
        payment_source_id: null,
      },
    },
    environment: "prod",
    signature: {
      properties: ["transaction.id", "transaction.status", "transaction.amount_in_cents"],
      checksum: "",
    },
    timestamp: 1530291411,
    sent_at: "2018-07-20T16:45:05.000Z",
  };
}

/** Firma un evento como lo haría Wompi y devuelve el mismo objeto. */
export function signWompiEvent(payload: WompiEvent, secret: string): WompiEvent {
  const sig = payload.signature as { properties: string[]; checksum: string };
  const concat = sig.properties.map((p) => String(pick(payload.data, p) ?? "")).join("");
  sig.checksum = crypto.createHash("sha256").update(`${concat}${payload.timestamp}${secret}`).digest("hex");
  return payload;
}
