import { describe, expect, it } from "vitest";
import { limpiarDominio, limpiarOrigen, limpiarRuta, origenDeFormulario, origenDePrimeraVista, resumenOrigen } from "./origen";

describe("origen de la visita", () => {
  it("primera vista con campaña y referente externo", () => {
    expect(
      origenDePrimeraVista({
        search: "?utm_source=instagram&utm_medium=social&utm_campaign=lanzamiento&fbclid=abc",
        referrer: "https://l.instagram.com/?u=https%3A%2F%2Fwww.cicinmuebles.com",
        pathname: "/inmuebles/bella-suiza",
        host: "www.cicinmuebles.com",
      }),
    ).toEqual({
      utmSource: "instagram",
      utmMedium: "social",
      utmCampaign: "lanzamiento",
      referente: "l.instagram.com",
      paginaEntrada: "/inmuebles/bella-suiza",
    });
  });

  it("venir del propio sitio no es un referente; sin referrer, solo la entrada", () => {
    const base = { search: "", pathname: "/vender", host: "www.cicinmuebles.com" };
    expect(origenDePrimeraVista({ ...base, referrer: "https://cicinmuebles.com/inmuebles" })).toEqual({ paginaEntrada: "/vender" });
    expect(origenDePrimeraVista({ ...base, referrer: "" })).toEqual({ paginaEntrada: "/vender" });
    expect(origenDePrimeraVista({ ...base, referrer: "no es una url" })).toEqual({ paginaEntrada: "/vender" });
    expect(origenDePrimeraVista({ ...base, referrer: "android-app://com.google.android.gm/" })).toEqual({ paginaEntrada: "/vender" });
  });

  it("el servidor recorta, limpia y descarta lo que no es lo esperado", () => {
    expect(limpiarDominio("WWW.Google.com")).toBe("google.com");
    expect(limpiarDominio("https://google.com/x")).toBeUndefined();
    expect(limpiarDominio("localhost")).toBeUndefined();
    expect(limpiarRuta("/inmuebles?q=casa#fotos")).toBe("/inmuebles");
    expect(limpiarRuta("//evil.example/x")).toBeUndefined();
    expect(limpiarRuta("https://evil.example")).toBeUndefined();
    expect(limpiarRuta("/<script>")).toBeUndefined();
    const largo = limpiarOrigen({ utmSource: "x".repeat(500), utmCampaign: "a\u0000b\nc" });
    expect(largo?.utmSource).toHaveLength(100);
    expect(largo?.utmCampaign).toBe("a b c");
    expect(limpiarOrigen({ utmSource: 5, referente: {} })).toBeUndefined();
    expect(limpiarOrigen(null)).toBeUndefined();
  });

  it("se lee de un formulario con los nombres de las columnas", () => {
    const fd = new FormData();
    fd.set("utm_source", "facebook");
    fd.set("pagina_entrada", "/publica");
    expect(origenDeFormulario(fd)).toEqual({ utmSource: "facebook", paginaEntrada: "/publica" });
    expect(origenDeFormulario(new FormData())).toBeUndefined();
  });

  it("resumen de una línea para el panel", () => {
    expect(resumenOrigen({ utmSource: "instagram", utmMedium: "social", referente: "instagram.com", paginaEntrada: "/vender" })).toBe(
      "instagram / social · desde instagram.com · entró por /vender",
    );
    expect(resumenOrigen(undefined)).toBeUndefined();
  });
});
