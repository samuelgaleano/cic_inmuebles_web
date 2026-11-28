import { describe, expect, it } from "vitest";
import type { Lead } from "@/lib/domain";
import { armarResumenDiario, claveDelDia, reunirResumenDiario, type DatosResumen } from "./resumen";
import { MemoryServiciosStore, ServiciosNoDisponibleError } from "@/lib/servicios/store";
import type { Servicio } from "@/lib/servicios/vigencia";
import { MemoryCrmStore } from "./store";

// 23 nov 2026, 7:00 de Bogotá (la hora del cron).
const AHORA = new Date("2026-11-23T12:00:00.000Z");
const BASE = "https://www.cicinmuebles.com";
const vacio: DatosResumen = { seguimientos: [], porAprobar: [], compradoresSinPropuestas: [], leadsNuevos: [] };

describe("armarResumenDiario", () => {
  it("devuelve null si no hay nada pendiente (no se manda correo vacío)", () => {
    expect(armarResumenDiario(vacio, AHORA, BASE)).toBeNull();
  });

  it("incluye vencidos y los de hoy con WhatsApp, nota y cuánto lleva vencido", () => {
    const r = armarResumenDiario(
      {
        ...vacio,
        seguimientos: [
          { id: "c1", nombre: "Marta Pérez", telefono: "+57 300 123 4567", at: "2026-11-20T14:00:00.000Z", nota: "mandarle el apto de Cedritos" },
          { id: "c2", nombre: "Luis", at: "2026-11-23T14:00:00.000Z" },
        ],
      },
      AHORA,
      BASE,
    );
    expect(r).not.toBeNull();
    expect(r!.asunto).toContain("1 seguimiento vencido");
    expect(r!.asunto).not.toContain("Marta"); // sin nombres en el asunto
    expect(r!.text).toContain("[VENCIDO] Marta Pérez");
    expect(r!.text).toContain("vencido hace 3 días");
    expect(r!.text).toContain("mandarle el apto de Cedritos");
    expect(r!.text).toContain("https://wa.me/573001234567");
    expect(r!.text).toContain(`${BASE}/admin/crm/contactos/c1`);
    expect(r!.text).toMatch(/Luis · hoy, 9:00/);
    expect(r!.html).toContain('href="https://wa.me/573001234567"');
    expect(r!.html).toContain("Vencido");
  });

  it("escapa todo lo que viene de personas en el HTML", () => {
    const r = armarResumenDiario(
      {
        ...vacio,
        seguimientos: [{ id: "c1", nombre: '<script>alert("x")</script>', at: "2026-11-23T14:00:00.000Z", nota: "<img src=x onerror=1> & 'listo'" }],
        leadsNuevos: [{ nombre: "Ana <b>", telefono: "300 000 0000", tipo: "comprador", creadoEn: "2026-11-22T20:00:00.000Z" }],
      },
      AHORA,
      BASE,
    )!;
    expect(r.html).not.toContain("<script>");
    expect(r.html).not.toContain("<img");
    expect(r.html).not.toContain("Ana <b>");
    expect(r.html).toContain("&lt;script&gt;alert(&quot;x&quot;)&lt;/script&gt;");
    expect(r.html).toContain("&amp; &#39;listo&#39;");
    expect(r.html).toContain("Ana &lt;b&gt;");
  });

  it("arma todos los grupos y corta los largos con «y N más»", () => {
    const muchos = Array.from({ length: 30 }, (_, i) => ({ id: `v${i}`, nombre: `Vendedor ${i}` }));
    const r = armarResumenDiario(
      {
        seguimientos: [],
        porAprobar: muchos,
        compradoresSinPropuestas: [{ id: "b1", nombre: "Carlos", busca: "Chía" }],
        leadsNuevos: [{ nombre: "Lina", tipo: "vendedor", creadoEn: "2026-11-23T10:00:00.000Z" }],
      },
      AHORA,
      BASE,
    )!;
    expect(r.asunto).toBe("CRM de hoy: 32 pendientes");
    expect(r.text).toContain("VENDEDORES POR APROBAR (30)");
    expect(r.text).toContain("y 5 más");
    expect(r.text).toContain("busca: Chía");
    expect(r.text).toContain("quiere vender · hace 2 horas");
    expect(r.text).not.toContain("SEGUIMIENTOS");
  });

  it("incluye pagos sin publicar y planes por vencer, enlazados al panel de vigencias y escapados", () => {
    const r = armarResumenDiario(
      {
        ...vacio,
        pagosSinPublicar: [{ id: "s1", nombre: "Marta <i>", telefono: "300 123 4567", plan: "Alianza por resultados", diasDesdePago: 4 }],
        planesPorVencer: [{ id: "s2", nombre: "Luis", plan: "Paquete Mensual 5", venceAt: "2026-11-26T12:00:00.000Z", diasRestantes: 3 }],
      },
      AHORA,
      BASE,
    )!;
    expect(r.asunto).toBe("CRM de hoy: 2 pendientes");
    expect(r.text).toContain("PAGOS SIN PUBLICAR (1)");
    expect(r.text).toContain("Alianza por resultados · pagó hace 4 días");
    expect(r.text).toContain("PLANES QUE VENCEN EN 7 DÍAS O MENOS (1)");
    expect(r.text).toMatch(/Paquete Mensual 5 · vence en 3 días \(jueves,? 26 de noviembre de 2026\)/);
    expect(r.text).toContain(`Vigencias: ${BASE}/admin/vigencias`);
    expect(r.html).toContain("Marta &lt;i&gt;");
    expect(r.html).not.toContain("<i>");
  });

  it("sin pagos ni planes (y sin el resto) sigue sin mandar correo", () => {
    expect(armarResumenDiario({ ...vacio, pagosSinPublicar: [], planesPorVencer: [] }, AHORA, BASE)).toBeNull();
  });

  it("la clave de idempotencia es por día de Bogotá", () => {
    expect(claveDelDia(AHORA)).toBe("crm-diario-2026-11-23");
    expect(claveDelDia(new Date("2026-11-24T03:00:00.000Z"))).toBe("crm-diario-2026-11-23");
  });
});

