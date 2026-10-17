import { beforeEach, describe, expect, it, vi } from "vitest";
import { getPlan } from "@/lib/config/plans";
import type { WompiTransaction } from "@/lib/integrations/wompi";
import { correoDeAviso, correoPagoRecibido, correoPublicacionActiva } from "./correos";
import { registrarServicioDePago, revisarVencimientos, type ServiciosDeps } from "./procesar";
import { MemoryServiciosStore, ServiciosNoDisponibleError, type ServiciosStore } from "./store";
import { servicioDeToken, tokenDeRenovacion } from "./token";
import { accionDeHoy, diasRestantes, ventanaDeActivacion, ventanaDeRenovacion, type Servicio } from "./vigencia";

const DIA = 86_400_000;
const AHORA = new Date("2026-10-16T12:00:00.000Z");

function servicio(extra: Partial<Servicio> = {}): Servicio {
  return {
    id: "00000000-0000-4000-8000-000000000001",
    txId: "tx-1",
    reference: "CIC-alianza-90-123456-1700000000000",
    planId: "alianza-90",
    dias: 90,
    clienteEmail: "agente@ejemplo.co",
    clienteNombre: "Marta Pérez",
    clienteTelefono: "3001234567",
    estado: "activo",
    propertySlug: "bella-suiza",
    inicioAt: new Date(AHORA.getTime() - 83 * DIA).toISOString(),
    venceAt: new Date(AHORA.getTime() + 7 * DIA).toISOString(),
    aviso7dAt: null,
    aviso1dAt: null,
    avisoVencidoAt: null,
    createdAt: new Date(AHORA.getTime() - 90 * DIA).toISOString(),
    ...extra,
  };
}

describe("vigencia", () => {
  it("la ventana de activación empieza hoy y dura los días del plan", () => {
    const v = ventanaDeActivacion(AHORA, 30);
    expect(v.inicioAt).toBe(AHORA.toISOString());
    expect(diasRestantes(v.venceAt, AHORA)).toBe(30);
  });

  it("renovar un servicio vigente suma el periodo al vencimiento (no se pierden días) y uno vencido cuenta desde hoy", () => {
    const vigente = servicio({ dias: 30, venceAt: new Date(AHORA.getTime() + 5 * DIA).toISOString() });
    expect(diasRestantes(ventanaDeRenovacion(vigente, AHORA).venceAt, AHORA)).toBe(35);
    expect(ventanaDeRenovacion(vigente, AHORA).inicioAt).toBeNull();
    const vencido = servicio({ dias: 30, estado: "vencido", venceAt: new Date(AHORA.getTime() - 2 * DIA).toISOString() });
    const r = ventanaDeRenovacion(vencido, AHORA);
    expect(diasRestantes(r.venceAt, AHORA)).toBe(30);
    expect(r.inicioAt).toBe(AHORA.toISOString());
  });

  it("un servicio pendiente de publicar no tiene reloj", () => {
    expect(accionDeHoy(servicio({ estado: "pendiente_publicar", inicioAt: null, venceAt: null }), AHORA)).toEqual({ vencer: false, aviso: null });
  });

  it("avisa a los 7 días y a 1 día, y solo una vez cada uno", () => {
    expect(accionDeHoy(servicio({ venceAt: new Date(AHORA.getTime() + 8 * DIA).toISOString() }), AHORA).aviso).toBeNull();
    expect(accionDeHoy(servicio({ venceAt: new Date(AHORA.getTime() + 7 * DIA).toISOString() }), AHORA).aviso).toBe("7d");
    expect(accionDeHoy(servicio({ venceAt: new Date(AHORA.getTime() + 7 * DIA).toISOString(), aviso7dAt: "x" }), AHORA).aviso).toBeNull();
    expect(accionDeHoy(servicio({ venceAt: new Date(AHORA.getTime() + 0.5 * DIA).toISOString() }), AHORA).aviso).toBe("1d");
    expect(accionDeHoy(servicio({ venceAt: new Date(AHORA.getTime() + 0.5 * DIA).toISOString(), aviso1dAt: "x" }), AHORA).aviso).toBeNull();
  });

  it("si la corrida se saltó el aviso de 7 días, a 1 día solo manda el de 1 día", () => {
    const s = servicio({ venceAt: new Date(AHORA.getTime() + 0.9 * DIA).toISOString() });
    expect(accionDeHoy(s, AHORA)).toEqual({ vencer: false, aviso: "1d" });
  });

  it("al vencer: vence el servicio activo y manda el aviso de vencimiento una sola vez", () => {
    const s = servicio({ venceAt: new Date(AHORA.getTime() - 1000).toISOString() });
    expect(accionDeHoy(s, AHORA)).toEqual({ vencer: true, aviso: "vencido" });
    expect(accionDeHoy({ ...s, estado: "vencido" }, AHORA)).toEqual({ vencer: false, aviso: "vencido" });
    expect(accionDeHoy({ ...s, estado: "vencido", avisoVencidoAt: "x" }, AHORA)).toEqual({ vencer: false, aviso: null });
  });
});

