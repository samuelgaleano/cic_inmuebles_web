import { describe, expect, it } from "vitest";
import { importarHoja, type InmuebleRef } from "@/lib/crm/importar";
import { MemoryCrmStore } from "@/lib/crm/store";
import { aCsv, celdaCsv, leerCsv } from "./csv";

describe("CSV de salida", () => {
  it("escapa comillas, separadores y saltos de línea", () => {
    expect(celdaCsv('Dijo "hola"; y se fue')).toBe('"Dijo ""hola""; y se fue"');
    expect(celdaCsv("línea 1\nlínea 2")).toBe('"línea 1\nlínea 2"');
    expect(celdaCsv("simple")).toBe("simple");
    expect(celdaCsv(null)).toBe("");
    expect(celdaCsv(true)).toBe("Sí");
    expect(celdaCsv(false)).toBe("No");
    expect(celdaCsv(450000000)).toBe("450000000");
    expect(celdaCsv(Number.NaN)).toBe("");
  });

  it("neutraliza las fórmulas que llegan en datos de desconocidos (inyección de CSV)", () => {
    for (const peligrosa of ['=HYPERLINK("http://malo.example","clic")', "+cmd|' /C calc'!A0", "@SUM(1+1)", "-2+3+cmd|' /C calc'!A0", "=1+1"]) {
      expect(celdaCsv(peligrosa).replace(/^"/, "").startsWith("'")).toBe(true);
    }
    // teléfonos y números escritos como texto no se tocan
    expect(celdaCsv("+57 300 123 4567")).toBe("+57 300 123 4567");
    expect(celdaCsv("-12.500")).toBe("-12.500");
  });

  it("arma el archivo con BOM, separador «;» y fin de línea de Windows", () => {
    const csv = aCsv(["Nombre", "Precio"], [["Marta Pérez", 450000000], ["Ana; Luis", null]]);
    expect(csv.charCodeAt(0)).toBe(0xfeff);
    expect(csv.slice(1)).toBe('Nombre;Precio\r\nMarta Pérez;450000000\r\n"Ana; Luis";\r\n');
  });

  it("lo que se escribe se puede volver a leer igual", () => {
    const filas = [["Nombre", "Notas"], ['Ana "la jefa"', "línea 1\nlínea 2; con punto y coma"], ["Luis", ""]];
    expect(leerCsv(aCsv(filas[0], filas.slice(1)))).toEqual([filas[0], filas[1], ["Luis", ""]]);
  });
});

describe("lectura de hojas", () => {
  it("detecta separador ; , o tabulador y quita el BOM", () => {
    expect(leerCsv("﻿a;b\n1;2")).toEqual([["a", "b"], ["1", "2"]]);
    expect(leerCsv("a,b\n1,2")).toEqual([["a", "b"], ["1", "2"]]);
    expect(leerCsv("a\tb\n1\t2")).toEqual([["a", "b"], ["1", "2"]]);
  });

  it("respeta comillas con separadores y saltos, y descarta filas vacías", () => {
    expect(leerCsv('a;b\n"x;y";"l1\nl2"\n;\n\n')).toEqual([["a", "b"], ["x;y", "l1\nl2"]]);
    expect(leerCsv("a;b\r\n1;2\r\n")).toEqual([["a", "b"], ["1", "2"]]);
  });
});

describe("carga de la hoja del CRM", () => {
  const inmuebles: InmuebleRef[] = [
    { id: "p1", codigo: "1006", slug: "casa-uno" },
    { id: "p2", codigo: "1007", slug: "casa-dos" },
  ];
  const nuevo = () => {
    const crm = new MemoryCrmStore();
    crm.propiedadesValidas = new Set(inmuebles.map((i) => i.id));
    return crm;
  };

  const VENDEDORES = [
    "TIPO;NOMBRE;CELULAR;UBICACION;PRECIO;%;COMISION;ESTATUS;APROBACION;ID INMUEBLE;COORDINACION VIDEO O FOTOS",
    ";Marta Pérez;300 123 4567;Cedritos;450.000.000;3 %;#VALUE!;PAGA COMPLETO;SI;1006;IN",
    ";Luis Gómez;311 555 2020;Chicó;300.000.000;2,5;;PAGA PARCIAL;NO;;NO",
    ";;;;;;;PAGA COMPLETO;;;",
    ";;;;;;;PAGA COMPLETO;;;",
  ].join("\n");

  it("carga vendedores con sus datos, cuenta bien y deja de lado las filas de relleno", async () => {
    const crm = nuevo();
    const r = await importarHoja("vendedores", VENDEDORES, { crm, inmuebles }, { simular: false });
    expect(r).toMatchObject({ filas: 2, contactosNuevos: 2, creados: 2, yaExistian: 0, errores: [] });
    const [marta, luis] = await crm.listarCaptaciones();
    expect(marta).toMatchObject({ propertyId: "p1", precioEsperado: 450_000_000, comisionPct: 3, estatusPago: "paga_completo", aprobada: true, multimedia: "en_curso", comisionValor: 13_500_000 });
    expect(luis).toMatchObject({ precioEsperado: 300_000_000, comisionPct: 2.5, estatusPago: "paga_parcial", aprobada: false, multimedia: "por_coordinar", comisionValor: 7_500_000 });
    expect((await crm.listarContactos())[0].origen).toBe("hoja");
  });

  it("volver a cargar el mismo archivo no duplica nada", async () => {
    const crm = nuevo();
    await importarHoja("vendedores", VENDEDORES, { crm, inmuebles }, { simular: false });
    const otra = await importarHoja("vendedores", VENDEDORES, { crm, inmuebles }, { simular: false });
    expect(otra).toMatchObject({ creados: 0, yaExistian: 2, contactosNuevos: 0, contactosExistentes: 2 });
    expect(crm.contactos).toHaveLength(2);
    expect(crm.captaciones).toHaveLength(2);
  });

  it("la simulación cuenta lo mismo que la carga real pero no escribe nada", async () => {
    const crm = nuevo();
    const sim = await importarHoja("vendedores", VENDEDORES, { crm, inmuebles }, { simular: true });
    expect(sim).toMatchObject({ simulacion: true, filas: 2, contactosNuevos: 2, creados: 2 });
    expect(crm.contactos).toHaveLength(0);
    expect(crm.captaciones).toHaveLength(0);
    const real = await importarHoja("vendedores", VENDEDORES, { crm, inmuebles }, { simular: false });
    expect({ n: real.contactosNuevos, c: real.creados }).toEqual({ n: sim.contactosNuevos, c: sim.creados });
  });

  it("señala fila por fila lo que no se puede cargar y sigue con las demás", async () => {
    const hoja = [
      "NOMBRE;CELULAR;PRECIO;%;ID INMUEBLE",
      "Ana;123;100.000.000;3;",
      ";300 123 4567;100.000.000;3;",
      "Beto;311 555 2020;mucho;3;",
      "Carla;312 555 2021;100.000.000;150;",
      "Dani;313 555 2022;100.000.000;3;9999",
      "Eva;314 555 2023;100.000.000;3;1007",
    ].join("\n");
    const crm = nuevo();
    const r = await importarHoja("vendedores", hoja, { crm, inmuebles }, { simular: false });
    expect(r.creados).toBe(1);
    expect(r.errores.map((e) => e.fila)).toEqual([2, 3, 4, 5, 6]);
    expect(r.errores[0].motivo).toMatch(/teléfono/i);
    expect(r.errores[1].motivo).toMatch(/nombre/i);
    expect(r.errores[2].motivo).toMatch(/precio/i);
    expect(r.errores[3].motivo).toMatch(/porcentaje/i);
    expect(r.errores[4].motivo).toMatch(/9999/);
  });

  it("no deja que dos personas tengan vigente el mismo inmueble", async () => {
    const hoja = ["NOMBRE;CELULAR;ID INMUEBLE", "Ana;300 111 2222;1006", "Beto;300 333 4444;1006"].join("\n");
    const crm = nuevo();
    const r = await importarHoja("vendedores", hoja, { crm, inmuebles }, { simular: false });
    expect(r.creados).toBe(1);
    expect(r.errores).toEqual([{ fila: 3, motivo: expect.stringMatching(/ya tiene un vendedor vigente/) }]);
  });

  it("carga compradores con sus inmuebles propuestos (los «numeral 1, 2 y 3» de la hoja)", async () => {
    const hoja = [
      "TIPO;NOMBRE;CELULAR;UBICACION;PRECIO;ESPECIFICACION;POTENCIAL;NUMERAL INMUEBLE 1;NUMERAL INMUEBLE 2;NUMERAL INMUEBLE 3",
      "INMOBILIARIA;Inmobiliaria Sol;310 111 2233;Norte;800.000.000;3 alcobas;SI;1006;1007;",
      "A INDEPENTIENDE;Pedro Asesor;320 444 5566;Sur;;;NO;;;",
      "COMPRADOR;;;;450.000.000;;SI;;;",
    ].join("\n");
    const crm = nuevo();
    const r = await importarHoja("compradores", hoja, { crm, inmuebles }, { simular: false });
    expect(r).toMatchObject({ filas: 3, creados: 2, propuestas: 2 });
    expect(r.errores).toEqual([{ fila: 4, motivo: expect.stringMatching(/nombre/i) }]);
    const [pedro, sol] = (await crm.listarBusquedas()).reverse();
    expect(sol).toMatchObject({ tipo: "inmobiliaria", ubicacion: "Norte", precioMax: 800_000_000, especificacion: "3 alcobas", potencial: true });
    expect(pedro).toMatchObject({ tipo: "independiente", potencial: false });
    expect((await crm.listarPropuestas([sol.id])).map((p) => p.propertyId).sort()).toEqual(["p1", "p2"]);

    // Segunda carga: ni búsquedas ni propuestas nuevas
    const otra = await importarHoja("compradores", hoja, { crm, inmuebles }, { simular: false });
    expect(otra).toMatchObject({ creados: 0, yaExistian: 2, propuestas: 0 });
    expect(crm.busquedas).toHaveLength(2);
    expect(crm.propuestas).toHaveLength(2);
  });

  it("reconoce a quien no tiene teléfono por su nombre y avisa si el archivo no sirve", async () => {
    const hoja = ["NOMBRE;UBICACION;PRECIO", "Sin Teléfono;Centro;100.000.000"].join("\n");
    const crm = nuevo();
    await importarHoja("vendedores", hoja, { crm, inmuebles }, { simular: false });
    await importarHoja("vendedores", hoja, { crm, inmuebles }, { simular: false });
    expect(crm.contactos).toHaveLength(1);
    expect(crm.captaciones).toHaveLength(1);

    expect((await importarHoja("vendedores", "solo una línea", { crm, inmuebles }, { simular: true })).fatal).toMatch(/filas/);
    expect((await importarHoja("vendedores", "CELULAR;PRECIO\n300 111 2222;5", { crm, inmuebles }, { simular: true })).fatal).toMatch(/NOMBRE/);
  });
});
