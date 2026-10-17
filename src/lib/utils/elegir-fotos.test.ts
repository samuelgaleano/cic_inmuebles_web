import { describe, expect, it } from "vitest";
import { elegirDosDistintos } from "./elegir-fotos";

describe("elegirDosDistintos", () => {
  it("con tres o más usa el segundo y el tercero (el primero ya está en la vitrina)", () => {
    expect(elegirDosDistintos(["a", "b", "c", "d"])).toEqual(["b", "c"]);
    expect(elegirDosDistintos(["a", "b", "c"])).toEqual(["b", "c"]);
  });

  it("con exactamente dos no repite la misma foto", () => {
    const [x, y] = elegirDosDistintos(["a", "b"]);
    expect(x).not.toBe(y);
    expect([x, y].sort()).toEqual(["a", "b"]);
  });

  it("con una sola deja el segundo hueco vacío en vez de repetirla", () => {
    expect(elegirDosDistintos(["a"])).toEqual(["a", undefined]);
  });

  it("sin elementos devuelve dos huecos vacíos", () => {
    expect(elegirDosDistintos([])).toEqual([undefined, undefined]);
  });
});
