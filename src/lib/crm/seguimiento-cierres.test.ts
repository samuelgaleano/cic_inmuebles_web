import { beforeEach, describe, expect, it } from "vitest";
import {
  aHoraLocalBogota,
  cierresPorMes,
  clasificarSeguimiento,
  diaBogota,
  diasDeAtraso,
  fechaDeSeguimiento,
  finDelDiaBogota,
  leerDia,
  validarCierre,
} from "./reglas";
import { CrmStoreError, MemoryCrmStore } from "./store";

// 23 nov 2026, 22:30 en Bogotá = 24 nov 03:30 UTC: el día calendario de Bogotá NO es el de UTC.
const NOCHE = new Date("2026-11-24T03:30:00.000Z");
// 23 nov 2026, 8:00 en Bogotá.
const MANANA = new Date("2026-11-23T13:00:00.000Z");

describe("próximo contacto: fechas en calendario de Bogotá", () => {
  it("el día de Bogotá no es el de UTC", () => {
    expect(diaBogota(NOCHE)).toBe("2026-11-23");
    expect(diaBogota("2026-11-23T05:00:00.000Z")).toBe("2026-11-23");
    expect(diaBogota("2026-11-23T04:59:59.999Z")).toBe("2026-11-22");
  });

  it("fechaDeSeguimiento: el día +N a las 9:00 de Bogotá (14:00 UTC)", () => {
    expect(fechaDeSeguimiento(1, MANANA)).toBe("2026-11-24T14:00:00.000Z");
    expect(fechaDeSeguimiento(3, NOCHE)).toBe("2026-11-26T14:00:00.000Z");
    expect(fechaDeSeguimiento(7, MANANA)).toBe("2026-11-30T14:00:00.000Z");
    // Cambio de mes y de año.
    expect(fechaDeSeguimiento(10, new Date("2026-12-28T15:00:00.000Z"))).toBe("2027-01-07T14:00:00.000Z");
    expect(fechaDeSeguimiento(0, MANANA)).toBe("2026-11-23T14:00:00.000Z");
  });

  it("clasificarSeguimiento por día calendario, no por hora", () => {
    // Fijado para hoy a las 9:00 y ya son las 22:30: sigue siendo "hoy", no vencido.
    expect(clasificarSeguimiento("2026-11-23T14:00:00.000Z", NOCHE)).toBe("hoy");
    // Ayer a las 23:00 de Bogotá (hoy 04:00 UTC): vencido.
    expect(clasificarSeguimiento("2026-11-23T04:00:00.000Z", MANANA)).toBe("vencido");
    // Mañana temprano: futuro, aunque en UTC ya sea "hoy".
    expect(clasificarSeguimiento("2026-11-24T06:00:00.000Z", NOCHE)).toBe("futuro");
    expect(diasDeAtraso("2026-11-20T14:00:00.000Z", MANANA)).toBe(3);
    expect(diasDeAtraso("2026-11-25T14:00:00.000Z", MANANA)).toBe(-2);
  });

  it("finDelDiaBogota es el último milisegundo de hoy en Bogotá", () => {
    expect(finDelDiaBogota(NOCHE)).toBe("2026-11-24T04:59:59.999Z");
    expect(finDelDiaBogota(MANANA)).toBe("2026-11-24T04:59:59.999Z");
  });

  it("aHoraLocalBogota da el valor del datetime-local", () => {
    expect(aHoraLocalBogota("2026-11-24T14:00:00.000Z")).toBe("2026-11-24T09:00");
  });
});

describe("validarCierre", () => {
  const ahora = MANANA;

  it("calcula la comisión pactada si no se escribe", () => {
    expect(validarCierre({ precio: "450.000.000", fecha: "2026-11-20", pct: "3" }, ahora)).toEqual({
      ok: true,
      valor: { precioVenta: 450_000_000, fechaCierre: "2026-11-20", comisionPct: 3, comisionPactada: 13_500_000 },
    });
    // 2,5 % de 333.333.333 = 8.333.333,325 → redondeada al peso.
    expect(validarCierre({ precio: "333333333", fecha: "2026-11-20", pct: "2,5" }, ahora)).toMatchObject({ ok: true, valor: { comisionPactada: 8_333_333 } });
  });

  it("respeta la comisión pactada escrita a mano y permite cierre sin porcentaje", () => {
    expect(validarCierre({ precio: "100000000", fecha: "2026-11-20", pct: "3", pactada: "2.000.000" }, ahora)).toMatchObject({ ok: true, valor: { comisionPactada: 2_000_000 } });
    const sinPct = validarCierre({ precio: "100000000", fecha: "2026-11-20", pct: "" }, ahora);
    expect(sinPct).toEqual({ ok: true, valor: { precioVenta: 100_000_000, fechaCierre: "2026-11-20" } });
  });

  it("rechaza precio vacío, cero o inválido", () => {
    for (const precio of ["", "0", "mucho", "-5"]) expect(validarCierre({ precio, fecha: "2026-11-20" }, ahora)).toMatchObject({ ok: false });
  });

  it("rechaza fechas irreales o en el futuro (más de un día)", () => {
    expect(validarCierre({ precio: "1", fecha: "2026-02-30" }, ahora)).toMatchObject({ ok: false });
    expect(validarCierre({ precio: "1", fecha: "23/11/2026" }, ahora)).toMatchObject({ ok: false });
    expect(validarCierre({ precio: "1", fecha: "2026-11-25" }, ahora)).toMatchObject({ ok: false });
    expect(validarCierre({ precio: "1", fecha: "2026-11-24" }, ahora)).toMatchObject({ ok: true });
    expect(validarCierre({ precio: "1", fecha: "1999-12-31" }, ahora)).toMatchObject({ ok: false });
  });

  it("rechaza porcentaje fuera de rango y comisión pactada inválida", () => {
    expect(validarCierre({ precio: "1000", fecha: "2026-11-20", pct: "120" }, ahora)).toMatchObject({ ok: false });
    expect(validarCierre({ precio: "1000", fecha: "2026-11-20", pactada: "dos" }, ahora)).toMatchObject({ ok: false });
  });

  it("leerDia solo acepta fechas reales", () => {
    expect(leerDia("2028-02-29")).toBe("2028-02-29");
    expect(leerDia("2026-02-29")).toBeNull();
    expect(leerDia("")).toBeNull();
  });
});