describe("token de renovación", () => {
  beforeEach(() => {
    vi.stubEnv("RENOVACION_SECRET", "secreto-de-prueba");
  });

  it("va y vuelve, y rechaza firmas ajenas o alteradas", () => {
    const id = "00000000-0000-4000-8000-000000000009";
    const t = tokenDeRenovacion(id)!;
    expect(servicioDeToken(t)).toBe(id);
    expect(servicioDeToken(t.slice(0, -1) + (t.endsWith("0") ? "1" : "0"))).toBeNull();
    expect(servicioDeToken(`00000000-0000-4000-8000-000000000010.${t.split(".")[1]}`)).toBeNull();
    expect(servicioDeToken("basura")).toBeNull();
    expect(servicioDeToken("x".repeat(500))).toBeNull();
  });

  it("sin secreto no se generan ni se aceptan enlaces", () => {
    vi.stubEnv("RENOVACION_SECRET", "");
    vi.stubEnv("CRON_SECRET", "");
    expect(tokenDeRenovacion("00000000-0000-4000-8000-000000000009")).toBeNull();
    expect(servicioDeToken("00000000-0000-4000-8000-000000000009.abc")).toBeNull();
  });
});

describe("correos", () => {
  beforeEach(() => {
    vi.stubEnv("RENOVACION_SECRET", "secreto-de-prueba");
  });

  it("el aviso lleva el plan, la fecha, la ficha y el enlace firmado de renovación", () => {
    const c = correoDeAviso(servicio(), "7d")!;
    expect(c.to).toBe("agente@ejemplo.co");
    expect(c.subject).toBe("Tu publicación vence en 7 días");
    expect(c.text).toContain("Alianza por resultados");
    expect(c.text).toContain("/inmuebles/bella-suiza");
    expect(c.text).toMatch(/\/publica\/agente\?renovar=00000000-0000-4000-8000-000000000001\.[0-9a-f]{32}/);
    expect(c.text).toContain("Hola Marta,");
    expect(c.text).not.toMatch(/[—–]/);
  });

  it("sin correo del cliente no se arma ningún mensaje", () => {
    const s = servicio({ clienteEmail: null });
    expect(correoDeAviso(s, "1d")).toBeNull();
    expect(correoPagoRecibido(s)).toBeNull();
    expect(correoPublicacionActiva(s)).toBeNull();
  });

  it("la confirmación del pago explica que la vigencia corre desde la publicación", () => {
    const c = correoPagoRecibido(servicio({ estado: "pendiente_publicar", dias: 90 }))!;
    expect(c.text).toContain("90 días");
    expect(c.text).toMatch(/empieza a contar el día en que publiquemos/);
  });
});

function deps(overrides: Partial<ServiciosDeps> = {}) {
  const store = new MemoryServiciosStore();
  const base: ServiciosDeps = {
    store,
    enviarCorreo: vi.fn(async () => true),
    despublicarFicha: vi.fn(async () => true),
    alertar: vi.fn(async () => true),
    ahora: () => AHORA,
  };
  return { ...base, ...overrides, store: (overrides.store ?? store) as ServiciosStore, mem: store };
}

const TX: WompiTransaction = {
  id: "1234-1610641025-49201",
  status: "APPROVED",
  reference: "CIC-alianza-90-123456-1700000000000",
  amountInCents: 1_000_000,
  currency: "COP",
  customerEmail: "agente@ejemplo.co",
  customerName: "Marta Pérez",
  customerPhone: "3001234567",
};

