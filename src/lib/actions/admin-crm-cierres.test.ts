import { beforeEach, describe, expect, it, vi } from "vitest";
import type { Property } from "@/lib/domain";
import { CrmNoDisponibleError, CrmStoreError, MemoryCrmStore } from "@/lib/crm/store";

/** Acciones del CRM para próximo contacto y ventas: lo que escriben en el CRM y en el catálogo. */

const { estado, redirigir, revalidatePath, revalidateTag, actualizarInmueble } = vi.hoisted(() => ({
  estado: { crm: null as unknown, inmuebles: [] as Property[] },
  redirigir: vi.fn((url: string) => {
    throw new Error(`NEXT_REDIRECT:${url}`);
  }),
  revalidatePath: vi.fn(),
  revalidateTag: vi.fn(),
  actualizarInmueble: vi.fn(),
}));

vi.mock("@/lib/auth", () => ({ exigirAdmin: async () => ({ email: "jefe@cic.com" }) }));
vi.mock("next/navigation", () => ({ redirect: redirigir, unstable_rethrow: (e: unknown) => {
  if (e instanceof Error && e.message.startsWith("NEXT_REDIRECT")) throw e;
} }));
vi.mock("next/cache", () => ({ revalidatePath, revalidateTag }));
vi.mock("@/lib/crm/store", async (original) => ({ ...(await original<typeof import("@/lib/crm/store")>()), getCrmStore: () => estado.crm }));
vi.mock("@/lib/integrations/sheets", () => ({ isSheetsConfigured: () => false, syncPropertyToSheet: async () => undefined }));
vi.mock("@/lib/data", () => ({
  getRepository: () => ({
    properties: {
      list: async () => estado.inmuebles,
      getById: async (id: string) => estado.inmuebles.find((p) => p.id === id) ?? null,
      update: async (id: string, patch: Partial<Property>) => {
        actualizarInmueble(id, patch);
        const p = estado.inmuebles.find((x) => x.id === id);
        if (!p) return null;
        Object.assign(p, patch);
        return p;
      },
    },
  }),
}));

const acciones = await import("./admin-crm");

function form(campos: Record<string, string>): FormData {
  const fd = new FormData();
  for (const [k, v] of Object.entries(campos)) fd.set(k, v);
  return fd;
}

function inmueble(id: string): Property {
  return {
    id,
    codigo: "1006",
    slug: "apto-cedritos",
    titulo: "Apartamento en Cedritos",
    tipo: "apartamento",
    estado: "disponible",
    precio: 400_000_000,
    ubicacion: { ciudad: "Bogotá", sector: "Cedritos" },
    caracteristicas: {},
    descripcion: "",
    medios: [],
    destacado: false,
    publicado: true,
    creadoEn: "2026-01-01T00:00:00.000Z",
    actualizadoEn: "2026-01-01T00:00:00.000Z",
  };
}

let crm: MemoryCrmStore;
let vendedor: string;
let comprador: string;
let captacionId: string;
let busquedaId: string;
const PROP = "11111111-1111-4111-8111-111111111111";

beforeEach(async () => {
  crm = new MemoryCrmStore();
  estado.crm = crm;
  estado.inmuebles = [inmueble(PROP)];
  redirigir.mockClear();
  revalidatePath.mockClear();
  revalidateTag.mockClear();
  actualizarInmueble.mockClear();
  vendedor = (await crm.crearContacto({ nombre: "Vera", origen: "manual" })).contacto.id;
  comprador = (await crm.crearContacto({ nombre: "Carlos", origen: "manual" })).contacto.id;
  captacionId = (
    await crm.crearCaptacion({ contactoId: vendedor, propertyId: PROP, precioEsperado: 400_000_000, comisionPct: 3, estatusPago: "pendiente", aprobada: true, multimedia: "listo", estado: "publicada" })
  ).id;
  busquedaId = (await crm.crearBusqueda({ contactoId: comprador, tipo: "comprador", potencial: true, estado: "en_visitas" })).id;
  await crm.proponer(busquedaId, PROP);
  await crm.cambiarEstadoPropuesta(busquedaId, PROP, "visito");
});

const hoy = () => new Date(Date.now() - 5 * 3_600_000).toISOString().slice(0, 10);

