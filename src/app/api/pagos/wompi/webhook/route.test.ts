import { beforeEach, describe, expect, it, vi } from "vitest";
import { signWompiEvent, wompiEventFixture } from "@/lib/pagos/test-fixtures";

const processTransaction = vi.fn();
vi.mock("@/lib/pagos/process", () => ({ processTransaction: (...args: unknown[]) => processTransaction(...args) }));

const storeConfigured = vi.fn(() => true);
vi.mock("@/lib/pagos/store", () => ({ isPagosStoreConfigured: () => storeConfigured() }));

const { POST } = await import("./route");

const SECRET = "prod_events_secret";

function signed(overrides: Parameters<typeof wompiEventFixture>[0] = {}, secret = SECRET) {
  return signWompiEvent(wompiEventFixture(overrides), secret);
}

function post(body: unknown) {
  return POST(
    new Request("https://www.cicinmuebles.com/api/pagos/wompi/webhook", {
      method: "POST",
      headers: { "content-type": "application/json" },
      body: typeof body === "string" ? body : JSON.stringify(body),
    }),
  );
}

describe("POST /api/pagos/wompi/webhook", () => {
  beforeEach(() => {
    process.env.WOMPI_EVENTS_SECRET = SECRET;
    process.env.WOMPI_PRIVATE_KEY = "prv_prod_x";
    process.env.WOMPI_PUBLIC_KEY = "pub_prod_x";
    process.env.WOMPI_INTEGRITY_SECRET = "prod_integrity_x";
    storeConfigured.mockReturnValue(true);
    processTransaction.mockReset();
    processTransaction.mockResolvedValue({ outcome: "ok", status: "APPROVED" });
  });

  it("503 (falla cerrado) sin secreto de eventos, sin llave privada o sin Supabase", async () => {
    delete process.env.WOMPI_EVENTS_SECRET;
    expect((await post(signed())).status).toBe(503);

    process.env.WOMPI_EVENTS_SECRET = SECRET;
    delete process.env.WOMPI_PRIVATE_KEY;
    expect((await post(signed())).status).toBe(503);

    process.env.WOMPI_PRIVATE_KEY = "prv_prod_x";
    storeConfigured.mockReturnValue(false);
    expect((await post(signed())).status).toBe(503);
    expect(processTransaction).not.toHaveBeenCalled();
  });

  it("400 con JSON inválido", async () => {
    expect((await post("{no json")).status).toBe(400);
  });

  it("401 con checksum inválido", async () => {
    expect((await post(signed({}, "otro"))).status).toBe(401);
    expect(processTransaction).not.toHaveBeenCalled();
  });

  it("acepta un reintento de Wompi con timestamp de hace horas (ya no hay ventana de 600 s)", async () => {
    const payload = signed();
    expect(payload.timestamp).toBe(1530291411);
    const res = await post(payload);
    expect(res.status).toBe(200);
    expect(processTransaction).toHaveBeenCalledWith(
      "1234-1610641025-49201",
      expect.objectContaining({ source: "webhook", eventTimestamp: 1530291411, fallbackStatus: "APPROVED" }),
    );
  });

  it("200 sin procesar para eventos que no son transaction.updated", async () => {
    const payload = signed();
    payload.event = "nequi_token.updated";
    expect((await post(payload)).status).toBe(200);
    expect(processTransaction).not.toHaveBeenCalled();
  });

  it("200 sin procesar si el evento no trae id de transacción", async () => {
    const payload = wompiEventFixture();
    (payload.data as { transaction: { id?: string } }).transaction.id = "";
    expect((await post(signWompiEvent(payload, SECRET))).status).toBe(200);
    expect(processTransaction).not.toHaveBeenCalled();
  });

  it("sin status en el payload igual se procesa (se persiste como DESCONOCIDO si la API no responde)", async () => {
    const payload = wompiEventFixture();
    delete (payload.data as { transaction: { status?: string } }).transaction.status;
    (payload.signature as { properties: string[] }).properties = ["transaction.id"];
    expect((await post(signWompiEvent(payload, SECRET))).status).toBe(200);
    expect(processTransaction).toHaveBeenCalledWith("1234-1610641025-49201", expect.objectContaining({ fallbackStatus: undefined }));
  });

  it("500 si la persistencia falla, para que Wompi reintente", async () => {
    processTransaction.mockResolvedValue({ outcome: "store_error" });
    expect((await post(signed())).status).toBe(500);
  });

  it("200 en dedup, sin_destino, revisar y sin_verificar (el evento quedó registrado)", async () => {
    for (const outcome of ["dedup", "sin_destino", "revisar", "sin_verificar"]) {
      processTransaction.mockResolvedValue({ outcome });
      expect((await post(signed())).status).toBe(200);
    }
  });
});
