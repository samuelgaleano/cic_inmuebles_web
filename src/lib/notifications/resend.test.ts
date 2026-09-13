import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { sendEmail } from "./resend";

describe("sendEmail (Resend)", () => {
  const fetchMock = vi.fn();

  beforeEach(() => {
    vi.stubGlobal("fetch", fetchMock);
    fetchMock.mockReset();
    process.env.RESEND_API_KEY = "re_test";
    delete process.env.RESEND_FROM;
  });

  afterEach(() => {
    vi.unstubAllGlobals();
  });

  it("devuelve false sin llamar a la red cuando falta RESEND_API_KEY", async () => {
    delete process.env.RESEND_API_KEY;
    const ok = await sendEmail({ to: "a@b.co", subject: "x", text: "y" });
    expect(ok).toBe(false);
    expect(fetchMock).not.toHaveBeenCalled();
  });

  it("envia con Bearer y remitente por defecto, y devuelve true con 2xx", async () => {
    fetchMock.mockResolvedValue({ ok: true, status: 200, text: async () => "" });
    const ok = await sendEmail({ to: "a@b.co", subject: "Hola", text: "cuerpo" });
    expect(ok).toBe(true);
    const [url, init] = fetchMock.mock.calls[0];
    expect(url).toBe("https://api.resend.com/emails");
    expect(init.headers.Authorization).toBe("Bearer re_test");
    const body = JSON.parse(init.body);
    expect(body.to).toEqual(["a@b.co"]);
    expect(body.from).toContain("onboarding@resend.dev");
    expect(body.subject).toBe("Hola");
  });

  it("usa RESEND_FROM cuando esta definido", async () => {
    process.env.RESEND_FROM = "CIC <notificaciones@cicinmuebles.com>";
    fetchMock.mockResolvedValue({ ok: true, status: 200, text: async () => "" });
    await sendEmail({ to: "a@b.co", subject: "s", text: "t" });
    expect(JSON.parse(fetchMock.mock.calls[0][1].body).from).toBe("CIC <notificaciones@cicinmuebles.com>");
  });

  it("devuelve false cuando Resend responde error", async () => {
    fetchMock.mockResolvedValue({ ok: false, status: 403, text: async () => "domain not verified" });
    expect(await sendEmail({ to: "a@b.co", subject: "s", text: "t" })).toBe(false);
  });

  it("devuelve false cuando la red falla", async () => {
    fetchMock.mockRejectedValue(new Error("ECONNRESET"));
    expect(await sendEmail({ to: "a@b.co", subject: "s", text: "t" })).toBe(false);
  });
});
