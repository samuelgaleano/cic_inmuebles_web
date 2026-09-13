import { describe, expect, it } from "vitest";
import { signWompiEvent, wompiEventFixture } from "./test-fixtures";
import { pick, verifyChecksum } from "./verify";

const SECRET = "prod_events_OcHnIzeBl5socpwByQ4hA52Em3USQ93Z";

describe("verifyChecksum (formato oficial de eventos de Wompi)", () => {
  it("acepta el evento de ejemplo de la documentación firmado con el secreto", () => {
    expect(verifyChecksum(signWompiEvent(wompiEventFixture(), SECRET), SECRET)).toBe(true);
  });

  it("acepta el checksum en mayúsculas (Wompi lo publica así)", () => {
    const payload = signWompiEvent(wompiEventFixture(), SECRET);
    const sig = payload.signature as { checksum: string };
    sig.checksum = sig.checksum.toUpperCase();
    expect(verifyChecksum(payload, SECRET)).toBe(true);
  });

  it("rechaza si el secreto es otro", () => {
    expect(verifyChecksum(signWompiEvent(wompiEventFixture(), "otro_secreto"), SECRET)).toBe(false);
  });

  it("rechaza si cambió un campo firmado (monto)", () => {
    const payload = signWompiEvent(wompiEventFixture(), SECRET);
    (payload.data as { transaction: { amount_in_cents: number } }).transaction.amount_in_cents = 1;
    expect(verifyChecksum(payload, SECRET)).toBe(false);
  });

  it("sigue las properties del evento aunque cambien (Wompi avisa que varían)", () => {
    const payload = wompiEventFixture();
    (payload.signature as { properties: string[] }).properties = ["transaction.id", "transaction.reference"];
    expect(verifyChecksum(signWompiEvent(payload, SECRET), SECRET)).toBe(true);
  });

  it("rechaza sin signature o sin checksum", () => {
    const payload = wompiEventFixture();
    delete payload.signature;
    expect(verifyChecksum(payload, SECRET)).toBe(false);
  });

  it("no depende de la antigüedad del timestamp (los reintentos de Wompi lo conservan)", () => {
    const payload = wompiEventFixture();
    payload.timestamp = 1530291411; // 2018
    expect(verifyChecksum(signWompiEvent(payload, SECRET), SECRET)).toBe(true);
  });
});

describe("pick", () => {
  it("lee rutas anidadas y devuelve undefined si no existen", () => {
    expect(pick({ a: { b: 1 } }, "a.b")).toBe(1);
    expect(pick({ a: { b: 1 } }, "a.c")).toBeUndefined();
    expect(pick(null, "a")).toBeUndefined();
  });
});
