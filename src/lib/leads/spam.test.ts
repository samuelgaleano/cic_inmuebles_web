import { describe, expect, it } from "vitest";
import { esSpamProbable, senalesDeSpam } from "./spam";

describe("esSpamProbable", () => {
  it("descarta el spam que llegó de verdad al sitio", () => {
    const casos = [
      { nombre: "Wolfgang Forrest", mensaje: "Hey Include cicinmuebles.com in Google's Search Index and have it appear in online search results! List cicinmuebles.com now: domainsubmit.live" },
      { nombre: "Daisy Neighbour", mensaje: "Howdy from bonusbacklinks, Increase cicinmuebles.com seo with best quality seo services! https://Bonusbacklinks.com/coupon" },
      { nombre: "Hello http://cicinmuebles.com/fekal0911 Administrator", mensaje: "Hello http://cicinmuebles.com/fekal0911 Owner" },
      { nombre: "Joanna Riggs", mensaje: "We help brands tell their story through short promotional videos. Projects start from $195 USD, includes the script, voice-over. Regards, Jo" },
      { nombre: "Olivia", mensaje: "Hi Dear http://cicinmuebles.com, it is not ranking well on Google. Shall I send our SEO packages and pricing?" },
      { nombre: "Pranab", email: "p.r.a.n.a.bses.1@gmail.com", mensaje: "Hola, una renovación de marca y diseño gráfico podría ser muy beneficiosa." },
    ];
    for (const c of casos) expect(esSpamProbable(c), c.nombre).toBe(true);
  });

  it("deja pasar los mensajes reales, también los que traen un enlace o vienen del extranjero", () => {
    const reales = [
      { nombre: "Marta Pérez", mensaje: "Me interesa el apartamento, ¿podemos visitarlo el sábado en la tarde?" },
      { nombre: "Juan Villa", mensaje: "Quiero vender mi casa en Chapinero, tiene 3 alcobas." },
      { nombre: "Carlos", mensaje: "Vi esta ficha en https://www.metrocuadrado.com/apto-123 y quiero saber si sigue disponible." }, // solo un enlace
      { nombre: "Sofía Gómez", tipoTelefono: "internacional", mensaje: "Vivo en Madrid y quiero comprar un apartamento en Bogotá para mi familia." }, // solo teléfono del exterior
      { nombre: "galeano alvis", mensaje: "urgente" },
      { nombre: "k;jm", mensaje: "jujuj" },
    ];
    for (const r of reales) expect(esSpamProbable(r), r.nombre).toBe(false);
  });

  it("cuenta las señales una por una", () => {
    expect(senalesDeSpam({ nombre: "A", mensaje: "hola" })).toBe(0);
    expect(senalesDeSpam({ nombre: "A", mensaje: "visita www.algo.com" })).toBe(1);
    expect(senalesDeSpam({ nombre: "A", tipoTelefono: "internacional", mensaje: "hello there" })).toBe(2);
  });
});
