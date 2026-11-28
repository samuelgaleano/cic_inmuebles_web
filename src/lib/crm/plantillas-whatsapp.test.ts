import { describe, expect, it } from "vitest";
import {
  PLANTILLAS,
  cuandoLegible,
  enlaceFicha,
  mensajeConfirmarVisita,
  mensajeDespuesDeVisita,
  mensajeInmuebleSimilar,
  mensajePrimerContactoComprador,
  mensajePrimerContactoPropietario,
  mensajeSeguimientoVendedor,
  opcionesWhatsApp,
  primerNombre,
  type ContextoWhatsApp,
  type InmuebleMensaje,
} from "./plantillas-whatsapp";

const apto: InmuebleMensaje = { titulo: "Apartamento en Cedritos", slug: "apto-cedritos-1006", precio: 420_000_000, sector: "Cedritos" };
// Caracteres que rompen un enlace si no se codifican: &, ?, #, +, tildes, ñ y comillas.
const raro: InmuebleMensaje = { titulo: "Casa \"La Peña\" #2 & lote + garaje?", slug: "casa-pena-2", sector: "Chía" };

/** Ningún hueco de una variable vacía en el texto. */
function sinHuecos(texto: string) {
  expect(texto).not.toMatch(/undefined|null|NaN|\[object|\{|\}/);
  expect(texto).not.toMatch(/ {2}|\s[,.:;?]|\(\)|,,|\.\./);
  expect(texto).not.toMatch(/Hola ,|Hola\s*$/);
  expect(texto.trim()).toBe(texto);
}

const todas = (nombre?: string, inmueble: InmuebleMensaje = apto) => [
  mensajePrimerContactoComprador({ nombre, inmueble }),
  mensajePrimerContactoComprador({ nombre }),
  mensajePrimerContactoPropietario({ nombre, queVende: "tu apartamento en Usaquén" }),
  mensajePrimerContactoPropietario({ nombre }),
  mensajeConfirmarVisita({ nombre, inmueble, inicioEn: "2026-12-04T20:00:00.000Z" }),
  mensajeDespuesDeVisita({ nombre, inmueble }),
  mensajeInmuebleSimilar({ nombre, inmueble }),
  mensajeInmuebleSimilar({ nombre, inmueble: { ...inmueble, precio: 0 } }),
  mensajeSeguimientoVendedor({ nombre, inmueble }),
  mensajeSeguimientoVendedor({ nombre }),
];

describe("plantillas de WhatsApp", () => {
  it("saluda por el primer nombre, bien escrito", () => {
    expect(primerNombre("MARÍA josé Pérez")).toBe("María");
    expect(primerNombre("  luis ")).toBe("Luis");
    expect(primerNombre("")).toBe("");
    expect(primerNombre(undefined)).toBe("");
    expect(primerNombre("Suprimido")).toBe("");
    expect(mensajeDespuesDeVisita({ nombre: "marta pérez", inmueble: apto })).toMatch(/^Hola Marta, gracias/);
  });

  it("no deja variables vacías con nombre, sin nombre o con datos a medias", () => {
    for (const nombre of ["Marta Pérez", "", undefined, "Suprimido", "  "]) {
      for (const t of todas(nombre)) sinHuecos(t);
      for (const t of todas(nombre, { titulo: "Lote", slug: "lote" })) sinHuecos(t);
    }
    expect(mensajePrimerContactoComprador({})).toMatch(/^Hola, te escribo/);
  });

  it("incluye la ficha con su enlace etiquetado y el precio solo si lo hay", () => {
    const t = mensajePrimerContactoComprador({ nombre: "Ana", inmueble: apto });
    expect(t).toContain("https://www.cicinmuebles.com/inmuebles/apto-cedritos-1006?utm_source=whatsapp&utm_medium=mensaje&utm_campaign=apto-cedritos-1006");
    expect(mensajeInmuebleSimilar({ nombre: "Ana", inmueble: apto })).toContain("$");
    expect(mensajeInmuebleSimilar({ nombre: "Ana", inmueble: { ...apto, precio: undefined } })).not.toContain("$");
    // El sector no se repite si ya está en el título.
    expect(mensajeDespuesDeVisita({ inmueble: apto })).not.toContain("(Cedritos)");
    expect(mensajeDespuesDeVisita({ inmueble: { titulo: "Apartamento 302", slug: "a", sector: "Cedritos" } })).toContain("Apartamento 302 (Cedritos)");
  });

  it("escribe la fecha de la visita en hora de Bogotá", () => {
    // 20:00 UTC = 3:00 p. m. en Bogotá
    expect(cuandoLegible("2026-12-04T20:00:00.000Z")).toMatch(/^viernes 4 de diciembre a las 3:00/);
    expect(mensajeConfirmarVisita({ nombre: "Ana", inmueble: apto, inicioEn: "2026-12-04T20:00:00.000Z" })).toContain("el viernes 4 de diciembre a las 3:00");
  });

  it("arma enlaces wa.me que se decodifican al texto exacto, también con caracteres especiales", () => {
    const ctx: ContextoWhatsApp = {
      nombre: "Peña Ñuñez",
      telefono: "300 123 4567",
      esComprador: true,
      esVendedor: true,
      interes: raro,
      queVende: "tu casa en Chía",
      inmuebleVendedor: raro,
      proximaVisita: { inicioEn: "2026-12-04T20:00:00.000Z", inmueble: raro },
      visitado: raro,
      similar: raro,
    };
    const ops = opcionesWhatsApp(ctx);
    expect(ops.map((o) => o.id)).toEqual([...PLANTILLAS]);
    for (const o of ops) {
      const url = new URL(o.href);
      expect(url.origin + url.pathname).toBe("https://wa.me/573001234567");
      // Un solo parámetro: el & y el ? del título no lo parten.
      expect([...url.searchParams.keys()]).toEqual(["text"]);
      expect(url.searchParams.get("text")).toBe(o.texto);
      expect(o.href).not.toMatch(/[ "#&]text|[ "]/);
      sinHuecos(o.texto);
    }
    expect(enlaceFicha("casa pena")).toContain("/inmuebles/casa%20pena?");
  });

  it("solo ofrece lo que aplica y nada si el teléfono no sirve para WhatsApp", () => {
    expect(opcionesWhatsApp({ nombre: "Ana", telefono: "300 123 4567", esComprador: true }).map((o) => o.id)).toEqual(["primer_comprador"]);
    expect(opcionesWhatsApp({ nombre: "Ana", telefono: "300 123 4567", esVendedor: true }).map((o) => o.id)).toEqual(["primer_propietario", "seguimiento_vendedor"]);
    expect(opcionesWhatsApp({ nombre: "Ana", telefono: "234 5678", esComprador: true })).toEqual([]);
    expect(opcionesWhatsApp({ nombre: "Ana", esComprador: true })).toEqual([]);
  });
});