describe("reunirResumenDiario", () => {
  function lead(extra: Partial<Lead>): Lead {
    return { id: "l", tipo: "comprador", nombre: "Lead", telefono: "3001112233", fuente: "web", estado: "nuevo", creadoEn: AHORA.toISOString(), ...extra } as Lead;
  }

  it("junta seguimientos hasta hoy, vendedores por aprobar, compradores sin propuestas y leads nuevos de 48 h, sin correos", async () => {
    const crm = new MemoryCrmStore();
    const ana = (await crm.crearContacto({ nombre: "Ana", telefono: "+57 300 123 4567", email: "ana@correo.co", origen: "manual" })).contacto;
    const beto = (await crm.crearContacto({ nombre: "Beto", origen: "manual" })).contacto;
    const archivada = (await crm.crearContacto({ nombre: "Archivada", origen: "manual" })).contacto;
    await crm.fijarProximoContacto(ana.id, "2026-11-22T14:00:00.000Z", "llamar");
    await crm.fijarProximoContacto(beto.id, "2026-11-25T14:00:00.000Z"); // futuro: no va
    await crm.crearCaptacion({ contactoId: ana.id, comisionPct: 3, estatusPago: "pendiente", aprobada: false, multimedia: "por_coordinar", estado: "nueva", ubicacion: "Cedritos" });
    await crm.crearCaptacion({ contactoId: archivada.id, comisionPct: 3, estatusPago: "pendiente", aprobada: false, multimedia: "por_coordinar", estado: "nueva" });
    await crm.archivarContacto(archivada.id, true);
    const b = await crm.crearBusqueda({ contactoId: beto.id, tipo: "comprador", potencial: false, estado: "activa", ubicacion: "Chía" });
    await crm.crearBusqueda({ contactoId: ana.id, tipo: "comprador", potencial: false, estado: "cerrada" });

    const leads = [
      lead({ id: "1", nombre: "Nuevo", creadoEn: "2026-11-22T12:00:00.000Z" }),
      lead({ id: "2", nombre: "Viejo", creadoEn: "2026-11-20T12:00:00.000Z" }),
      lead({ id: "3", nombre: "Contactado", estado: "contactado" }),
    ];
    const d = await reunirResumenDiario(crm, { list: async () => leads }, AHORA);
    expect(d.seguimientos).toEqual([{ id: ana.id, nombre: "Ana", telefono: "+57 300 123 4567", at: "2026-11-22T14:00:00.000Z", nota: "llamar" }]);
    expect(d.porAprobar).toEqual([{ id: ana.id, nombre: "Ana", telefono: "+57 300 123 4567", inmueble: "Cedritos" }]);
    expect(d.compradoresSinPropuestas).toEqual([{ id: beto.id, nombre: "Beto", busca: "Chía" }]);
    expect(d.leadsNuevos.map((l) => l.nombre)).toEqual(["Nuevo"]);
    expect(JSON.stringify(d)).not.toContain("ana@correo.co");

    crm.propiedadesValidas = null;
    await crm.proponer(b.id, "p1");
    expect((await reunirResumenDiario(crm, { list: async () => [] }, AHORA)).compradoresSinPropuestas).toEqual([]);
  });

  it("con el almacén de servicios: pagos sin publicar con días desde el pago y planes que vencen en 7 días o menos, sin correos", async () => {
    const DIA = 86_400_000;
    const servicios = new MemoryServiciosStore();
    const fila = (extra: Partial<Servicio>): Servicio => ({
      id: "s",
      txId: "t",
      reference: null,
      planId: "alianza-90",
      dias: 90,
      clienteEmail: "cliente@correo.co",
      clienteNombre: "Marta",
      clienteTelefono: "3001234567",
      estado: "activo",
      propertySlug: null,
      inicioAt: null,
      venceAt: null,
      aviso7dAt: null,
      aviso1dAt: null,
      avisoVencidoAt: null,
      createdAt: new Date(AHORA.getTime() - 3 * DIA).toISOString(),
      ...extra,
    });
    servicios.filas.push(
      fila({ id: "pend", estado: "pendiente_publicar", pagadoAt: new Date(AHORA.getTime() - 5 * DIA).toISOString() }),
      fila({ id: "pronto", venceAt: new Date(AHORA.getTime() + 2 * DIA).toISOString() }),
      fila({ id: "gracia", venceAt: new Date(AHORA.getTime() - 3_600_000).toISOString() }),
      fila({ id: "lejos", venceAt: new Date(AHORA.getTime() + 20 * DIA).toISOString() }),
      fila({ id: "vencido", estado: "vencido", venceAt: new Date(AHORA.getTime() - 5 * DIA).toISOString() }),
      fila({ id: "descartado", estado: "descartado" }),
    );
    const d = await reunirResumenDiario(new MemoryCrmStore(), { list: async () => [] }, AHORA, servicios);
    expect(d.pagosSinPublicar).toEqual([{ id: "pend", nombre: "Marta", telefono: "3001234567", plan: "Alianza por resultados", diasDesdePago: 5 }]);
    expect(d.planesPorVencer?.map((p) => [p.id, p.diasRestantes])).toEqual([
      ["gracia", 0],
      ["pronto", 2],
    ]);
    expect(JSON.stringify(d)).not.toContain("cliente@correo.co");
    expect(armarResumenDiario(d, AHORA, BASE)!.text).toContain("venció: está en su día de gracia");
  });

  it("sin la tabla de servicios el resto del resumen sale igual", async () => {
    const sinTabla = { listar: async () => Promise.reject(new ServiciosNoDisponibleError("sin tabla")) };
    const d = await reunirResumenDiario(new MemoryCrmStore(), { list: async () => [] }, AHORA, sinTabla);
    expect(d.pagosSinPublicar).toEqual([]);
    expect(d.planesPorVencer).toEqual([]);
  });
});
