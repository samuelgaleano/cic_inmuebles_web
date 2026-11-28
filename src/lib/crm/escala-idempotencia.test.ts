import { beforeEach, describe, expect, it } from "vitest";
import type { Appointment, Lead } from "@/lib/domain";
import { MemoryCrmStore, NOMBRE_SUPRIMIDO, TEXTO_SUPRIMIDO, filtrarContactos, paginaYTamano } from "./store";
import { registrarVisitaRealizada } from "./visitas";
import { vincularLead, vincularServicio } from "./vinculos";
import type { Servicio } from "@/lib/servicios/vigencia";

/** Listados paginados, «Por hacer» por consulta, llaves de idempotencia, visitas unificadas y supresión (0013). */

const base = { comisionPct: 3, estatusPago: "pendiente" as const, aprobada: false, multimedia: "por_coordinar" as const, estado: "nueva" as const };

function lead(extra: Partial<Lead> = {}): Lead {
  return { id: "l1", tipo: "comprador", nombre: "Luis Gómez", telefono: "+57 311 555 2020", fuente: "web", estado: "nuevo", creadoEn: "2026-10-01T10:00:00.000Z", ...extra };
}

let crm: MemoryCrmStore;
let reloj: number;
beforeEach(() => {
  crm = new MemoryCrmStore();
  crm.propiedadesValidas = new Set(["p1", "p2", "p3"]);
  reloj = Date.parse("2026-11-01T12:00:00.000Z");
  // Cada registro un minuto después del anterior: el orden «más nuevo primero» es determinista.
  crm.now = () => (reloj += 60_000);
});

async function persona(nombre: string, telefono?: string) {
  return (await crm.crearContacto({ nombre, origen: "manual", ...(telefono ? { telefono, telefonoE164: `+57${telefono.replace(/\D/g, "")}` } : {}) })).contacto;
}

describe("listado paginado de contactos", () => {
  it("normaliza página y tamaño", () => {
    expect(paginaYTamano({})).toEqual({ pagina: 1, porPagina: 50, desde: 0 });
    expect(paginaYTamano({ pagina: 3, porPagina: 20 })).toEqual({ pagina: 3, porPagina: 20, desde: 40 });
    expect(paginaYTamano({ pagina: -2, porPagina: 9999 })).toEqual({ pagina: 1, porPagina: 200, desde: 0 });
    expect(paginaYTamano({ pagina: Number.NaN })).toEqual({ pagina: 1, porPagina: 50, desde: 0 });
  });

  it("pagina de 50 en 50, más nuevos primero, con el total", async () => {
    for (let i = 0; i < 120; i++) await persona(`Persona ${String(i).padStart(3, "0")}`);
    const p1 = await crm.paginaContactos({});
    expect(p1.total).toBe(120);
    expect(p1.filas).toHaveLength(50);
    expect(p1.filas[0].nombre).toBe("Persona 119");
    const p3 = await crm.paginaContactos({ pagina: 3 });
    expect(p3.filas).toHaveLength(20);
    expect(p3.filas.at(-1)?.nombre).toBe("Persona 000");
    expect((await crm.paginaContactos({ pagina: 9 })).filas).toEqual([]);
  });

  it("filtra por tipo, origen, sin próximo contacto y texto", async () => {
    const vende = await persona("Marta Vende", "300 111 0001");
    const compra = await persona("Pedro Compra", "300 111 0002");
    const nada = await crm.crearContacto({ nombre: "Ana Nada", origen: "web" });
    await crm.crearCaptacion({ ...base, contactoId: vende.id });
    await crm.crearBusqueda({ contactoId: compra.id, tipo: "comprador", potencial: false, estado: "activa" });
    // Una búsqueda descartada no lo vuelve comprador.
    await crm.crearBusqueda({ contactoId: vende.id, tipo: "comprador", potencial: false, estado: "descartada" });
    await crm.fijarProximoContacto(compra.id, "2026-12-01T14:00:00.000Z");
    const nombres = async (f: Parameters<MemoryCrmStore["paginaContactos"]>[0]) => (await crm.paginaContactos(f)).filas.map((c) => c.nombre).sort();
    expect(await nombres({ tipo: "vendedor" })).toEqual(["Marta Vende"]);
    expect(await nombres({ tipo: "comprador" })).toEqual(["Pedro Compra"]);
    expect(await nombres({ origen: "web" })).toEqual(["Ana Nada"]);
    expect(await nombres({ sinProximo: true })).toEqual(["Ana Nada", "Marta Vende"]);
    expect(await nombres({ q: "111 0002" })).toEqual(["Pedro Compra"]);
    await crm.archivarContacto(nada.contacto.id, true);
    expect(await nombres({ origen: "web" })).toEqual([]);
    expect(await nombres({ origen: "web", incluirArchivados: true })).toEqual(["Ana Nada"]);
    // La misma regla sirve de respaldo en Supabase sin la vista.
    const todos = await crm.listarContactos({ incluirArchivados: true });
    expect(filtrarContactos(todos, { tipo: "vendedor" }).map((c) => c.id)).toEqual([vende.id]);
  });
});

