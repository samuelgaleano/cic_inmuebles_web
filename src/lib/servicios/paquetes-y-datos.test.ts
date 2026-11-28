import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { getPlan } from "@/lib/config/plans";
import type { WompiTransaction } from "@/lib/integrations/wompi";
import { correoDeAviso, correoPagoRecibido, enlaceDeDatos } from "./correos";
import { maxEnviosDeDatos, recibirDatosDeServicio, type DatosDeps } from "./datos";
import { espaciosDe, puedeAgregarFicha, textoEspacios } from "./paquetes";
import { registrarServicioDePago, revisarVencimientos, type ServiciosDeps } from "./procesar";
import { enlaceRecordatorio, mensajeRecordatorio, tocaRecordar } from "./recordatorio";
import { MemoryServiciosStore } from "./store";
import { servicioDeToken, servicioDeTokenDeDatos, tokenDeDatos, tokenDeRenovacion } from "./token";
import { diasRestantes, type Servicio } from "./vigencia";

const DIA = 86_400_000;
const AHORA = new Date("2026-11-28T12:00:00.000Z");
const ID = "00000000-0000-4000-8000-000000000001";

function servicio(extra: Partial<Servicio> = {}): Servicio {
  return {
    id: ID,
    txId: "tx-1",
    reference: "CIC-paquete-5-123456-1700000000000",
    planId: "paquete-5",
    dias: 30,
    clienteEmail: "agente@ejemplo.co",
    clienteNombre: "marta pérez",
    clienteTelefono: "3001234567",
    estado: "activo",
    propertySlug: null,
    inicioAt: new Date(AHORA.getTime() - 25 * DIA).toISOString(),
    venceAt: new Date(AHORA.getTime() + 5 * DIA).toISOString(),
    aviso7dAt: null,
    aviso1dAt: null,
    avisoVencidoAt: null,
    createdAt: new Date(AHORA.getTime() - 26 * DIA).toISOString(),
    ...extra,
  };
}

beforeEach(() => {
  vi.stubEnv("RENOVACION_SECRET", "secreto-de-prueba");
});
afterEach(() => {
  vi.unstubAllEnvs();
  vi.restoreAllMocks();
});

describe("reglas de paquetes", () => {
  it("solo los planes con espacios son paquetes", () => {
    expect(espaciosDe({ planId: "paquete-5" })).toBe(5);
    expect(espaciosDe({ planId: "alianza-90" })).toBeNull();
    expect(textoEspacios(3, 5)).toBe("3 de 5 espacios");
    expect(textoEspacios(0, 1)).toBe("0 de 1 espacio");
  });

  it("no deja pasar del límite, repetir ficha, asignar a un plan por inmueble ni a un paquete sin activar", () => {
    const cinco = ["a", "b", "c", "d", "e"].map((propertyId) => ({ propertyId }));
    expect(puedeAgregarFicha(servicio(), cinco.slice(0, 4), "nuevo")).toEqual({ ok: true });
    expect(puedeAgregarFicha(servicio(), cinco, "nuevo")).toEqual({ ok: false, motivo: "lleno" });
    expect(puedeAgregarFicha(servicio(), cinco.slice(0, 2), "a")).toEqual({ ok: false, motivo: "ya_esta" });
    expect(puedeAgregarFicha(servicio({ planId: "alianza-90" }), [], "x")).toEqual({ ok: false, motivo: "no_es_paquete" });
    expect(puedeAgregarFicha(servicio({ estado: "pendiente_publicar" }), [], "x")).toEqual({ ok: false, motivo: "no_activo" });
    expect(puedeAgregarFicha(servicio({ estado: "vencido" }), [], "x")).toEqual({ ok: false, motivo: "no_activo" });
  });

  it("el store en memoria guarda las fichas por servicio, sin duplicar, y deja quitarlas", async () => {
    const mem = new MemoryServiciosStore();
    expect(await mem.agregarFichaAPaquete(ID, { propertyId: "p1", slug: "bella-suiza" })).toBe(true);
    expect(await mem.agregarFichaAPaquete(ID, { propertyId: "p1", slug: "bella-suiza" })).toBe(false);
    await mem.agregarFichaAPaquete(ID, { propertyId: "p2", slug: "cedritos" });
    await mem.agregarFichaAPaquete("otro", { propertyId: "p3", slug: "otra" });
    expect((await mem.fichasDePaquetes([ID])).get(ID)).toEqual([
      { propertyId: "p1", slug: "bella-suiza" },
      { propertyId: "p2", slug: "cedritos" },
    ]);
    await mem.quitarFichaDePaquete(ID, "p1");
    expect((await mem.fichasDePaquetes([ID, "otro"])).get(ID)).toEqual([{ propertyId: "p2", slug: "cedritos" }]);
  });
});

