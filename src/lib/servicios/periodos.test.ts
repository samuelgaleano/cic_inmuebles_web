import { describe, expect, it } from "vitest";
import { MemoryCrmStore } from "@/lib/crm/store";
import { sincronizarTodo, vincularLead, vincularServicio } from "@/lib/crm/vinculos";
import type { Lead } from "@/lib/domain";
import { MemoryServiciosStore } from "./store";
import { diasDePeriodo, ventanaDeActivacion, ventanaDeRenovacion } from "./vigencia";

const AHORA = new Date("2026-10-18T04:33:53.000Z");
const DIA = 86_400_000;

async function servicioPagado(store: MemoryServiciosStore) {
  const { servicio } = await store.registrar({
    txId: "1446679-1792296260-41495",
    reference: "CIC-alianza-90-595037-1792296218150",
    planId: "alianza-90",
    dias: 90,
    clienteEmail: "samuel.galeano.alvis@gmail.com",
    clienteNombre: "galeano alvis",
    clienteTelefono: "573012679392",
    pagadoAt: "2026-10-18T04:08:00.000Z",
  });
  return servicio;
}

describe("libro de periodos de un plan (el caso real de galeano alvis)", () => {
  it("guarda cuándo se pagó de verdad, distinto de cuándo se registró", async () => {
    const store = new MemoryServiciosStore();
    store.now = () => new Date("2026-10-18T04:14:26.000Z").getTime();
    const s = await servicioPagado(store);
    expect(s.pagadoAt).toBe("2026-10-18T04:08:00.000Z");
    expect(s.createdAt).toBe("2026-10-18T04:14:26.000Z");
  });

  it("activar, sumar a mano y «Vencer ahora» dejan cada tramo, con su origen y sus fechas", async () => {
    const store = new MemoryServiciosStore();
    const s = await servicioPagado(store);

    const v = ventanaDeActivacion(AHORA, s.dias);
    await store.activar(s.id, { propertySlug: null, inicioAt: v.inicioAt, venceAt: v.venceAt });
    const suma = ventanaDeRenovacion({ venceAt: v.venceAt, dias: s.dias }, AHORA);
    await store.renovar(s.id, suma, v.venceAt, { tipo: "suma_manual" });
    const corte = new Date(AHORA.getTime() + 0.05 * DIA);
    await store.marcarVencido(s.id, { forzar: true, ahora: corte });

    const p = await store.periodos(s.id);
    expect(p.map((x) => x.tipo)).toEqual(["activacion", "suma_manual", "recorte"]);
    expect(p[0]).toMatchObject({ desde: "2026-10-18T04:33:53.000Z", hasta: "2027-01-16T04:33:53.000Z", txId: s.txId });
    expect(diasDePeriodo(p[0])).toBe(90);
    expect(p[1]).toMatchObject({ desde: "2027-01-16T04:33:53.000Z", hasta: "2027-04-16T04:33:53.000Z" });
    expect(diasDePeriodo(p[1])).toBe(90);
    // El recorte guarda el tiempo que se quitó: desde el momento del corte hasta lo que le quedaba
    expect(p[2]).toMatchObject({ tipo: "recorte", desde: corte.toISOString(), hasta: "2027-04-16T04:33:53.000Z" });
    expect((await store.obtener(s.id))?.estado).toBe("vencido");
  });

  it("una renovación pagada queda con su transacción; absorber un plan viejo no se anota como recorte", async () => {
    const store = new MemoryServiciosStore();
    const s = await servicioPagado(store);
    const v = ventanaDeActivacion(AHORA, 90);
    await store.activar(s.id, { inicioAt: v.inicioAt, venceAt: v.venceAt });
    const ren = ventanaDeRenovacion({ venceAt: v.venceAt, dias: 90 }, AHORA);
    await store.renovar(s.id, ren, v.venceAt, { tipo: "renovacion", txId: "tx-ren-1" });
    expect((await store.periodos(s.id)).at(-1)).toMatchObject({ tipo: "renovacion", txId: "tx-ren-1" });

    await store.marcarVencido(s.id, { forzar: true, ahora: AHORA, sinPeriodo: true });
    expect((await store.periodos(s.id)).map((x) => x.tipo)).toEqual(["activacion", "renovacion"]);
  });

  it("un servicio vencido que se renueva empieza el tramo nuevo ahora; uno con vencimiento previo, donde terminaba", async () => {
    const store = new MemoryServiciosStore();
    const s = await servicioPagado(store);
    const v = ventanaDeActivacion(AHORA, 30);
    await store.activar(s.id, { inicioAt: v.inicioAt, venceAt: v.venceAt });
    const mucho = new Date(AHORA.getTime() + 60 * DIA);
    await store.marcarVencido(s.id, { ahora: mucho }); // venció por su fecha (no es recorte)
    const ren = ventanaDeRenovacion({ venceAt: v.venceAt, dias: 30 }, mucho);
    await store.renovar(s.id, ren, v.venceAt, { tipo: "renovacion", txId: "t2" });
    const p = await store.periodos(s.id);
    expect(p.map((x) => x.tipo)).toEqual(["activacion", "renovacion"]);
    expect(p[1].desde).toBe(mucho.toISOString()); // empezó el día que renovó, no el del vencimiento viejo
  });
});