describe("«Por hacer» y pestañas sin leer tablas completas", () => {
  it("cuenta cada grupo y nombra a los primeros, sin los archivados", async () => {
    const a = await persona("Ana", "300 222 0001");
    const b = await persona("Beto", "300 222 0002");
    const c = await persona("Caro", "300 222 0003");
    const archivada = await persona("Dora", "300 222 0004");
    for (const x of [a, b, c, archivada]) await crm.crearCaptacion({ ...base, contactoId: x.id });
    await crm.crearCaptacion({ ...base, contactoId: a.id, aprobada: true, estatusPago: "paga_completo", multimedia: "listo" });
    await crm.crearCaptacion({ ...base, contactoId: b.id, estado: "vendida" });
    const bus = await crm.crearBusqueda({ contactoId: c.id, tipo: "comprador", potencial: false, estado: "activa" });
    await crm.crearBusqueda({ contactoId: b.id, tipo: "comprador", potencial: false, estado: "en_visitas" });
    await crm.proponer(bus.id, "p1");
    await crm.registrarActividad({ contactoId: a.id, tipo: "nota", detalle: "hola" });
    await crm.archivarContacto(archivada.id, true);

    const p = await crm.pendientes(2);
    expect(p.porAprobar.total).toBe(3);
    expect(p.porAprobar.items.map((i) => i.nombre)).toEqual(["Caro", "Beto"]);
    expect(p.pagoPendiente.total).toBe(3);
    expect(p.multimedia.total).toBe(3);
    expect(p.sinPropuestas.items.map((i) => i.nombre)).toEqual(["Beto"]);
    expect(p.sinSeguimiento.total).toBe(2); // Beto y Caro (Ana tiene actividad; Dora está archivada)
    expect(p.totales).toEqual({ contactos: 3, vendedores: 4, compradores: 2 });
    expect(p.porAprobar.items[0].telefono).toBe("300 222 0003");
  });

  it("captaciones y búsquedas paginadas con su persona y el conteo de propuestas", async () => {
    const a = await persona("Ana", "300 333 0001");
    const archivada = await persona("Dora", "300 333 0002");
    await crm.crearCaptacion({ ...base, contactoId: a.id });
    await crm.crearCaptacion({ ...base, contactoId: archivada.id });
    const b = await crm.crearBusqueda({ contactoId: a.id, tipo: "comprador", potencial: false, estado: "activa" });
    await crm.proponer(b.id, "p1");
    await crm.proponer(b.id, "p2");
    await crm.archivarContacto(archivada.id, true);
    const caps = await crm.paginaCaptaciones({});
    expect(caps.total).toBe(1);
    expect(caps.filas[0].contacto).toEqual({ id: a.id, nombre: "Ana", telefono: "300 333 0001", archivado: false });
    const bus = await crm.paginaBusquedas({});
    expect(bus.filas[0].propuestas).toBe(2);
  });

  it("propuestas de unos inmuebles con su comprador (consulta por inmueble)", async () => {
    const a = await persona("Ana");
    const b = await persona("Beto");
    const ba = await crm.crearBusqueda({ contactoId: a.id, tipo: "comprador", potencial: false, estado: "activa" });
    const bb = await crm.crearBusqueda({ contactoId: b.id, tipo: "comprador", potencial: false, estado: "descartada" });
    await crm.proponer(ba.id, "p1");
    await crm.proponer(bb.id, "p1");
    await crm.proponer(ba.id, "p2");
    const r = await crm.propuestasDeInmuebles(["p1"]);
    expect(r.map((x) => [x.contacto.nombre, x.estadoBusqueda]).sort()).toEqual([
      ["Ana", "activa"],
      ["Beto", "descartada"],
    ]);
    expect(await crm.propuestasDeInmuebles([])).toEqual([]);
    expect((await crm.contactosPorId([a.id, "otro"])).map((c) => c.nombre)).toEqual(["Ana"]);
  });
});