describe("registrarServicioDePago", () => {
  it("crea el servicio pendiente con los días del plan y confirma al comprador una sola vez", async () => {
    const d = deps();
    const plan = getPlan("alianza-90")!;
    await registrarServicioDePago(TX, plan, d);
    await registrarServicioDePago(TX, plan, d);
    expect(d.mem.filas).toHaveLength(1);
    expect(d.mem.filas[0]).toMatchObject({ estado: "pendiente_publicar", dias: 90, clienteEmail: "agente@ejemplo.co", venceAt: null });
    expect(d.enviarCorreo).toHaveBeenCalledTimes(1);
  });

  it("los planes de contacto no crean servicio y un fallo del almacén nunca lanza", async () => {
    const d = deps();
    await registrarServicioDePago(TX, getPlan("contenido-profesional")!, d);
    expect(d.mem.filas).toHaveLength(0);
    d.store.registrar = vi.fn(async () => {
      throw new ServiciosNoDisponibleError("sin tabla");
    });
    await expect(registrarServicioDePago(TX, getPlan("alianza-90")!, d)).resolves.toBeUndefined();
  });
});

describe("revisarVencimientos", () => {
  async function conServicio(extra: Partial<Servicio>) {
    const d = deps();
    const s = servicio(extra);
    d.mem.filas.push(s);
    return { d, s };
  }

  it("envía el aviso de 7 días y lo marca para no repetirlo", async () => {
    const { d, s } = await conServicio({});
    const r = await revisarVencimientos(d);
    expect(r).toMatchObject({ avisosEnviados: 1, vencidos: 0, fallos: 0 });
    expect(s.aviso7dAt).not.toBeNull();
    const r2 = await revisarVencimientos(d);
    expect(r2.avisosEnviados).toBe(0);
    expect(d.enviarCorreo).toHaveBeenCalledTimes(1);
  });

  it("si el correo falla no marca el aviso y lo reintenta en la siguiente corrida", async () => {
    const { d, s } = await conServicio({});
    (d.enviarCorreo as ReturnType<typeof vi.fn>).mockResolvedValueOnce(false);
    const r = await revisarVencimientos(d);
    expect(r).toMatchObject({ avisosEnviados: 0, fallos: 1 });
    expect(s.aviso7dAt).toBeNull();
    expect((await revisarVencimientos(d)).avisosEnviados).toBe(1);
  });

  it("al vencer despublica la ficha, marca vencido y avisa; la alerta a CIC lista al cliente", async () => {
    const { d, s } = await conServicio({ venceAt: new Date(AHORA.getTime() - 1000).toISOString() });
    const r = await revisarVencimientos(d);
    expect(d.despublicarFicha).toHaveBeenCalledWith("bella-suiza");
    expect(s.estado).toBe("vencido");
    expect(r).toMatchObject({ vencidos: 1, avisosEnviados: 1 });
    expect(d.alertar).toHaveBeenCalledTimes(1);
    expect((d.alertar as ReturnType<typeof vi.fn>).mock.calls[0][1]).toContain("agente@ejemplo.co");
  });

  it("si no se puede despublicar, el servicio sigue activo y se reintenta", async () => {
    const { d, s } = await conServicio({ venceAt: new Date(AHORA.getTime() - 1000).toISOString() });
    (d.despublicarFicha as ReturnType<typeof vi.fn>).mockResolvedValueOnce(false);
    const r = await revisarVencimientos(d);
    expect(r).toMatchObject({ vencidos: 0, fallos: 1 });
    expect(s.estado).toBe("activo");
    expect((await revisarVencimientos(d)).vencidos).toBe(1);
  });

  it("un servicio sin correo se marca avisado y se le pide a CIC avisar por WhatsApp", async () => {
    const { d, s } = await conServicio({ clienteEmail: null });
    const r = await revisarVencimientos(d);
    expect(r.sinCorreo).toBe(1);
    expect(s.aviso7dAt).not.toBeNull();
    expect((d.alertar as ReturnType<typeof vi.fn>).mock.calls[0][1]).toContain("SIN CORREO");
  });

  it("un paquete (sin ficha enlazada) vence sin despublicar nada", async () => {
    const { d, s } = await conServicio({ planId: "paquete-5", propertySlug: null, venceAt: new Date(AHORA.getTime() - 1000).toISOString() });
    await revisarVencimientos(d);
    expect(d.despublicarFicha).not.toHaveBeenCalled();
    expect(s.estado).toBe("vencido");
  });

  it("sin la tabla (migración sin aplicar) no falla: informa que no está disponible", async () => {
    const d = deps();
    d.store.listarParaRevision = vi.fn(async () => {
      throw new ServiciosNoDisponibleError("sin tabla");
    });
    expect(await revisarVencimientos(d)).toMatchObject({ disponible: false });
  });

  it("sin nada que hacer no manda alerta", async () => {
    const { d } = await conServicio({ venceAt: new Date(AHORA.getTime() + 40 * DIA).toISOString() });
    await revisarVencimientos(d);
    expect(d.alertar).not.toHaveBeenCalled();
  });
});

