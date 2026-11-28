import { describe, expect, it } from "vitest";
import {
  alcanceBusqueda,
  duracionLegible,
  embudoCompradores,
  embudoVendedores,
  esperaSinContactar,
  leadsPorInmueble,
  leadsPorOrigen,
  leerMes,
  medianaPrimeraRespuesta,
  mesesRecientes,
  origenDeLead,
  rangoDeMes,
} from "./reportes";

const ahora = new Date("2026-11-28T15:00:00.000Z");

describe("reportes del CRM", () => {
  it("lee el mes del selector y arma el rango en hora de Bogotá", () => {
    expect(leerMes("2026-11", ahora)).toBe("2026-11");
    expect(leerMes("2026-12", ahora)).toBeNull(); // futuro
    expect(leerMes("2026-13", ahora)).toBeNull();
    expect(leerMes("nov", ahora)).toBeNull();
    expect(leerMes(undefined, ahora)).toBeNull();
    expect(rangoDeMes("2026-11")).toEqual({ desde: "2026-11-01T05:00:00.000Z", hasta: "2026-12-01T05:00:00.000Z" });
    expect(rangoDeMes("2026-12")).toEqual({ desde: "2026-12-01T05:00:00.000Z", hasta: "2027-01-01T05:00:00.000Z" });
    expect(mesesRecientes(ahora, 3)).toEqual(["2026-11", "2026-10", "2026-09"]);
    // 1 de diciembre 04:00 UTC son las 11 p. m. del 30 de noviembre en Bogotá: todavía es noviembre.
    expect(mesesRecientes(new Date("2026-12-01T04:00:00.000Z"), 1)).toEqual(["2026-11"]);
  });

  it("embudo de vendedores: cada captación cuenta en su etapa y en las anteriores", () => {
    const e = embudoVendedores([{ estado: "nueva" }, { estado: "en_gestion" }, { estado: "publicada" }, { estado: "vendida" }, { estado: "vendida" }, { estado: "descartada" }]);
    expect(e.map((x) => [x.etapa, x.cantidad, x.pctDelInicio])).toEqual([
      ["Nuevas", 5, 100],
      ["En gestión", 4, 80],
      ["Publicadas", 3, 60],
      ["Vendidas", 2, 40],
    ]);
    expect(embudoVendedores([]).every((x) => x.cantidad === 0 && x.pctDelInicio === 0)).toBe(true);
  });

  it("embudo de compradores: propuesta, visita, oferta y cierre; lo descartado no cuenta", () => {
    expect(alcanceBusqueda("activa", [])).toBe(0);
    expect(alcanceBusqueda("activa", ["descartado"])).toBe(0);
    expect(alcanceBusqueda("en_visitas", ["propuesto", "visito"])).toBe(2);
    expect(alcanceBusqueda("activa", ["oferto"])).toBe(3);
    expect(alcanceBusqueda("cerrada", [])).toBe(4);
    expect(alcanceBusqueda("descartada", ["oferto"])).toBeNull();
    const e = embudoCompradores([
      { estado: "activa", propuestas: [] },
      { estado: "activa", propuestas: ["propuesto"] },
      { estado: "en_visitas", propuestas: ["visito"] },
      { estado: "cerrada", propuestas: ["oferto"] },
      { estado: "descartada", propuestas: ["visito"] },
    ]);
    expect(e.map((x) => x.cantidad)).toEqual([4, 3, 2, 1, 1]);
    expect(e.map((x) => x.etapa)).toEqual(["Activas", "Con propuesta", "Visitaron", "Ofertaron", "Cerradas"]);
  });

  it("origen del lead: utm, luego el sitio que lo refirió, luego directo", () => {
    expect(origenDeLead({ utmSource: "Instagram" })).toBe("instagram");
    expect(origenDeLead({ referente: "https://www.google.com/search?q=x" })).toBe("google.com");
    expect(origenDeLead({ referente: "l.facebook.com" })).toBe("l.facebook.com");
    expect(origenDeLead({ utmSource: "  ", referente: "" })).toBe("directo");
    expect(origenDeLead({})).toBe("directo");
  });

  it("cuenta leads por origen y por inmueble sin los descartados", () => {
    const leads = [
      { estado: "nuevo" as const, utmSource: "instagram", propertyId: "p1" },
      { estado: "contactado" as const, utmSource: "instagram", propertySlug: "casa" },
      { estado: "nuevo" as const, propertyId: "p1" },
      { estado: "descartado" as const, utmSource: "tiktok", propertyId: "p2" },
      { estado: "nuevo" as const },
    ];
    expect(leadsPorOrigen(leads)).toEqual([
      { clave: "directo", cantidad: 2 },
      { clave: "instagram", cantidad: 2 },
    ]);
    expect(leadsPorInmueble(leads)).toEqual([
      { clave: "p1", cantidad: 2 },
      { clave: "", cantidad: 1 },
      { clave: "casa", cantidad: 1 },
    ]);
  });

  it("mediana del tiempo de primera respuesta, sin descartados ni los que no se han contactado", () => {
    const base = "2026-11-10T10:00:00.000Z";
    const en = (min: number) => new Date(new Date(base).getTime() + min * 60000).toISOString();
    expect(medianaPrimeraRespuesta([])).toBeNull();
    expect(medianaPrimeraRespuesta([{ estado: "nuevo", creadoEn: base }])).toBeNull();
    expect(
      medianaPrimeraRespuesta([
        { estado: "contactado", creadoEn: base, primerContactoAt: en(10) },
        { estado: "contactado", creadoEn: base, primerContactoAt: en(30) },
        { estado: "en_proceso", creadoEn: base, primerContactoAt: en(240) },
        { estado: "descartado", creadoEn: base, primerContactoAt: en(5) },
        { estado: "nuevo", creadoEn: base },
      ]),
    ).toEqual({ minutos: 30, muestra: 3 });
    expect(medianaPrimeraRespuesta([
      { estado: "contactado", creadoEn: base, primerContactoAt: en(10) },
      { estado: "contactado", creadoEn: base, primerContactoAt: en(20) },
    ])).toEqual({ minutos: 15, muestra: 2 });
  });

  it("antigüedad de los leads sin contactar", () => {
    expect(duracionLegible(45)).toBe("45 min");
    expect(duracionLegible(190)).toBe("3 h 10 min");
    expect(duracionLegible(120)).toBe("2 h");
    expect(duracionLegible(60 * 24 + 60 * 4)).toBe("1 día 4 h");
    expect(duracionLegible(60 * 48)).toBe("2 días");
    const hace = (min: number) => new Date(ahora.getTime() - min * 60000).toISOString();
    expect(esperaSinContactar({ estado: "nuevo", creadoEn: hace(20) }, ahora)).toEqual({ minutos: 20, texto: "Sin contactar hace 20 min", nivel: "reciente" });
    expect(esperaSinContactar({ estado: "nuevo", creadoEn: hace(300) }, ahora)?.nivel).toBe("atrasado");
    expect(esperaSinContactar({ estado: "nuevo", creadoEn: hace(60 * 30) }, ahora)?.nivel).toBe("urgente");
    expect(esperaSinContactar({ estado: "contactado", creadoEn: hace(300) }, ahora)).toBeNull();
    expect(esperaSinContactar({ estado: "nuevo", creadoEn: hace(300), primerContactoAt: hace(200) }, ahora)).toBeNull();
  });
});