function deps(overrides: Partial<ServiciosDeps> = {}) {
  const mem = new MemoryServiciosStore();
  const base: ServiciosDeps = {
    store: mem,
    enviarCorreo: vi.fn(async () => true),
    despublicarFicha: vi.fn(async () => true),
    publicarFicha: vi.fn(async () => true),
    alertar: vi.fn(async () => true),
    ahora: () => AHORA,
  };
  return { ...base, ...overrides, mem };
}

describe("vencimiento de un paquete con fichas", () => {
  it("al vencer no despublica sus fichas: las lista en el aviso al cliente y en la alerta al equipo", async () => {
    const d = deps();
    const s = servicio({ venceAt: new Date(AHORA.getTime() - 2 * DIA).toISOString() });
    d.mem.filas.push(s);
    await d.mem.agregarFichaAPaquete(s.id, { propertyId: "p1", slug: "bella-suiza" });
    await d.mem.agregarFichaAPaquete(s.id, { propertyId: "p2", slug: "cedritos-101" });

    const r = await revisarVencimientos(d);

    expect(r.vencidos).toBe(1);
    expect(s.estado).toBe("vencido");
    expect(d.despublicarFicha).not.toHaveBeenCalled();
    const correo = (d.enviarCorreo as ReturnType<typeof vi.fn>).mock.calls[0][0];
    expect(correo.text).toContain("bella-suiza");
    expect(correo.html).toContain("https://www.cicinmuebles.com/inmuebles/cedritos-101");
    const [, texto] = (d.alertar as ReturnType<typeof vi.fn>).mock.calls[0];
    expect(texto).toMatch(/paquete con 2 fichas que siguen publicadas \(bella-suiza, cedritos-101\)/);
  });

  it("el aviso de 7 días de un paquete también lista sus fichas", () => {
    const c = correoDeAviso(servicio(), "7d", { fichas: ["bella-suiza"] })!;
    expect(c.text).toContain("Inmueble 1: bella-suiza");
  });

  it("si no se pueden leer las fichas, la revisión sigue igual", async () => {
    const d = deps();
    d.mem.fichasDePaquetes = vi.fn().mockRejectedValue(new Error("base caída"));
    vi.spyOn(console, "error").mockImplementation(() => {});
    d.mem.filas.push(servicio({ venceAt: new Date(AHORA.getTime() + 6 * DIA).toISOString() }));
    const r = await revisarVencimientos(d);
    expect(r.avisosEnviados).toBe(1);
  });
});

describe("renovación pagada atómica (store en memoria)", () => {
  it("aplica una sola vez, anota el tramo y no deja reclamo si el vencimiento cambió", async () => {
    const mem = new MemoryServiciosStore();
    const s = servicio({ planId: "alianza-90", dias: 90, propertySlug: "bella-suiza" });
    mem.filas.push(s);
    const nuevo = new Date(AHORA.getTime() + 95 * DIA).toISOString();

    const conflicto = await mem.aplicarRenovacion("tx-a", s.id, { inicioAt: null, venceAt: nuevo }, "2020-01-01T00:00:00.000Z");
    expect(conflicto.resultado).toBe("conflicto");
    expect(mem.renovaciones.has("tx-a")).toBe(false);
    expect(mem.libro).toHaveLength(0);

    const r = await mem.aplicarRenovacion("tx-a", s.id, { inicioAt: null, venceAt: nuevo }, s.venceAt);
    expect(r.resultado).toBe("aplicada");
    expect(mem.libro).toMatchObject([{ tipo: "renovacion", txId: "tx-a", hasta: nuevo }]);
    expect((await mem.aplicarRenovacion("tx-a", s.id, { inicioAt: null, venceAt: nuevo }, nuevo)).resultado).toBe("ya_aplicada");
    expect(mem.libro).toHaveLength(1);
  });

  it("registrarServicioDePago usa el paso atómico: un conflicto alerta y se reintenta sin quedar reclamado", async () => {
    const d = deps();
    const s = servicio({ planId: "alianza-90", dias: 90, propertySlug: "bella-suiza" });
    d.mem.filas.push(s);
    const tx: WompiTransaction = { id: "5555-1610641025-44444", status: "APPROVED", reference: "CIC-alianza-90-1-1", amountInCents: 1_000_000, currency: "COP", customerEmail: s.clienteEmail };
    const original = d.mem.aplicarRenovacion.bind(d.mem);
    d.mem.aplicarRenovacion = vi.fn().mockResolvedValueOnce({ resultado: "conflicto" }).mockImplementation(original);
    vi.spyOn(console, "error").mockImplementation(() => {});

    await registrarServicioDePago(tx, getPlan("alianza-90")!, d, { renuevaServicioId: s.id });
    expect(d.alertar).toHaveBeenCalledTimes(1);
    expect(d.mem.filas).toHaveLength(1);

    await registrarServicioDePago(tx, getPlan("alianza-90")!, d, { renuevaServicioId: s.id });
    expect(diasRestantes(s.venceAt!, AHORA)).toBe(95);
    expect(await d.mem.txIdsRegistrados([tx.id, "otro"])).toEqual(new Set([tx.id]));
  });
});

