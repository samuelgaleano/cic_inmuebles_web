import { describe, expect, it } from "vitest";
import { enlaceParaRed, REDES } from "./enlace-redes";

describe("enlace de la ficha para redes", () => {
  it("lleva utm_source de la red, utm_medium=social y la campaña con el slug", () => {
    expect(enlaceParaRed("apto-cedritos-1006", "instagram")).toBe(
      "https://www.cicinmuebles.com/inmuebles/apto-cedritos-1006?utm_source=instagram&utm_medium=social&utm_campaign=apto-cedritos-1006",
    );
    for (const red of REDES) {
      const u = new URL(enlaceParaRed("casa-chia", red));
      expect(u.searchParams.get("utm_source")).toBe(red);
      expect(u.searchParams.get("utm_medium")).toBe("social");
      expect(u.searchParams.get("utm_campaign")).toBe("casa-chia");
    }
  });
});
