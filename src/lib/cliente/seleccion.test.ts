import { describe, expect, it } from "vitest";
import { leerSlugs, mensajeSeleccion, urlSeleccion } from "./seleccion";

const validos = new Set(["bella-suiza", "alejandria", "gilmar", "calleja"]);

describe("leerSlugs", () => {
  it("conserva el orden, descarta repetidos, desconocidos y vacíos", () => {
    expect(leerSlugs("gilmar, bella-suiza,,gilmar,zzz,alejandria", validos, 5)).toEqual(["gilmar", "bella-suiza", "alejandria"]);
  });
  it("respeta el máximo", () => {
    expect(leerSlugs("bella-suiza,alejandria,gilmar,calleja", validos, 3)).toEqual(["bella-suiza", "alejandria", "gilmar"]);
  });
  it("sin parámetro: nada", () => {
    expect(leerSlugs(undefined, validos, 3)).toEqual([]);
    expect(leerSlugs(null, validos, 3)).toEqual([]);
    expect(leerSlugs("", validos, 3)).toEqual([]);
  });
});

describe("urlSeleccion", () => {
  it("arma el enlace con comas legibles", () => {
    expect(urlSeleccion("https://www.cicinmuebles.com/", "/favoritos", ["bella-suiza", "gilmar"])).toBe(
      "https://www.cicinmuebles.com/favoritos?s=bella-suiza,gilmar",
    );
  });
  it("sin slugs, la ruta sola", () => {
    expect(urlSeleccion("https://x.co", "/comparar", [])).toBe("https://x.co/comparar");
  });
});

describe("mensajeSeleccion", () => {
  it("una línea por inmueble, con sector solo si aporta", () => {
    const m = mensajeSeleccion("CIC Inmuebles", "estos son los inmuebles que me interesan:", [
      { titulo: "Bella Suiza", sector: "Bella Suiza", url: "https://x/a" },
      { titulo: "Area19 Calleja", sector: "Calleja", url: "https://x/b" },
    ]);
    expect(m).toBe(
      "Hola CIC Inmuebles, estos son los inmuebles que me interesan:\n1. Bella Suiza: https://x/a\n2. Area19 Calleja (Calleja): https://x/b",
    );
  });
});
