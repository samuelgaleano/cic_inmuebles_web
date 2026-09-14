import { describe, expect, it } from "vitest";
import { normalizarInmueble } from "./normalizar";

describe("normalizarInmueble", () => {
  it("corrige lo mal digitado en el catálogo sin tocar lo que está bien", () => {
    const r = normalizarInmueble({
      titulo: "  EDIFICIO SAN PATRICIO ",
      ubicacion: { ciudad: "BogotÁ", sector: "BELLA SUIZA", conjunto: "Torre  2", direccion: " Cra 7 # 120-30 " },
      descripcion: "  Apto con vista\n\n",
    });
    expect(r.titulo).toBe("Edificio San Patricio");
    expect(r.ubicacion).toEqual({ ciudad: "Bogotá", sector: "Bella Suiza", conjunto: "Torre 2", direccion: "Cra 7 # 120-30" });
    expect(r.descripcion).toBe("Apto con vista");
  });

  it("respeta nombres bien escritos y campos ausentes", () => {
    const r = normalizarInmueble({ titulo: "Area19 Calleja", ubicacion: { ciudad: "Bogotá" }, descripcion: undefined });
    expect(r.titulo).toBe("Area19 Calleja");
    expect(r.ubicacion).toEqual({ ciudad: "Bogotá", sector: undefined, conjunto: undefined, direccion: undefined });
    expect(r.descripcion).toBeUndefined();
  });

  it("un sector vacío queda ausente, no como cadena vacía", () => {
    const r = normalizarInmueble({ titulo: "X", ubicacion: { ciudad: "Cali", sector: "   " } });
    expect(r.ubicacion.sector).toBeUndefined();
  });
});