describe("idempotencia por llave (0013) y su respaldo por marca", () => {
  for (const sin0013 of [false, true]) {
    it(`pasar el mismo lead dos veces no duplica nada ${sin0013 ? "(sin 0013: por marca)" : "(con 0013: por llave)"}`, async () => {
      crm.sin0013 = sin0013;
      const l = lead({ propertyId: "p1", mensaje: "Me interesa" });
      expect(await vincularLead(crm, l)).toMatchObject({ nuevo: true });
      expect(await vincularLead(crm, l)).toMatchObject({ nuevo: false });
      expect(crm.busquedas).toHaveLength(1);
      expect(crm.actividades).toHaveLength(1);
      expect(crm.actividades[0].detalle).toContain("[lead:l1]");
      const v = lead({ id: "l2", tipo: "vendedor", telefono: "+57 300 999 0000", nombre: "Marta" });
      await vincularLead(crm, v);
      await vincularLead(crm, v);
      expect(crm.captaciones).toHaveLength(1);
    });
  }

  it("con la llave, la nota del lead se reconoce aunque se haya borrado su texto", async () => {
    const l = lead();
    const r = await vincularLead(crm, l);
    crm.actividades[0].detalle = "(editado)";
    expect(await vincularLead(crm, l)).toEqual({ contactoId: r!.contactoId, nuevo: false });
    expect(crm.busquedas).toHaveLength(1);
  });

  it("si la nota falló después de crear la búsqueda, el reintento reutiliza la búsqueda del lead", async () => {
    const l = lead();
    const original = crm.registrarActividadUnica.bind(crm);
    crm.registrarActividadUnica = async () => {
      throw new Error("red caída");
    };
    await expect(vincularLead(crm, l)).rejects.toThrow("red caída");
    crm.registrarActividadUnica = original;
    expect(await vincularLead(crm, l)).toMatchObject({ nuevo: true });
    expect(crm.busquedas).toHaveLength(1);
    expect(crm.actividades).toHaveLength(1);
  });

  it("un plan pagado queda una sola vez en la línea de tiempo", async () => {
    const s = { id: "s1", txId: "tx", reference: null, planId: "alianza-90", dias: 90, clienteEmail: "ana@agencia.co", clienteNombre: "Ana Agente", clienteTelefono: null, estado: "activo", propertySlug: null, inicioAt: null, venceAt: null, aviso7dAt: null, aviso1dAt: null, avisoVencidoAt: null, createdAt: "2026-10-17T04:14:26.000Z" } as unknown as Servicio;
    expect(await vincularServicio(crm, s)).toBe("creado");
    expect(await vincularServicio(crm, s)).toBe("existia");
    expect(crm.actividades).toHaveLength(1);
  });

  it("un lead suprimido no vuelve a entrar al CRM", async () => {
    expect(await vincularLead(crm, lead({ suprimidoAt: "2026-11-20T10:00:00.000Z" }))).toBeNull();
    expect(crm.contactos).toHaveLength(0);
  });
});

describe("visitas unificadas", () => {
  function cita(extra: Partial<Appointment> = {}): Appointment {
    return { id: "c1", propertyId: "p1", clienteNombre: "Luis Gómez", clienteTelefono: "+57 311 555 2020", inicioEn: "2026-11-20T20:00:00.000Z", duracionMin: 60, estado: "realizada", creadoEn: "2026-11-19T10:00:00.000Z", ...extra };
  }

  it("la cita realizada queda como visita y la propuesta pasa a «visitó», una sola vez", async () => {
    const r = await vincularLead(crm, lead({ propertyId: "p1" }));
    const inmueble = { id: "p1", codigo: "1006", titulo: "Apto Cedritos" };
    const v = await registrarVisitaRealizada(crm, cita({ contactoId: r!.contactoId }), inmueble);
    expect(v).toEqual({ contactoId: r!.contactoId, actividadNueva: true, propuesta: "visito" });
    expect((await crm.listarPropuestas())[0].estado).toBe("visito");
    expect(crm.busquedas[0].estado).toBe("en_visitas");
    const visita = (await crm.listarActividades(r!.contactoId)).find((a) => a.tipo === "visita");
    expect(visita).toMatchObject({ propertyId: "p1", ocurrioEn: "2026-11-20T20:00:00.000Z" });
    expect(visita!.detalle).toContain("Visitó 1006 («Apto Cedritos»)");
    // Marcarla de nuevo no duplica.
    expect(await registrarVisitaRealizada(crm, cita({ contactoId: r!.contactoId }), inmueble)).toMatchObject({ actividadNueva: false, propuesta: "ya_avanzada" });
    expect((await crm.listarActividades(r!.contactoId)).filter((a) => a.tipo === "visita")).toHaveLength(1);
  });

  it("no retrocede una propuesta que ya ofertó y propone el inmueble si no estaba", async () => {
    const r = await vincularLead(crm, lead({ propertyId: "p1" }));
    const b = crm.busquedas[0];
    await crm.cambiarEstadoPropuesta(b.id, "p1", "oferto");
    expect((await registrarVisitaRealizada(crm, cita({ contactoId: r!.contactoId })))!.propuesta).toBe("ya_avanzada");
    expect((await crm.listarPropuestas())[0].estado).toBe("oferto");
    expect((await registrarVisitaRealizada(crm, cita({ id: "c2", contactoId: r!.contactoId, propertyId: "p2" })))!.propuesta).toBe("propuesta_creada");
    expect((await crm.listarPropuestas([b.id])).find((p) => p.propertyId === "p2")?.estado).toBe("visito");
  });

  it("sin persona en la cita, la ubica por teléfono (o la crea) y sin búsqueda no inventa una", async () => {
    const v = await registrarVisitaRealizada(crm, cita({ clienteNombre: "Nueva Persona", clienteTelefono: "300 444 0000" }));
    expect(v?.propuesta).toBe("sin_busqueda");
    expect(crm.contactos.map((c) => c.nombre)).toEqual(["Nueva Persona"]);
    expect(crm.busquedas).toHaveLength(0);
  });
});

