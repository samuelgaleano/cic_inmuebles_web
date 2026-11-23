import { describe, expect, it } from "vitest";
import type { Lead } from "@/lib/domain";
import { armarResumenDiario, claveDelDia, reunirResumenDiario, type DatosResumen } from "./resumen";
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
});