describe("correcciones de la revisión", () => {
  it("una renovación sobre la misma ficha: el servicio viejo se cierra sin despublicar ni avisar un vencimiento falso", async () => {
    const d = deps();
    const viejo = servicio({ id: "viejo", venceAt: new Date(AHORA.getTime() - 1000).toISOString() });
    const nuevo = servicio({ id: "nuevo", txId: "tx-2", venceAt: new Date(AHORA.getTime() + 20 * DIA).toISOString() });
    d.mem.filas.push(viejo, nuevo);
    const r = await revisarVencimientos(d);
    expect(d.despublicarFicha).not.toHaveBeenCalled();
    expect(viejo.estado).toBe("vencido");
    expect(viejo.avisoVencidoAt).not.toBeNull();
    expect(nuevo.estado).toBe("activo");
    expect(r.vencidos).toBe(0);
    expect((d.enviarCorreo as ReturnType<typeof vi.fn>).mock.calls.some(([m]) => /venció/.test(m.subject))).toBe(false);
  });

  it("marcarVencido sin forzar no pisa un servicio renovado entre la lectura y la escritura", async () => {
    const d = deps();
    const s = servicio({ venceAt: new Date(AHORA.getTime() + 30 * DIA).toISOString() });
    d.mem.filas.push(s);
    await d.mem.marcarVencido(s.id, { ahora: AHORA });
    expect(s.estado).toBe("activo");
    await d.mem.marcarVencido(s.id, { forzar: true, ahora: AHORA });
    expect(s.estado).toBe("vencido");
    expect(s.venceAt).toBe(AHORA.toISOString());
  });

  it("la activación suma lo que le quedaba a la ficha: no se pierden días pagados", () => {
    const hasta = new Date(AHORA.getTime() + 6 * DIA).toISOString();
    expect(diasRestantes(ventanaDeActivacion(AHORA, 30, hasta).venceAt, AHORA)).toBe(36);
    expect(diasRestantes(ventanaDeActivacion(AHORA, 30, new Date(AHORA.getTime() - DIA).toISOString()).venceAt, AHORA)).toBe(30);
    expect(diasRestantes(ventanaDeActivacion(AHORA, 30).venceAt, AHORA)).toBe(30);
  });

  it("si no se puede registrar el servicio de un pago, CIC recibe una alerta para registrarlo a mano", async () => {
    const d = deps();
    d.store.registrar = vi.fn(async () => {
      throw new ServiciosNoDisponibleError("sin tabla");
    });
    await registrarServicioDePago(TX, getPlan("alianza-90")!, d);
    expect(d.alertar).toHaveBeenCalledTimes(1);
    expect((d.alertar as ReturnType<typeof vi.fn>).mock.calls[0][1]).toContain(TX.id);
  });

  it("el aviso de 1 día no promete «mañana» (el cron corre de madrugada)", () => {
    const c = correoDeAviso(servicio(), "1d")!;
    expect(c.subject).toBe("Tu publicación vence en menos de 24 horas");
    expect(c.text).not.toMatch(/mañana/i);
    expect(c.text).not.toMatch(/responde a este correo|dejamos de enviarlos/);
  });

  it("si falla el correo de confirmación de pago, CIC recibe un aviso para contactar al comprador", async () => {
    const d = deps({ enviarCorreo: vi.fn(async () => false) });
    await registrarServicioDePago(TX, getPlan("alianza-90")!, d);
    expect(d.alertar).toHaveBeenCalledTimes(1);
    expect((d.alertar as ReturnType<typeof vi.fn>).mock.calls[0][1]).toContain("agente@ejemplo.co");
  });
});
