import { afterEach, describe, expect, it, beforeEach, vi } from "vitest";
import crypto from "crypto";
import {
  buildReference,
  fetchTransaction,
  fetchTransactionsByReference,
  integritySignature,
  isWompiConfigured,
  planIdFromReference,
  wompiApiBase,
  wompiEnvironment,
} from "./wompi";
import {
  PAYABLE_PLANS,
  amountMatchesPlan,
  getPlan,
  wompiAmountInCents,
} from "@/lib/config/plans";

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

describe("el webhook verifica que el monto pagado corresponda al plan", () => {
  // El monto ya viaja firmado con el secreto de integridad, así que una
  // discrepancia no debería ocurrir nunca. Si ocurre, hay que verla.
  it("acepta el monto exacto del plan", () => {
    const plan = getPlan("alianza-90")!;
    expect(amountMatchesPlan(plan, 1_000_000)).toBe(true);
  });

  it("rechaza un monto 100 veces menor (el error clásico de centavos)", () => {
    const plan = getPlan("alianza-90")!;
    expect(amountMatchesPlan(plan, 10_000)).toBe(false);
  });

  it("rechaza cualquier monto distinto, por poco que sea", () => {
    const plan = getPlan("anual-10")!;
    const correcto = wompiAmountInCents(plan);
    expect(amountMatchesPlan(plan, correcto)).toBe(true);
    expect(amountMatchesPlan(plan, correcto - 1)).toBe(false);
    expect(amountMatchesPlan(plan, correcto + 1)).toBe(false);
  });

  it("rechaza el monto de OTRO plan (no se paga el barato y se reclama el caro)", () => {
    const caro = getPlan("anual-10")!;
    const barato = getPlan("alianza-90")!;
    expect(amountMatchesPlan(caro, wompiAmountInCents(barato))).toBe(false);
  });

  it("no afirma nada si Wompi no reporta monto", () => {
    const plan = getPlan("alianza-90")!;
    expect(amountMatchesPlan(plan, undefined)).toBe(true);
  });
});

describe("ambiente de Wompi (las 4 llaves deben ser del mismo)", () => {
  const KEYS = ["WOMPI_PUBLIC_KEY", "WOMPI_PRIVATE_KEY", "WOMPI_INTEGRITY_SECRET", "WOMPI_EVENTS_SECRET"];
  beforeEach(() => KEYS.forEach((k) => delete process.env[k]));

  it("produccion cuando todas son prod", () => {
    process.env.WOMPI_PUBLIC_KEY = "pub_prod_a";
    process.env.WOMPI_PRIVATE_KEY = "prv_prod_b";
    process.env.WOMPI_INTEGRITY_SECRET = "prod_integrity_c";
    process.env.WOMPI_EVENTS_SECRET = "prod_events_d";
    expect(wompiEnvironment()).toBe("prod");
    expect(wompiApiBase()).toBe("https://production.wompi.co/v1");
    expect(isWompiConfigured()).toBe(true);
  });

  it("sandbox cuando todas son test", () => {
    process.env.WOMPI_PUBLIC_KEY = "pub_test_a";
    process.env.WOMPI_PRIVATE_KEY = "prv_test_b";
    process.env.WOMPI_INTEGRITY_SECRET = "test_integrity_c";
    process.env.WOMPI_EVENTS_SECRET = "test_events_d";
    expect(wompiEnvironment()).toBe("test");
    expect(wompiApiBase()).toBe("https://sandbox.wompi.co/v1");
  });

  it("mezcla de ambientes -> no configurado (antes apuntaba en silencio al ambiente equivocado)", () => {
    process.env.WOMPI_PUBLIC_KEY = "pub_prod_a";
    process.env.WOMPI_PRIVATE_KEY = "prv_prod_b";
    process.env.WOMPI_INTEGRITY_SECRET = "test_integrity_c";
    process.env.WOMPI_EVENTS_SECRET = "prod_events_d";
    expect(wompiEnvironment()).toBe("mixto");
    expect(isWompiConfigured()).toBe(false);
  });

  it("sin llave privada o sin secreto de eventos la pasarela no se activa", () => {
    process.env.WOMPI_PUBLIC_KEY = "pub_prod_a";
    process.env.WOMPI_INTEGRITY_SECRET = "prod_integrity_c";
    process.env.WOMPI_EVENTS_SECRET = "prod_events_d";
    expect(isWompiConfigured()).toBe(false);
    process.env.WOMPI_PRIVATE_KEY = "prv_prod_b";
    delete process.env.WOMPI_EVENTS_SECRET;
    expect(isWompiConfigured()).toBe(false);
  });
});