describe("registrarCierreAction", () => {
  it("crea el cierre, vende captación e inmueble, cierra la búsqueda y anota en ambos", async () => {
    await acciones.registrarCierreAction(
      form({ captacionId, contactoId: vendedor, precio: "390.000.000", fecha: hoy(), pct: "3", comprador: `${busquedaId}|${comprador}`, notas: "Notaría 5" }),
    );
    const [cierre] = await crm.listarCierres();
    expect(cierre).toMatchObject({ captacionId, busquedaId, propertyId: PROP, vendedorContactoId: vendedor, compradorContactoId: comprador, precioVenta: 390_000_000, comisionPactada: 11_700_000, notas: "Notaría 5" });
    expect((await crm.listarCaptaciones(vendedor))[0].estado).toBe("vendida");
    expect(actualizarInmueble).toHaveBeenCalledWith(PROP, { estado: "vendido" });
    expect(revalidateTag).toHaveBeenCalled(); // inventario público vencido
    expect(revalidatePath).toHaveBeenCalledWith("/inmuebles/apto-cedritos");
    expect((await crm.listarBusquedas(comprador))[0].estado).toBe("cerrada");
    expect((await crm.listarPropuestas([busquedaId]))[0].estado).toBe("oferto");
    expect((await crm.listarActividades(vendedor))[0].detalle).toContain("Venta registrada");
    expect((await crm.listarActividades(comprador))[0].detalle).toContain("Compró el inmueble 1006");
    expect(redirigir).not.toHaveBeenCalled();
  });

  it("no registra dos veces la misma captación", async () => {
    const fd = () => form({ captacionId, contactoId: vendedor, precio: "390000000", fecha: hoy(), pct: "3", comprador: "" });
    await acciones.registrarCierreAction(fd());
    await expect(acciones.registrarCierreAction(fd())).rejects.toThrow(/NEXT_REDIRECT:.*ya%20est/);
    expect(await crm.listarCierres()).toHaveLength(1);
  });

  it("si falla un paso después de crear el cierre, el reintento lo completa sin duplicar nada", async () => {
    const original = crm.actualizarCaptacion.bind(crm);
    const espia = vi.spyOn(crm, "actualizarCaptacion").mockRejectedValueOnce(new Error("red caída"));
    const fd = () => form({ captacionId, contactoId: vendedor, precio: "390000000", fecha: hoy(), pct: "3", comprador: `${busquedaId}|${comprador}` });
    vi.spyOn(console, "error").mockImplementation(() => {});
    await expect(acciones.registrarCierreAction(fd())).rejects.toThrow(/NEXT_REDIRECT:.*No%20se%20pudo/);
    expect(await crm.listarCierres()).toHaveLength(1);
    expect((await crm.listarCaptaciones(vendedor))[0].estado).toBe("publicada");

    espia.mockImplementation(original);
    // «Completar venta» de la ficha: solo los ids.
    await acciones.registrarCierreAction(form({ captacionId, contactoId: vendedor, completar: "1" }));
    expect(await crm.listarCierres()).toHaveLength(1);
    expect((await crm.listarCaptaciones(vendedor))[0].estado).toBe("vendida");
    expect((await crm.listarBusquedas(comprador))[0].estado).toBe("cerrada");
    expect(actualizarInmueble).toHaveBeenCalledWith(PROP, { estado: "vendido" });
    expect((await crm.listarActividades(vendedor)).filter((a) => a.detalle.startsWith("Venta registrada"))).toHaveLength(1);
    expect((await crm.listarActividades(comprador)).filter((a) => a.detalle.startsWith("Compró"))).toHaveLength(1);
    // Ya completa: ahora sí se rechaza.
    await expect(acciones.registrarCierreAction(fd())).rejects.toThrow(/NEXT_REDIRECT:.*ya%20est/);
  });

  it("el almacén rechaza un segundo cierre de la misma captación (índice único) y se muestra como venta ya registrada", async () => {
    await crm.registrarCierre({ captacionId, vendedorContactoId: vendedor, precioVenta: 1, fechaCierre: hoy() });
    await expect(crm.registrarCierre({ captacionId, vendedorContactoId: vendedor, precioVenta: 1, fechaCierre: hoy() })).rejects.toThrow(/cierres_captacion_unica/);
    // Carrera: la lectura no ve el primero, el insert choca con el índice.
    crm.cierres = [];
    const espia = vi.spyOn(crm, "registrarCierre").mockRejectedValueOnce(new CrmStoreError('[crm] registrarCierre: duplicate key value violates unique constraint "cierres_captacion_unica"'));
    await expect(acciones.registrarCierreAction(form({ captacionId, contactoId: vendedor, precio: "390000000", fecha: hoy() }))).rejects.toThrow(/NEXT_REDIRECT:.*ya%20est/);
    espia.mockRestore();
  });

  it("rechaza búsqueda descartada, propuesta descartada o el mismo vendedor como comprador", async () => {
    const intento = (c: string) => acciones.registrarCierreAction(form({ captacionId, contactoId: vendedor, precio: "390000000", fecha: hoy(), comprador: c }));
    await crm.cambiarEstadoPropuesta(busquedaId, PROP, "descartado");
    await expect(intento(`${busquedaId}|${comprador}`)).rejects.toThrow(/NEXT_REDIRECT:.*comprador/);
    await crm.cambiarEstadoPropuesta(busquedaId, PROP, "visito");
    await crm.actualizarBusqueda(busquedaId, { estado: "descartada" });
    await expect(intento(`${busquedaId}|${comprador}`)).rejects.toThrow(/NEXT_REDIRECT:.*comprador/);
    const propia = (await crm.crearBusqueda({ contactoId: vendedor, tipo: "comprador", potencial: false, estado: "activa" })).id;
    await crm.proponer(propia, PROP);
    await expect(intento(`${propia}|${vendedor}`)).rejects.toThrow(/NEXT_REDIRECT:.*comprador/);
    expect(await crm.listarCierres()).toEqual([]);
    expect((await crm.listarPropuestas([busquedaId]))[0].estado).toBe("visito");
  });

  it("rechaza un comprador sin propuesta de ese inmueble y un precio inválido, sin escribir nada", async () => {
    const otraBusqueda = (await crm.crearBusqueda({ contactoId: comprador, tipo: "comprador", potencial: false, estado: "activa" })).id;
    await expect(acciones.registrarCierreAction(form({ captacionId, contactoId: vendedor, precio: "1", fecha: hoy(), comprador: `${otraBusqueda}|${comprador}` }))).rejects.toThrow("NEXT_REDIRECT");
    await expect(acciones.registrarCierreAction(form({ captacionId, contactoId: vendedor, precio: "0", fecha: hoy() }))).rejects.toThrow("NEXT_REDIRECT");
    expect(await crm.listarCierres()).toEqual([]);
    expect(actualizarInmueble).not.toHaveBeenCalled();
  });

  it("marca la comisión cobrada", async () => {
    await acciones.registrarCierreAction(form({ captacionId, contactoId: vendedor, precio: "390000000", fecha: hoy(), pct: "3" }));
    const [c] = await crm.listarCierres();
    await acciones.marcarComisionCobradaAction(form({ id: c.id, contactoId: vendedor, monto: "11.700.000", fecha: hoy() }));
    expect((await crm.listarCierres())[0]).toMatchObject({ comisionCobrada: 11_700_000, cobradaAt: hoy() });
  });
});

