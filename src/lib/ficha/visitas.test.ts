import { describe, expect, it } from "vitest";
import { componerPreferencia, FRANJAS, proximosDias } from "./visitas";

describe("proximosDias (calendario de Bogotá, UTC−5)", () => {
  it("empieza mañana y devuelve días consecutivos", () => {
    const dias = proximosDias(new Date("2026-10-09T15:00:00Z"), 5); // 10:00 en Bogotá
    expect(dias).toHaveLength(5);
    expect(dias[0]).toMatchObject({ iso: "2026-10-10", largo: "sábado 10 de octubre", corto: "sáb", dia: 10 });
    expect(dias.map((d) => d.iso)).toEqual(["2026-10-10", "2026-10-11", "2026-10-12", "2026-10-13", "2026-10-14"]);
  });

  it("respeta la fecha de Bogotá aunque en UTC ya sea otro día", () => {
    // 03:00 UTC del 10 = 22:00 del 9 en Bogotá → "mañana" es el 10
    expect(proximosDias(new Date("2026-10-10T03:00:00Z"), 1)[0].iso).toBe("2026-10-10");
    // 06:00 UTC del 10 = 01:00 del 10 en Bogotá → "mañana" es el 11
    expect(proximosDias(new Date("2026-10-10T06:00:00Z"), 1)[0].iso).toBe("2026-10-11");
  });

  it("cruza fin de mes y de año", () => {
    const dias = proximosDias(new Date("2026-12-30T15:00:00Z"), 3);
    expect(dias.map((d) => d.iso)).toEqual(["2026-12-31", "2027-01-01", "2027-01-02"]);
    expect(dias[1].largo).toBe("viernes 1 de enero");
  });
});

describe("componerPreferencia", () => {
  it("arma una frase clara para el equipo y para el WhatsApp", () => {
    const dia = proximosDias(new Date("2026-10-09T15:00:00Z"), 1)[0];
    expect(componerPreferencia(dia, "tarde")).toBe("sábado 10 de octubre, en la tarde");
    expect(componerPreferencia(dia, "manana")).toBe("sábado 10 de octubre, en la mañana");
    expect(componerPreferencia(dia, "flexible")).toBe("sábado 10 de octubre, a cualquier hora");
  });

  it("sin día: solo la franja, o nada", () => {
    expect(componerPreferencia(undefined, "tarde")).toBe("en la tarde");
    expect(componerPreferencia(undefined, undefined)).toBe("");
  });

  it("las franjas son tres y no prometen horarios exactos", () => {
    expect(FRANJAS.map((f) => f.id)).toEqual(["manana", "tarde", "flexible"]);
  });
});