describe("recordatorio por WhatsApp", () => {
  it("se ofrece a 7 días o menos y a los vencidos, no antes ni a pendientes", () => {
    expect(tocaRecordar(servicio({ venceAt: new Date(AHORA.getTime() + 8 * DIA).toISOString() }), AHORA)).toBe(false);
    expect(tocaRecordar(servicio({ venceAt: new Date(AHORA.getTime() + 7 * DIA).toISOString() }), AHORA)).toBe(true);
    expect(tocaRecordar(servicio({ estado: "vencido", venceAt: new Date(AHORA.getTime() - 20 * DIA).toISOString() }), AHORA)).toBe(true);
    expect(tocaRecordar(servicio({ estado: "pendiente_publicar", venceAt: null }), AHORA)).toBe(false);
    expect(tocaRecordar(servicio({ estado: "descartado" }), AHORA)).toBe(false);
  });

  it("abre wa.me con el mensaje listo y el enlace firmado de renovación", () => {
    const s = servicio();
    const url = enlaceRecordatorio(s, AHORA)!;
    expect(url.startsWith("https://wa.me/573001234567?text=")).toBe(true);
    const texto = decodeURIComponent(url.split("?text=")[1]);
    expect(texto).toContain("Hola Marta");
    expect(texto).toContain("Tu paquete del plan «Paquete Mensual 5» vence en 5 días");
    const token = texto.match(/renovar=([^\s]+)/)![1];
    expect(servicioDeToken(token, AHORA)).toBe(s.id);
  });

  it("sin teléfono con WhatsApp no hay botón; un vencido dice que venció", () => {
    expect(enlaceRecordatorio(servicio({ clienteTelefono: null }), AHORA)).toBeNull();
    expect(enlaceRecordatorio(servicio({ clienteTelefono: "2345678" }), AHORA)).toBeNull();
    const vencido = servicio({ estado: "vencido", planId: "alianza-90", propertySlug: "x", venceAt: new Date(AHORA.getTime() - 3 * DIA).toISOString() });
    expect(mensajeRecordatorio(vencido, AHORA)).toMatch(/Tu publicación del plan «Alianza por resultados» venció el/);
  });
});

describe("enlace firmado del formulario de datos", () => {
  it("va y vuelve, caduca a los 60 días y no sirve como enlace de renovación ni al revés", () => {
    const t = tokenDeDatos(ID, { ahora: AHORA })!;
    expect(servicioDeTokenDeDatos(t, AHORA)).toBe(ID);
    expect(servicioDeTokenDeDatos(t, new Date(AHORA.getTime() + 61 * DIA))).toBeNull();
    expect(servicioDeToken(t, AHORA)).toBeNull();
    expect(servicioDeTokenDeDatos(tokenDeRenovacion(ID, { ahora: AHORA })!, AHORA)).toBeNull();
  });

  it("sin secreto no hay enlace y el correo del pago vuelve al botón de WhatsApp", () => {
    vi.stubEnv("RENOVACION_SECRET", "");
    vi.stubEnv("CRON_SECRET", "");
    expect(enlaceDeDatos({ id: ID })).toBeNull();
    const c = correoPagoRecibido(servicio({ estado: "pendiente_publicar" }))!;
    expect(c.html).not.toContain("/publica/agente/datos");
    expect(c.text).toContain("Escribir a un asesor");
  });

  it("el correo de confirmación del pago lleva el botón al formulario con el enlace firmado", () => {
    const c = correoPagoRecibido(servicio({ estado: "pendiente_publicar" }))!;
    const m = c.html!.match(/href="https:\/\/www\.cicinmuebles\.com\/publica\/agente\/datos\?t=([^"]+)"/);
    expect(m).not.toBeNull();
    expect(servicioDeTokenDeDatos(m![1])).toBe(ID);
    expect(c.text).toContain("Enviar los datos del inmueble");
  });
});

