import { describe, expect, it } from "vitest";
import { desdeHoraBogota, formatoBogota } from "./hora-bogota";

describe("hora de Bogotá", () => {
  it("10:00 escrito en el panel es 10:00 en Bogotá (15:00 UTC), sin importar la zona del servidor", () => {
    expect(desdeHoraBogota("2026-10-20T10:00")).toBe("2026-10-20T15:00:00.000Z");
  });

  it("pasa al día siguiente en UTC cuando corresponde", () => {
    expect(desdeHoraBogota("2026-10-20T20:30")).toBe("2026-10-21T01:30:00.000Z");
  });

  it("rechaza lo que no es una fecha", () => {
    expect(desdeHoraBogota("mañana")).toBeUndefined();
    expect(desdeHoraBogota("2026-13-45T10:00")).toBeUndefined();
  });

  it("se muestra otra vez como la hora escrita", () => {
    const txt = formatoBogota(desdeHoraBogota("2026-10-20T10:00")!);
    expect(txt).toMatch(/10:00/);
  });
});
