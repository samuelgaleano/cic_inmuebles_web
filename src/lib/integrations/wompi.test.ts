import { describe, expect, it, beforeEach } from "vitest";
import crypto from "crypto";
import { buildReference, integritySignature, planIdFromReference } from "./wompi";
import { PAYABLE_PLANS, getPlan, wompiAmountInCents } from "@/lib/config/plans";

describe("montos de Wompi (dinero real)", () => {
  it("convierte pesos a centavos multiplicando por 100", () => {
    // $10.000 COP -> 1.000.000 centavos (NO 10.000, que cobraría 100x menos)
    const alianza = getPlan("alianza-90")!;
    expect(alianza.precioCOP).toBe(10000);
    expect(wompiAmountInCents(alianza)).toBe(1_000_000);
  });

  it("mantiene el valor correcto en el plan anual con decimales de miles", () => {
    const anual = getPlan("anual-10")!;
    expect(anual.precioCOP).toBe(399900);
    expect(wompiAmountInCents(anual)).toBe(39_990_000);
  });

  it("todos los planes pagables dan un entero de centavos", () => {
    for (const plan of PAYABLE_PLANS) {
      const cents = wompiAmountInCents(plan);
      expect(Number.isInteger(cents)).toBe(true);
      expect(cents).toBe(plan.precioCOP * 100);
    }
  });
});

describe("firma de integridad de Wompi", () => {
  beforeEach(() => {
    process.env.WOMPI_INTEGRITY_SECRET = "test_integrity_secret";
  });

  it("es sha256(reference + amount + currency + secret)", () => {
    const reference = "CIC-alianza-90-123456-1700000000000";
    const amount = 1_000_000;
    const esperado = crypto
      .createHash("sha256")
      .update(`${reference}${amount}COPtest_integrity_secret`)
      .digest("hex");
    expect(integritySignature(reference, amount, "COP")).toBe(esperado);
  });

  it("cambia si cambia el monto (no se puede manipular el precio)", () => {
    const ref = "CIC-alianza-90-1-2";
    expect(integritySignature(ref, 1_000_000)).not.toBe(integritySignature(ref, 100));
  });
});

describe("referencia de transacción", () => {
  it("incluye el planId para poder rastrearlo en el webhook", () => {
    const ref = buildReference("paquete-5");
    expect(ref.startsWith("CIC-paquete-5-")).toBe(true);
  });

  it("recupera planId con guiones desde la referencia", () => {
    // Defecto corregido: split('-')[1] daría solo "alianza"; debe dar "alianza-90".
    expect(planIdFromReference(buildReference("alianza-90"))).toBe("alianza-90");
    expect(planIdFromReference(buildReference("anual-10"))).toBe("anual-10");
    expect(planIdFromReference(buildReference("contenido-profesional"))).toBe("contenido-profesional");
  });

  it("devuelve undefined para referencias ajenas", () => {
    expect(planIdFromReference("XCT-123-456")).toBeUndefined();
  });
});