describe("formulario de datos del inmueble", () => {
  function preparar() {
    const store = new MemoryServiciosStore();
    store.now = () => AHORA.getTime();
    const s = servicio({ estado: "pendiente_publicar", venceAt: null, inicioAt: null, planId: "alianza-90" });
    store.filas.push(s);
    const d: DatosDeps = { store, alertar: vi.fn(async () => true), ahora: () => AHORA };
    const form = (extra: Record<string, string> = {}) => ({
      t: tokenDeDatos(s.id, { ahora: AHORA })!,
      tipo: "apartamento",
      ciudad: "Bogotá",
      sector: "Cedritos",
      precio: "$ 350.000.000",
      descripcion: "3 habitaciones, 2 baños",
      contactoNombre: "Marta Pérez",
      contactoWhatsapp: "300 123 4567",
      website: "",
      ...extra,
    });
    return { store, s, d, form };
  }

  it("guarda los datos, avisa al equipo sin el nombre ni el WhatsApp del contacto", async () => {
    const { store, s, d, form } = preparar();
    const r = await recibirDatosDeServicio(form(), d);
    expect(r.status).toBe("success");
    const guardados = (await store.datosDeServicios([s.id])).get(s.id)!;
    expect(guardados).toMatchObject([{ tipo: "apartamento", ciudad: "Bogotá", sector: "Cedritos", precio: 350_000_000, contactoNombre: "Marta Pérez" }]);
    const [asunto, texto] = (d.alertar as ReturnType<typeof vi.fn>).mock.calls[0];
    expect(asunto).toContain("Alianza por resultados");
    expect(`${asunto}\n${texto}`).not.toContain("Marta");
    expect(`${asunto}\n${texto}`).not.toContain("300 123 4567");
    expect(texto).toContain("/admin/vigencias");
  });

  it("valida con zod y devuelve los errores por campo y lo escrito", async () => {
    const { store, s, d, form } = preparar();
    const r = await recibirDatosDeServicio(form({ tipo: "castillo", contactoWhatsapp: "123", precio: "50" }), d);
    expect(r.status).toBe("error");
    expect(Object.keys(r.errors ?? {}).sort()).toEqual(["contactoWhatsapp", "precio", "tipo"]);
    expect(r.values?.ciudad).toBe("Bogotá");
    expect((await store.datosDeServicios([s.id])).size).toBe(0);
  });

  it("el honeypot responde éxito sin guardar ni avisar", async () => {
    const { store, s, d, form } = preparar();
    const r = await recibirDatosDeServicio(form({ website: "http://spam" }), d);
    expect(r.status).toBe("success");
    expect((await store.datosDeServicios([s.id])).size).toBe(0);
    expect(d.alertar).not.toHaveBeenCalled();
  });

  it("rechaza tokens ajenos, de renovación, vencidos o de un servicio descartado", async () => {
    const { s, d, form } = preparar();
    expect((await recibirDatosDeServicio(form({ t: "x.y.z" }), d)).status).toBe("error");
    expect((await recibirDatosDeServicio(form({ t: tokenDeRenovacion(s.id)! }), d)).status).toBe("error");
    const viejo = tokenDeDatos(s.id, { ahora: new Date(AHORA.getTime() - 61 * DIA) })!;
    expect((await recibirDatosDeServicio(form({ t: viejo }), d)).status).toBe("error");
    s.estado = "descartado";
    expect((await recibirDatosDeServicio(form(), d)).status).toBe("error");
    expect(d.alertar).not.toHaveBeenCalled();
  });

  it("tope de envíos: uno por espacio más dos para corregir", async () => {
    expect(maxEnviosDeDatos("alianza-90")).toBe(3);
    expect(maxEnviosDeDatos("paquete-5")).toBe(7);
    const { d, form } = preparar();
    for (let i = 0; i < 3; i++) expect((await recibirDatosDeServicio(form(), d)).status).toBe("success");
    const r = await recibirDatosDeServicio(form(), d);
    expect(r.status).toBe("error");
    expect(r.message).toMatch(/Ya recibimos los datos/);
  });

  it("si la base falla no lanza y el log no lleva lo que escribió la persona", async () => {
    const { store, d, form } = preparar();
    store.guardarDatos = vi.fn().mockRejectedValue(new Error("base caída"));
    const error = vi.spyOn(console, "error").mockImplementation(() => {});
    const r = await recibirDatosDeServicio(form(), d);
    expect(r.status).toBe("error");
    const log = JSON.stringify(error.mock.calls);
    expect(log).not.toContain("Marta");
    expect(log).not.toContain("300 123 4567");
  });
});
