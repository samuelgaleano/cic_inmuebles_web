import { describe, expect, it } from "vitest";
import { whatsappAnunciante, whatsappCic } from "./contacto";

const inmueble = { titulo: "Bella Suiza", codigo: "1013", url: "https://www.cicinmuebles.com/inmuebles/bella-suiza" };

describe("WhatsApp de la ficha", () => {
  it("CIC recibe el código del inmueble", () => {
    const url = decodeURIComponent(whatsappCic(inmueble));
    expect(url).toContain("wa.me/573249071717");
    expect(url).toContain("«Bella Suiza» (código 1013)");
  });

  it("el anunciante recibe el mismo código en su propio número", () => {
    const url = whatsappAnunciante({ nombre: "Inmobiliaria Norte", whatsapp: "+57 310 555 2020" }, inmueble);
    expect(url).toMatch(/^https:\/\/wa\.me\/573105552020\?text=/);
    expect(decodeURIComponent(url!)).toContain("Hola Inmobiliaria Norte, vi en CIC Inmuebles el inmueble «Bella Suiza» (código 1013)");
  });

  it("sin anunciante o con un número que no sirve para WhatsApp, no hay botón", () => {
    expect(whatsappAnunciante(undefined, inmueble)).toBeUndefined();
    expect(whatsappAnunciante({ whatsapp: "234 5678" }, inmueble)).toBeUndefined();
  });
});
