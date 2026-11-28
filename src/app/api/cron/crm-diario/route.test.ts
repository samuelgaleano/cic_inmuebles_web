import { beforeEach, describe, expect, it, vi } from "vitest";
import { MemoryCrmStore } from "@/lib/crm/store";

const { sendEmail, registrarLatido, estado } = vi.hoisted(() => ({
  sendEmail: vi.fn(),
  registrarLatido: vi.fn(),
  estado: { crm: null as unknown },
}));

vi.mock("@/lib/notifications/resend", () => ({ sendEmailConEstado: sendEmail }));
vi.mock("@/lib/salud/latidos", () => ({ registrarLatido }));
vi.mock("@/lib/crm/store", async (original) => ({ ...(await original<typeof import("@/lib/crm/store")>()), getCrmStore: () => estado.crm }));
vi.mock("@/lib/data", () => ({ getRepository: () => ({ leads: { list: async () => [] } }) }));

const { GET } = await import("./route");

function get(auth?: string) {
  return GET(new Request("https://www.cicinmuebles.com/api/cron/crm-diario", { headers: auth ? { authorization: auth } : {} }));
}

describe("GET /api/cron/crm-diario", () => {
  beforeEach(() => {
    process.env.CRON_SECRET = "cron-secret";
    process.env.LEADS_NOTIFICATION_EMAIL = "equipo@cic.test";
    estado.crm = new MemoryCrmStore();
    sendEmail.mockReset().mockResolvedValue({ ok: true, status: 200 });
    registrarLatido.mockReset().mockResolvedValue(undefined);
    vi.spyOn(console, "error").mockImplementation(() => {});
  });

  it("401 sin el Bearer correcto, sin leer el CRM ni mandar correo", async () => {
    const espia = vi.spyOn(estado.crm as MemoryCrmStore, "listarSeguimientos");
    expect((await get()).status).toBe(401);
    expect((await get("Bearer otro")).status).toBe(401);
    expect(espia).not.toHaveBeenCalled();
    expect(sendEmail).not.toHaveBeenCalled();
    expect(registrarLatido).not.toHaveBeenCalled();
  });

  it("sin pendientes: 200, no manda correo y el latido queda en verde", async () => {
    const res = await get("Bearer cron-secret");
    expect(res.status).toBe(200);
    expect(await res.json()).toMatchObject({ ok: true, enviado: false });
    expect(sendEmail).not.toHaveBeenCalled();
    expect(registrarLatido).toHaveBeenCalledWith("cron-crm", true, "sin pendientes");
  });

  it("la respuesta cuenta también los pagos sin publicar y los planes por vencer", async () => {
    const res = await get("Bearer cron-secret");
    expect(await res.json()).toMatchObject({ pagosSinPublicar: 0, planesPorVencer: 0 });
  });

  it("con un seguimiento vencido manda el resumen al equipo con clave de idempotencia del día", async () => {
    const crm = estado.crm as MemoryCrmStore;
    const { contacto } = await crm.crearContacto({ nombre: "Marta", telefono: "+57 300 123 4567", origen: "manual" });
    await crm.fijarProximoContacto(contacto.id, "2020-01-01T14:00:00.000Z", "llamar");
    const res = await get("Bearer cron-secret");
    expect(res.status).toBe(200);
    const cuerpo = await res.json();
    expect(cuerpo).toMatchObject({ ok: true, enviado: true, seguimientos: 1 });
    expect(JSON.stringify(cuerpo)).not.toContain("Marta"); // la respuesta solo lleva conteos
    const [msg] = sendEmail.mock.calls[0];
    expect(msg.to).toBe("equipo@cic.test");
    expect(msg.text).toContain("Marta");
    expect(msg.idempotencyKey).toMatch(/^crm-diario-\d{4}-\d{2}-\d{2}$/);
    expect(registrarLatido).toHaveBeenCalledWith("cron-crm", true, undefined);
  });

  it("si el correo no sale: 500 y latido con fallo", async () => {
    const crm = estado.crm as MemoryCrmStore;
    const { contacto } = await crm.crearContacto({ nombre: "Marta", origen: "manual" });
    await crm.fijarProximoContacto(contacto.id, "2020-01-01T14:00:00.000Z");
    sendEmail.mockResolvedValue({ ok: false, status: 500 });
    expect((await get("Bearer cron-secret")).status).toBe(500);
    expect(registrarLatido).toHaveBeenCalledWith("cron-crm", false, expect.any(String));
  });

  it("409 de idempotencia (el correo del día ya salió): 200 y latido en verde", async () => {
    const crm = estado.crm as MemoryCrmStore;
    const { contacto } = await crm.crearContacto({ nombre: "Marta", origen: "manual" });
    await crm.fijarProximoContacto(contacto.id, "2020-01-01T14:00:00.000Z");
    sendEmail.mockResolvedValue({ ok: false, status: 409 });
    const res = await get("Bearer cron-secret");
    expect(res.status).toBe(200);
    expect(await res.json()).toMatchObject({ ok: true, enviado: false, motivo: "ya enviado" });
    expect(registrarLatido).toHaveBeenCalledWith("cron-crm", true, "ya enviado hoy");
  });

  it("si el CRM falla: 500 y latido con fallo, sin datos en la respuesta", async () => {
    vi.spyOn(estado.crm as MemoryCrmStore, "listarSeguimientos").mockRejectedValue(new Error("base caída"));
    const res = await get("Bearer cron-secret");
    expect(res.status).toBe(500);
    expect(await res.json()).toEqual({ ok: false, error: "No se pudo armar el resumen" });
    expect(registrarLatido).toHaveBeenCalledWith("cron-crm", false, expect.any(String));
  });
});