describe("cierresPorMes", () => {
  it("agrupa los últimos 6 meses (incluido el actual) y deja fuera lo más viejo", () => {
    const filas = cierresPorMes(
      [
        { fechaCierre: "2026-11-02", precioVenta: 300, comisionPactada: 9, comisionCobrada: 9 },
        { fechaCierre: "2026-11-20", precioVenta: 200, comisionPactada: 6 },
        { fechaCierre: "2026-06-30", precioVenta: 100, comisionPactada: 3 },
        { fechaCierre: "2026-05-31", precioVenta: 999 },
      ],
      MANANA,
    );
    expect(filas.map((f) => f.mes)).toEqual(["2026-11", "2026-10", "2026-09", "2026-08", "2026-07", "2026-06"]);
    expect(filas[0]).toEqual({ mes: "2026-11", cantidad: 2, valorVendido: 500, comisionPactada: 15, comisionCobrada: 9 });
    expect(filas[5]).toMatchObject({ cantidad: 1, valorVendido: 100 });
    expect(filas.reduce((s, f) => s + f.cantidad, 0)).toBe(3);
  });

  it("cruza el año", () => {
    expect(cierresPorMes([], new Date("2027-02-10T15:00:00.000Z"), 4).map((f) => f.mes)).toEqual(["2027-02", "2027-01", "2026-12", "2026-11"]);
  });
});

describe("MemoryCrmStore: próximo contacto", () => {
  let crm: MemoryCrmStore;
  beforeEach(() => {
    crm = new MemoryCrmStore();
  });

  it("fija, lista hasta una fecha (ordenado) y borra", async () => {
    const { contacto: ana } = await crm.crearContacto({ nombre: "Ana", origen: "manual" });
    const { contacto: beto } = await crm.crearContacto({ nombre: "Beto", origen: "manual" });
    const { contacto: caro } = await crm.crearContacto({ nombre: "Caro", origen: "manual" });
    await crm.fijarProximoContacto(ana.id, "2026-11-23T14:00:00.000Z", "  mandarle el de Cedritos  ");
    await crm.fijarProximoContacto(beto.id, "2026-11-20T14:00:00.000Z");
    await crm.fijarProximoContacto(caro.id, "2026-11-30T14:00:00.000Z", "visita");

    const hoy = await crm.listarSeguimientos(finDelDiaBogota(MANANA));
    expect(hoy.map((c) => c.nombre)).toEqual(["Beto", "Ana"]);
    expect(hoy[1].proximoContactoNota).toBe("mandarle el de Cedritos");
    expect((await crm.obtenerContacto(ana.id))?.proximoContactoAt).toBe("2026-11-23T14:00:00.000Z");

    await crm.fijarProximoContacto(ana.id, null, "se ignora");
    const ficha = await crm.obtenerContacto(ana.id);
    expect(ficha?.proximoContactoAt).toBeUndefined();
    expect(ficha?.proximoContactoNota).toBeUndefined();
    expect((await crm.listarSeguimientos(finDelDiaBogota(MANANA))).map((c) => c.nombre)).toEqual(["Beto"]);
  });

  it("no lista archivados y falla si el contacto no existe", async () => {
    const { contacto } = await crm.crearContacto({ nombre: "Ana", origen: "manual" });
    await crm.fijarProximoContacto(contacto.id, "2026-11-20T14:00:00.000Z");
    await crm.archivarContacto(contacto.id, true);
    expect(await crm.listarSeguimientos(finDelDiaBogota(MANANA))).toEqual([]);
    await expect(crm.fijarProximoContacto("00000000-0000-4000-8000-999999999999", "2026-11-20T14:00:00.000Z")).rejects.toBeInstanceOf(CrmStoreError);
  });

  it("cambiar la fecha reemplaza la nota anterior", async () => {
    const { contacto } = await crm.crearContacto({ nombre: "Ana", origen: "manual" });
    await crm.fijarProximoContacto(contacto.id, "2026-11-20T14:00:00.000Z", "vieja");
    await crm.fijarProximoContacto(contacto.id, "2026-11-21T14:00:00.000Z");
    expect((await crm.obtenerContacto(contacto.id))?.proximoContactoNota).toBeUndefined();
  });
});

