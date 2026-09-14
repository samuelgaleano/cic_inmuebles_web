import { describe, expect, it } from "vitest";
import { agruparPorSector, encontrarSector, MIN_INMUEBLES_INDEXABLE, sectorPath } from "./sectores";

const p = (slug: string, sector: string | undefined, ciudad = "Bogotá", precio = 1, estado = "disponible") =>
  ({ slug, ubicacion: { ciudad, sector }, precio, estado, tipo: "apartamento" }) as never;

describe("agruparPorSector", () => {
  it("agrupa por sector normalizado en URL y ordena por cantidad y nombre", () => {
    const g = agruparPorSector([p("a", "La Calleja"), p("b", "Bella Suiza"), p("c", "la calleja"), p("d", undefined)]);
    expect(g.map((s) => [s.slug, s.nombre, s.inmuebles.length])).toEqual([
      ["la-calleja", "La Calleja", 2],
      ["bella-suiza", "Bella Suiza", 1],
    ]);
  });

  it("solo es indexable el sector con suficientes DISPONIBLES: un vendido no cuenta", () => {
    const g = agruparPorSector([p("a", "Gilmar"), p("b", "Gilmar", "Bogotá", 1, "vendido"), p("c", "Alhambra")]);
    expect(MIN_INMUEBLES_INDEXABLE).toBe(2);
    const gilmar = g.find((s) => s.slug === "gilmar")!;
    expect(gilmar.inmuebles).toHaveLength(2);
    expect(gilmar.disponibles).toHaveLength(1);
    expect(gilmar.indexable).toBe(false);
    expect(g.find((s) => s.slug === "alhambra")?.indexable).toBe(false);
  });

  it("dos ciudades con el mismo nombre de sector no se mezclan: se desambiguan en la URL", () => {
    const g = agruparPorSector([p("a", "Centro", "Bogotá"), p("b", "Centro", "Bogotá"), p("c", "Centro", "Cali"), p("d", "Centro", "Cali")]);
    const slugs = g.map((s) => s.slug).sort();
    expect(slugs).toEqual(["centro-bogota", "centro-cali"]);
    expect(g.find((s) => s.slug === "centro-bogota")?.ciudad).toBe("Bogotá");
    expect(g.find((s) => s.slug === "centro-cali")?.ciudad).toBe("Cali");
  });

  it("un sector sin colisión mantiene su slug simple aunque otro sector sí colisione", () => {
    const g = agruparPorSector([p("a", "Centro", "Bogotá"), p("b", "Centro", "Cali"), p("c", "Gilmar", "Bogotá")]);
    expect(g.find((s) => s.nombre === "Gilmar")?.slug).toBe("gilmar");
  });

  it("el nombre canónico es determinista (el más frecuente, no el primero del inventario)", () => {
    const g1 = agruparPorSector([p("a", "bella suiza"), p("b", "Bella Suiza"), p("c", "Bella Suiza")]);
    const g2 = agruparPorSector([p("c", "Bella Suiza"), p("b", "Bella Suiza"), p("a", "bella suiza")]);
    expect(g1[0].nombre).toBe("Bella Suiza");
    expect(g2[0].nombre).toBe("Bella Suiza");
  });

  it("la ruta del sector es estable y sin tildes", () => {
    const g = agruparPorSector([p("a", "Alejandría"), p("b", "Alejandría")]);
    expect(sectorPath(g[0])).toBe("/inmuebles/sector/alejandria");
  });
});

describe("encontrarSector", () => {
  it("encuentra el grupo exacto del inmueble por slug, sin ambigüedad", () => {
    const props = [p("a", "Centro", "Bogotá"), p("b", "Centro", "Cali")];
    const sectores = agruparPorSector(props);
    expect(encontrarSector(sectores, { slug: "a" })?.ciudad).toBe("Bogotá");
    expect(encontrarSector(sectores, { slug: "b" })?.ciudad).toBe("Cali");
    expect(encontrarSector(sectores, { slug: "z" })).toBeUndefined();
  });
});
