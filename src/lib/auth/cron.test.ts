import { afterEach, describe, expect, it, vi } from "vitest";
import { autorizadoCron } from "./cron";

function req(auth?: string): Request {
  return new Request("https://www.cicinmuebles.com/api/cron/sync", { headers: auth ? { authorization: auth } : {} });
}

afterEach(() => {
  vi.unstubAllEnvs();
});

describe("autorizadoCron", () => {
  it("acepta solo el Bearer exacto", () => {
    vi.stubEnv("CRON_SECRET", "cron-secret");
    expect(autorizadoCron(req("Bearer cron-secret"))).toBe(true);
    expect(autorizadoCron(req("Bearer cron-secre"))).toBe(false);
    expect(autorizadoCron(req("Bearer cron-secret-mas-largo"))).toBe(false);
    expect(autorizadoCron(req("cron-secret"))).toBe(false);
    expect(autorizadoCron(req())).toBe(false);
  });

  it("sin CRON_SECRET no pasa nadie, ni siquiera con 'Bearer ' vacio", () => {
    vi.stubEnv("CRON_SECRET", "");
    expect(autorizadoCron(req("Bearer "))).toBe(false);
    expect(autorizadoCron(req("Bearer undefined"))).toBe(false);
  });
});