describe("MemoryCrmStore: cierres", () => {
  let crm: MemoryCrmStore;
  let vendedor: string;
  let comprador: string;
  let captacionId: string;
  let busquedaId: string;

  beforeEach(async () => {
    crm = new MemoryCrmStore();
    crm.propiedadesValidas = new Set(["p1"]);
    vendedor = (await crm.crearContacto({ nombre: "Vera", origen: "manual" })).contacto.id;
    comprador = (await crm.crearContacto({ nombre: "Carlos", origen: "manual" })).contacto.id;
    captacionId = (
      await crm.crearCaptacion({ contactoId: vendedor, propertyId: "p1", precioEsperado: 400_000_000, comisionPct: 3, estatusPago: "pendiente", aprobada: true, multimedia: "listo", estado: "publicada" })
    ).id;
    busquedaId = (await crm.crearBusqueda({ contactoId: comprador, tipo: "comprador", potencial: true, estado: "activa" })).id;
  });

  it("registra, lista por vendedor, por comprador y por inmueble, y marca la comisión cobrada", async () => {
    const c = await crm.registrarCierre({
      captacionId,
      busquedaId,
      propertyId: "p1",
      vendedorContactoId: vendedor,
      compradorContactoId: comprador,
      precioVenta: 390_000_000,
      fechaCierre: "2026-11-20",
      comisionPct: 3,
      comisionPactada: 11_700_000,
    });
    expect(c).toMatchObject({ precioVenta: 390_000_000, comisionPactada: 11_700_000 });
    expect(c.comisionCobrada).toBeUndefined();
    expect(Object.keys(c)).not.toContain("notas");

    expect(await crm.listarCierres({ contactoId: vendedor })).toHaveLength(1);
    expect(await crm.listarCierres({ contactoId: comprador })).toHaveLength(1);
    expect(await crm.listarCierres({ propertyId: "p1" })).toHaveLength(1);
    expect(await crm.listarCierres({ contactoId: "00000000-0000-4000-8000-999999999999" })).toEqual([]);

    const cobrado = await crm.marcarComisionCobrada(c.id, 11_700_000, "2026-11-22");
    expect(cobrado).toMatchObject({ comisionCobrada: 11_700_000, cobradaAt: "2026-11-22" });
    expect((await crm.listarCierres())[0].comisionCobrada).toBe(11_700_000);
    expect(await crm.marcarComisionCobrada("00000000-0000-4000-8000-999999999999", 1, "2026-11-22")).toBeNull();
  });

  it("ordena del más reciente al más viejo", async () => {
    await crm.registrarCierre({ vendedorContactoId: vendedor, precioVenta: 1, fechaCierre: "2026-09-01" });
    await crm.registrarCierre({ vendedorContactoId: vendedor, precioVenta: 2, fechaCierre: "2026-11-01" });
    expect((await crm.listarCierres({ contactoId: vendedor })).map((c) => c.precioVenta)).toEqual([2, 1]);
  });

  it("aplica los chequeos de la tabla", async () => {
    await expect(crm.registrarCierre({ precioVenta: 0, fechaCierre: "2026-11-20" })).rejects.toBeInstanceOf(CrmStoreError);
    await expect(crm.registrarCierre({ precioVenta: 1, fechaCierre: "2026-11-20", comisionPct: 101 })).rejects.toBeInstanceOf(CrmStoreError);
    await expect(crm.registrarCierre({ precioVenta: 1, fechaCierre: "2026-11-20", propertyId: "no-existe" })).rejects.toBeInstanceOf(CrmStoreError);
    await expect(crm.registrarCierre({ precioVenta: 1, fechaCierre: "2026-11-20", vendedorContactoId: "00000000-0000-4000-8000-999999999999" })).rejects.toBeInstanceOf(CrmStoreError);
    await expect(crm.registrarCierre({ precioVenta: 1, fechaCierre: "2026-11-20", captacionId: "00000000-0000-4000-8000-999999999999" })).rejects.toBeInstanceOf(CrmStoreError);
    const ok = await crm.registrarCierre({ precioVenta: 1, fechaCierre: "2026-11-20" });
    await expect(crm.marcarComisionCobrada(ok.id, -1, "2026-11-22")).rejects.toBeInstanceOf(CrmStoreError);
  });
});