describe("próximo contacto", () => {
  it("agenda con atajo, con fecha escrita y lo da por hecho dejando la actividad", async () => {
    await acciones.fijarProximoContactoAction(form({ contactoId: vendedor, dias: "3", nota: "mandarle el de Chía" }));
    let c = await crm.obtenerContacto(vendedor);
    expect(c?.proximoContactoAt).toMatch(/T14:00:00\.000Z$/);
    expect(c?.proximoContactoNota).toBe("mandarle el de Chía");

    await acciones.fijarProximoContactoAction(form({ contactoId: vendedor, fecha: "2026-12-01T10:30" }));
    expect((await crm.obtenerContacto(vendedor))?.proximoContactoAt).toBe("2026-12-01T15:30:00.000Z");

    await acciones.completarSeguimientoAction(form({ contactoId: vendedor, tipo: "whatsapp", detalle: "" }));
    c = await crm.obtenerContacto(vendedor);
    expect(c?.proximoContactoAt).toBeUndefined();
    const [a] = await crm.listarActividades(vendedor);
    expect(a).toMatchObject({ tipo: "whatsapp", detalle: "Seguimiento hecho." });
  });

  it("al registrar una actividad puede agendar el siguiente contacto en el mismo envío", async () => {
    await acciones.registrarActividadAction(form({ contactoId: comprador, tipo: "llamada", detalle: "Le gustó", proximo: "7", proximoNota: "segunda visita" }));
    expect((await crm.obtenerContacto(comprador))?.proximoContactoNota).toBe("segunda visita");
    await expect(acciones.fijarProximoContactoAction(form({ contactoId: comprador, fecha: "mañana" }))).rejects.toThrow("NEXT_REDIRECT");
  });

  it("si la actividad queda pero la fecha falla, lo dice así (no invita a repetirla)", async () => {
    vi.spyOn(crm, "fijarProximoContacto").mockRejectedValueOnce(new CrmNoDisponibleError("falta 0010", "0010"));
    await expect(acciones.registrarActividadAction(form({ contactoId: comprador, tipo: "llamada", detalle: "Lo va a pensar", proximo: "3" }))).rejects.toThrow(
      /NEXT_REDIRECT:.*La%20actividad%20qued/,
    );
    expect(await crm.listarActividades(comprador)).toHaveLength(1);
  });

  it("«Hecho» repetido desde otra pestaña no anota dos veces", async () => {
    await acciones.fijarProximoContactoAction(form({ contactoId: vendedor, dias: "1" }));
    const at = (await crm.obtenerContacto(vendedor))!.proximoContactoAt!;
    await acciones.completarSeguimientoAction(form({ contactoId: vendedor, tipo: "llamada", detalle: "Hablamos", proximoAt: at }));
    await expect(acciones.completarSeguimientoAction(form({ contactoId: vendedor, tipo: "llamada", detalle: "Hablamos", proximoAt: at }))).rejects.toThrow(/NEXT_REDIRECT:.*ya%20estaba/);
    // Pestaña vieja con una fecha que ya cambió.
    await acciones.fijarProximoContactoAction(form({ contactoId: vendedor, dias: "7" }));
    await expect(acciones.completarSeguimientoAction(form({ contactoId: vendedor, tipo: "llamada", detalle: "Hablamos", proximoAt: at }))).rejects.toThrow(/NEXT_REDIRECT:.*cambi/);
    expect(await crm.listarActividades(vendedor)).toHaveLength(1);
  });
});