describe("supresión de datos (Ley 1581)", () => {
  it("anonimiza al contacto y el texto de su línea de tiempo, y conserva montos", async () => {
    const c = await persona("Marta Pérez", "300 555 0001");
    await crm.actualizarContacto(c.id, { email: "marta@ejemplo.co", ciudad: "Bogotá", notas: "Vive en la calle 100" });
    await crm.fijarProximoContacto(c.id, "2026-12-01T14:00:00.000Z", "llamar");
    const cap = await crm.crearCaptacion({ ...base, contactoId: c.id, propertyId: "p1", precioEsperado: 400_000_000, notas: "Su hija decide" });
    await crm.crearBusqueda({ contactoId: c.id, tipo: "comprador", potencial: false, estado: "activa", especificacion: "cerca al colegio de su hijo", notas: "x" });
    await crm.registrarActividad({ contactoId: c.id, tipo: "llamada", detalle: "Me contó que se divorcia" });
    await crm.registrarCierre({ captacionId: cap.id, propertyId: "p1", vendedorContactoId: c.id, precioVenta: 390_000_000, fechaCierre: "2026-11-10", comisionPct: 3, comisionPactada: 11_700_000, notas: "Pagó en efectivo" });

    const r = await crm.suprimirContacto(c.id, "2026-11-28T15:00:00.000Z");
    expect(r.actividades).toBe(1);
    const s = (await crm.obtenerContacto(c.id))!;
    expect(s).toMatchObject({ nombre: NOMBRE_SUPRIMIDO, archivado: true });
    for (const k of ["telefono", "telefonoE164", "email", "ciudad", "notas", "proximoContactoAt", "proximoContactoNota"] as const) expect(s[k]).toBeUndefined();
    const [a] = await crm.listarActividades(c.id);
    expect(a).toMatchObject({ tipo: "llamada", detalle: TEXTO_SUPRIMIDO });
    expect(crm.captaciones[0].notas).toBeUndefined();
    expect(crm.captaciones[0].precioEsperado).toBe(400_000_000);
    expect(crm.busquedas[0].especificacion).toBeUndefined();
    const [ci] = await crm.listarCierres();
    expect(ci).toMatchObject({ precioVenta: 390_000_000, comisionPactada: 11_700_000 });
    expect(ci.notas).toBeUndefined();
    // Otra persona con el mismo teléfono ya no se fusiona con la suprimida.
    expect((await crm.crearContacto({ nombre: "Marta Pérez", telefono: "300 555 0001", telefonoE164: "+573005550001", origen: "web" })).creado).toBe(true);
  });
});

describe("embudo del mes", () => {
  it("solo lo creado en el rango y sin descartados, con los estados de sus propuestas", async () => {
    const c = await persona("Ana");
    await crm.crearCaptacion({ ...base, contactoId: c.id, estado: "publicada" });
    await crm.crearCaptacion({ ...base, contactoId: c.id, estado: "descartada" });
    const b = await crm.crearBusqueda({ contactoId: c.id, tipo: "comprador", potencial: false, estado: "activa" });
    await crm.proponer(b.id, "p1");
    await crm.cambiarEstadoPropuesta(b.id, "p1", "visito");
    const d = await crm.datosEmbudo("2026-11-01T05:00:00.000Z", "2026-12-01T05:00:00.000Z");
    expect(d).toEqual({ captaciones: [{ estado: "publicada" }], busquedas: [{ estado: "activa", propuestas: ["visito"] }] });
    expect(await crm.datosEmbudo("2026-10-01T05:00:00.000Z", "2026-11-01T05:00:00.000Z")).toEqual({ captaciones: [], busquedas: [] });
  });
});
