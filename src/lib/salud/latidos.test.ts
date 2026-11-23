import { describe, expect, it } from "vitest";
import { estadoDeLatido, MAX_SIN_LATIDO_MS } from "./latidos";

const AHORA = new Date("2026-11-23T12:00:00.000Z");
const hace = (ms: number) => new Date(AHORA.getTime() - ms).toISOString();
const HORA = 3_600_000;

describe("estadoDeLatido", () => {
  it("sin registro es «sin-dato» (primer día), no un fallo", () => {
    expect(estadoDeLatido(undefined, AHORA)).toBe("sin-dato");
  });
  it("una corrida buena reciente es «ok»", () => {
    expect(estadoDeLatido({ nombre: "cron-sync", okAt: hace(HORA), falloAt: null }, AHORA)).toBe("ok");
  });
  it("más de 27 h sin corrida buena es «atrasado»", () => {
    expect(estadoDeLatido({ nombre: "cron-sync", okAt: hace(MAX_SIN_LATIDO_MS + 60_000), falloAt: null }, AHORA)).toBe("atrasado");
  });
  it("un fallo posterior a la última corrida buena es «con-fallos»", () => {
    expect(estadoDeLatido({ nombre: "cron-diario", okAt: hace(5 * HORA), falloAt: hace(HORA) }, AHORA)).toBe("con-fallos");
  });
  it("una corrida buena después del fallo lo da por resuelto", () => {
    expect(estadoDeLatido({ nombre: "cron-diario", okAt: hace(HORA), falloAt: hace(5 * HORA) }, AHORA)).toBe("ok");
  });
  it("solo fallos, nunca una buena, es «con-fallos»", () => {
    expect(estadoDeLatido({ nombre: "cron-diario", okAt: null, falloAt: hace(HORA) }, AHORA)).toBe("con-fallos");
  });
});
