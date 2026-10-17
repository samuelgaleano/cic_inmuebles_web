import { beforeEach, describe, expect, it, vi } from "vitest";

const { runDriveImport, syncAll, sendPagosAlert } = vi.hoisted(() => ({
  runDriveImport: vi.fn(),
  syncAll: vi.fn(),
  sendPagosAlert: vi.fn(),
}));

vi.mock("@/lib/services/drive-import", () => ({ runDriveImport }));
vi.mock("@/lib/data", () => ({ getRepository: () => ({ properties: { list: async () => [] } }) }));
vi.mock("@/lib/integrations/sheets", () => ({ isSheetsConfigured: () => true, syncAllPropertiesToSheet: syncAll }));
vi.mock("@/lib/notifications/payment", () => ({ sendPagosAlert }));

const { GET } = await import("./route");

function get(auth?: string) {
  return GET(new Request("https://www.cicinmuebles.com/api/cron/sync", { headers: auth ? { authorization: auth } : {} }));
}

describe("GET /api/cron/sync", () => {
  beforeEach(() => {
    process.env.CRON_SECRET = "cron-secret";
    vi.restoreAllMocks();
    runDriveImport.mockReset().mockResolvedValue({ ran: true, ok: true, message: "ok", created: [], skipped: 0, errors: [] });
    syncAll.mockReset().mockResolvedValue(undefined);
    sendPagosAlert.mockReset().mockResolvedValue(true);
    vi.spyOn(console, "error").mockImplementation(() => {});
  });

  it("401 sin el Bearer correcto, sin tocar Drive", async () => {
    expect((await get()).status).toBe(401);
    expect((await get("Bearer otro")).status).toBe(401);
    expect(runDriveImport).not.toHaveBeenCalled();
  });

  it("todo bien: 200 y sin alerta", async () => {
    const res = await get("Bearer cron-secret");
    expect(res.status).toBe(200);
    expect(sendPagosAlert).not.toHaveBeenCalled();
  });

  it("si la importación lanza: 500, Sheets igual corre y se alerta", async () => {
    runDriveImport.mockRejectedValue(new Error("drive caído"));
    const res = await get("Bearer cron-secret");
    expect(res.status).toBe(500);
    expect(syncAll).toHaveBeenCalledTimes(1);
    expect(sendPagosAlert).toHaveBeenCalledTimes(1);
  });

  it("errores parciales: alerta con el conteo, sin nombres de carpetas", async () => {
    runDriveImport.mockResolvedValue({ ran: true, ok: true, errors: ['No se pudo importar "Apto de Juan Perez".'] });
    syncAll.mockRejectedValue(new Error("sheets"));
    const res = await get("Bearer cron-secret");
    expect(res.status).toBe(200);
    const [asunto, texto] = sendPagosAlert.mock.calls[0];
    expect(`${asunto}\n${texto}`).not.toContain("Juan Perez");
    expect(texto).toContain("1 carpeta(s) con error");
    expect(texto).toContain("Sheets");
  });
});