describe("fetchTransactionsByReference", () => {
  const fetchMock = vi.fn();
  beforeEach(() => {
    vi.stubGlobal("fetch", fetchMock);
    fetchMock.mockReset();
    process.env.WOMPI_PUBLIC_KEY = "pub_prod_a";
    process.env.WOMPI_PRIVATE_KEY = "prv_prod_b";
    process.env.WOMPI_INTEGRITY_SECRET = "prod_integrity_c";
    process.env.WOMPI_EVENTS_SECRET = "prod_events_d";
  });
  afterEach(() => vi.unstubAllGlobals());

  it("consulta /transactions?reference= con la llave privada y mapea la lista", async () => {
    fetchMock.mockResolvedValue({
      ok: true,
      json: async () => ({ data: [{ id: "t1", status: "DECLINED", reference: "CIC-x-1-2" }, { id: "t2", status: "APPROVED", reference: "CIC-x-1-2", amount_in_cents: 5 }, { reference: "sin id" }] }),
    });
    const list = await fetchTransactionsByReference("CIC-x-1-2");
    expect(fetchMock.mock.calls[0][0]).toBe("https://production.wompi.co/v1/transactions?reference=CIC-x-1-2");
    expect(list?.map((t) => t.id)).toEqual(["t1", "t2"]);
  });

  it("[] cuando no hay transacciones y null cuando la API falla", async () => {
    fetchMock.mockResolvedValue({ ok: true, json: async () => ({ data: [] }) });
    expect(await fetchTransactionsByReference("CIC-x-1-2")).toEqual([]);
    fetchMock.mockResolvedValue({ ok: false, status: 500, json: async () => ({}) });
    expect(await fetchTransactionsByReference("CIC-x-1-2")).toBeNull();
    expect(await fetchTransactionsByReference("")).toBeNull();
  });

  it("las llamadas a la API llevan timeout", async () => {
    fetchMock.mockResolvedValue({ ok: true, json: async () => ({ data: { id: "1234-1610641025-49201", status: "APPROVED" } }) });
    await fetchTransaction("1234-1610641025-49201");
    expect(fetchMock.mock.calls[0][1].signal).toBeInstanceOf(AbortSignal);
  });

  it("fetchTransaction rechaza ids con forma inválida sin llamar a la red", async () => {
    expect(await fetchTransaction("../otra/ruta")).toBeNull();
    expect(fetchMock).not.toHaveBeenCalled();
  });
});

describe("fetchTransaction (la API de Wompi es la fuente de verdad)", () => {
  const fetchMock = vi.fn();
  beforeEach(() => {
    vi.stubGlobal("fetch", fetchMock);
    fetchMock.mockReset();
    process.env.WOMPI_PUBLIC_KEY = "pub_prod_a";
    process.env.WOMPI_PRIVATE_KEY = "prv_prod_b";
    process.env.WOMPI_INTEGRITY_SECRET = "prod_integrity_c";
    process.env.WOMPI_EVENTS_SECRET = "prod_events_d";
  });
  afterEach(() => vi.unstubAllGlobals());

  it("devuelve status, reference, monto y correo desde data", async () => {
    const ID = "1292-1602113476-10985";
    fetchMock.mockResolvedValue({
      ok: true,
      json: async () => ({
        data: { id: ID, status: "APPROVED", reference: "CIC-alianza-90-1-2", amount_in_cents: 1_000_000, currency: "COP", customer_email: "c@x.co" },
      }),
    });
    const tx = await fetchTransaction(ID);
    expect(tx).toEqual({ id: ID, status: "APPROVED", reference: "CIC-alianza-90-1-2", amountInCents: 1_000_000, currency: "COP", customerEmail: "c@x.co" });
    const [url, init] = fetchMock.mock.calls[0];
    expect(url).toBe(`https://production.wompi.co/v1/transactions/${ID}`);
    expect(init.headers.Authorization).toBe("Bearer prv_prod_b");
  });

  it("devuelve null sin llave privada, con error HTTP o con red caída", async () => {
    const ID = "1292-1602113476-10985";
    delete process.env.WOMPI_PRIVATE_KEY;
    expect(await fetchTransaction(ID)).toBeNull();
    expect(fetchMock).not.toHaveBeenCalled();

    process.env.WOMPI_PRIVATE_KEY = "prv_prod_b";
    fetchMock.mockResolvedValue({ ok: false, status: 404, json: async () => ({}) });
    expect(await fetchTransaction(ID)).toBeNull();

    fetchMock.mockRejectedValue(new Error("boom"));
    expect(await fetchTransaction(ID)).toBeNull();
  });

  it("devuelve null si la respuesta no trae id y status", async () => {
    fetchMock.mockResolvedValue({ ok: true, json: async () => ({ data: { reference: "x" } }) });
    expect(await fetchTransaction("1292-1602113476-10985")).toBeNull();
  });
});