describe("llaves foráneas entre el plan, el lead y la persona del CRM", () => {
  const lead: Lead = {
    id: "lead-1",
    tipo: "comprador",
    nombre: "galeano alvis",
    telefono: "+57 301 267 9392",
    email: "samuel.galeano.alvis@gmail.com",
    fuente: "web",
    estado: "nuevo",
    creadoEn: "2026-07-06T21:41:00.000Z",
  };

  it("el lead y el plan pagado de la misma persona apuntan a un único contacto", async () => {
    const crm = new MemoryCrmStore();
    const servicios = new MemoryServiciosStore();
    const s = await servicioPagado(servicios);

    const l = await vincularLead(crm, lead);
    await vincularServicio(crm, s, (id, contactoId) => servicios.asignarContacto(id, contactoId));

    expect(crm.contactos).toHaveLength(1);
    expect(await crm.leadsDeContacto(l!.contactoId)).toEqual(["lead-1"]);
    expect((await servicios.obtener(s.id))?.contactoId).toBe(l!.contactoId);
  });

  it("un plan descartado (prueba) queda enlazado a su persona como historia, sin sumar al seguimiento", async () => {
    const crm = new MemoryCrmStore();
    const servicios = new MemoryServiciosStore();
    const s = await servicioPagado(servicios);
    await servicios.activar(s.id, { inicioAt: AHORA.toISOString(), venceAt: new Date(AHORA.getTime() + DIA).toISOString() });
    await servicios.marcarVencido(s.id, { forzar: true, ahora: AHORA, sinPeriodo: true });
    await servicios.descartar(s.id);

    const descartado = (await servicios.obtener(s.id))!;
    expect(await vincularServicio(crm, descartado, (id, c) => servicios.asignarContacto(id, c))).toBe("sin_datos");
    expect((await servicios.obtener(s.id))?.contactoId).toBe(crm.contactos[0].id);
    expect(crm.actividades).toHaveLength(0);
  });

  it("sincronizarTodo enlaza lo que ya existía, sin duplicar contactos", async () => {
    const crm = new MemoryCrmStore();
    const servicios = new MemoryServiciosStore();
    const s = await servicioPagado(servicios);
    const datos = { propiedades: [], leads: [lead], servicios: [s] };
    const opciones = { asignarContactoAServicio: (id: string, c: string) => servicios.asignarContacto(id, c) };

    await sincronizarTodo(crm, datos, opciones);
    await sincronizarTodo(crm, datos, opciones);

    expect(crm.contactos).toHaveLength(1);
    expect((await servicios.obtener(s.id))?.contactoId).toBe(crm.contactos[0].id);
    expect(await crm.leadsDeContacto(crm.contactos[0].id)).toEqual(["lead-1"]);
    expect(crm.actividades.filter((a) => a.detalle.includes("[servicio:"))).toHaveLength(1);
  });
});
