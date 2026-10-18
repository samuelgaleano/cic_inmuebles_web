import { beforeEach, describe, expect, it } from "vitest";
import type { Lead, Property } from "@/lib/domain";
import type { Servicio } from "@/lib/servicios/vigencia";
import { MemoryCrmStore } from "./store";
import { estadoCaptacionDe, sincronizarTodo, vincularInmueble, vincularLead, vincularServicio } from "./vinculos";

function inmueble(extra: Partial<Property> = {}): Property {
  return {
    id: "p1",
    codigo: "CIC-0001",
    slug: "casa-uno",
    titulo: "Casa Uno",
    tipo: "casa",
    estado: "disponible",
    precio: 450_000_000,
    ubicacion: { ciudad: "Bogotá", sector: "Cedritos" },
    caracteristicas: {},
    descripcion: "",
    medios: [],
    propietario: { nombre: "Marta Pérez", telefono: "300 123 4567", email: "marta@ejemplo.co" },
    destacado: false,
    publicado: false,
    creadoEn: "2026-01-01T00:00:00.000Z",
    actualizadoEn: "2026-01-01T00:00:00.000Z",
    ...extra,
  };
}

function lead(extra: Partial<Lead> = {}): Lead {
  return { id: "l1", tipo: "comprador", nombre: "Luis Gómez", telefono: "+57 311 555 2020", fuente: "web", estado: "nuevo", creadoEn: "2026-10-01T10:00:00.000Z", ...extra };
}

function servicio(extra: Partial<Servicio> = {}): Servicio {
  return {
    id: "s1",
    txId: "tx1",
    reference: "CIC-x",
    planId: "alianza-90",
    dias: 90,
    clienteEmail: "ana@agencia.co",
    clienteNombre: "Ana Agente",
    clienteTelefono: "573205550001",
    estado: "activo",
    propertySlug: null,
    inicioAt: null,
    venceAt: null,
    aviso7dAt: null,
    aviso1dAt: null,
    avisoVencidoAt: null,
    createdAt: "2026-10-17T04:14:26.000Z",
    ...extra,
  };
}

describe("vínculos del CRM", () => {
  let crm: MemoryCrmStore;
  beforeEach(() => {
    crm = new MemoryCrmStore();
    crm.propiedadesValidas = new Set(["p1", "p2"]);
  });

  describe("inmuebles con propietario", () => {
    it("el propietario queda como vendedor enlazado al inmueble, con el precio del catálogo", async () => {
      expect(await vincularInmueble(crm, inmueble())).toBe("creada");
      const [c] = crm.captaciones;
      expect(c).toMatchObject({ propertyId: "p1", precioEsperado: 450_000_000, comisionPct: 3, comisionValor: 13_500_000, estatusPago: "pendiente", aprobada: false, multimedia: "por_coordinar", estado: "nueva", ubicacion: "Cedritos, Bogotá" });
      expect(crm.contactos[0]).toMatchObject({ nombre: "Marta Pérez", telefonoE164: "+573001234567", email: "marta@ejemplo.co" });
      expect(crm.actividades).toHaveLength(1);
    });

    it("repetirlo no duplica nada", async () => {
      await vincularInmueble(crm, inmueble());
      expect(await vincularInmueble(crm, inmueble())).toBe("existia");
      expect(crm.contactos).toHaveLength(1);
      expect(crm.captaciones).toHaveLength(1);
      expect(crm.actividades).toHaveLength(1);
    });

    it("publicado con fotos queda aprobado y con multimedia lista; el estado sigue al del inmueble", async () => {
      await vincularInmueble(crm, inmueble({ publicado: true, medios: [{ id: "m", type: "image", provider: "cloudinary", url: "x", order: 0, isCover: true }] }));
      expect(crm.captaciones[0]).toMatchObject({ aprobada: true, multimedia: "listo", estado: "publicada" });
      expect(await vincularInmueble(crm, inmueble({ publicado: true, estado: "vendido" }))).toBe("actualizada");
      expect(crm.captaciones[0].estado).toBe("vendida");
      expect(estadoCaptacionDe({ estado: "en_proceso", publicado: true })).toBe("en_gestion");
    });

    it("no pisa lo que el equipo ya gestionó ni resucita una captación descartada", async () => {
      await vincularInmueble(crm, inmueble());
      await crm.actualizarCaptacion(crm.captaciones[0].id, { estatusPago: "paga_completo", aprobada: true, comisionPct: 2.5 });
      await vincularInmueble(crm, inmueble({ publicado: true }));
      expect(crm.captaciones[0]).toMatchObject({ estatusPago: "paga_completo", aprobada: true, comisionPct: 2.5, estado: "publicada" });
      await crm.actualizarCaptacion(crm.captaciones[0].id, { estado: "descartada" });
      expect(await vincularInmueble(crm, inmueble())).toBe("creada"); // una nueva captación; la descartada queda como historia
      expect(crm.captaciones).toHaveLength(2);
    });

    it("sin propietario no inventa nada; con teléfono dudoso guarda a la persona y deja el número en la nota", async () => {
      expect(await vincularInmueble(crm, inmueble({ propietario: undefined }))).toBe("sin_propietario");
      expect(await vincularInmueble(crm, inmueble({ propietario: { nombre: "   ", telefono: "3001234567" } }))).toBe("sin_propietario");
      expect(crm.contactos).toHaveLength(0);
      expect(await vincularInmueble(crm, inmueble({ propietario: { nombre: "Pedro Raro", telefono: "123" } }))).toBe("creada");
      expect(crm.contactos[0].notas).toContain("123");
    });

    it("dos inmuebles del mismo propietario son una sola persona con dos captaciones", async () => {
      await vincularInmueble(crm, inmueble());
      await vincularInmueble(crm, inmueble({ id: "p2", codigo: "CIC-0002", slug: "casa-dos" }));
      expect(crm.contactos).toHaveLength(1);
      expect(crm.captaciones).toHaveLength(2);
    });
  });

  describe("leads", () => {
    it("un lead comprador crea persona, búsqueda e inmueble propuesto; repetirlo no duplica", async () => {
      const l = lead({ propertyId: "p1", propertySlug: "casa-uno", intencion: "visita", mensaje: "Quiero verlo" });
      expect(await vincularLead(crm, l)).toMatchObject({ nuevo: true });
      expect(await vincularLead(crm, l)).toMatchObject({ nuevo: false });
      expect(crm.contactos).toHaveLength(1);
      expect(crm.busquedas).toHaveLength(1);
      expect(crm.propuestas).toHaveLength(1);
      expect(crm.actividades[0].detalle).toContain("quiere agendar una visita");
    });

    it("un lead vendedor abre una captación; dos leads de la misma persona comparten el contacto", async () => {
      await vincularLead(crm, lead({ id: "l2", tipo: "vendedor", tipoInmueble: "Apartamento", ciudad: "Bogotá" }));
      await vincularLead(crm, lead({ id: "l3" }));
      expect(crm.contactos).toHaveLength(1);
      expect(crm.captaciones).toHaveLength(1);
      expect(crm.captaciones[0].ubicacion).toBe("Apartamento · Bogotá");
      expect(crm.busquedas).toHaveLength(1);
    });

    it("un inmueble propuesto que ya no existe no rompe el lead", async () => {
      await expect(vincularLead(crm, lead({ propertyId: "borrado" }))).resolves.toMatchObject({ nuevo: true });
      expect(crm.propuestas).toHaveLength(0);
    });
  });

  describe("planes de publicación", () => {
    it("quien paga un plan queda en el CRM con la compra en su línea de tiempo, una sola vez", async () => {
      expect(await vincularServicio(crm, servicio())).toBe("creado");
      expect(await vincularServicio(crm, servicio())).toBe("existia");
      expect(crm.contactos[0]).toMatchObject({ nombre: "Ana Agente", telefonoE164: "+573205550001", email: "ana@agencia.co", origen: "web" });
      expect(crm.actividades).toHaveLength(1);
      expect(crm.actividades[0].detalle).toContain("Alianza por resultados");
      expect(crm.actividades[0].ocurrioEn).toBe("2026-10-17T04:14:26.000Z");
    });

    it("sin nombre usa la parte local del correo; descartados y sin datos se omiten", async () => {
      expect(await vincularServicio(crm, servicio({ id: "s2", clienteNombre: null, clienteTelefono: null, clienteEmail: "carlos.diaz@agencia.co" }))).toBe("creado");
      expect(crm.contactos[0].nombre).toBe("carlos.diaz");
      expect(await vincularServicio(crm, servicio({ id: "s3", estado: "descartado" }))).toBe("sin_datos");
      expect(await vincularServicio(crm, servicio({ id: "s4", clienteNombre: null, clienteEmail: null }))).toBe("sin_datos");
    });
  });

  it("sincronizarTodo pone al día todo, ignora los leads descartados y es idempotente", async () => {
    const datos = {
      propiedades: [inmueble(), inmueble({ id: "p2", codigo: "CIC-0002", slug: "dos", propietario: undefined })],
      leads: [lead(), lead({ id: "spam", nombre: "Bot", telefono: "+57 300 999 8888", estado: "descartado" })],
      servicios: [servicio()],
    };
    const a = await sincronizarTodo(crm, datos);
    expect(a.inmuebles).toMatchObject({ creada: 1, sin_propietario: 1, errores: 0 });
    expect(a.leads).toMatchObject({ vinculados: 1, omitidos: 1, errores: 0 });
    expect(a.servicios).toMatchObject({ creados: 1, errores: 0 });
    expect(crm.contactos.map((c) => c.nombre).sort()).toEqual(["Ana Agente", "Luis Gómez", "Marta Pérez"]);

    const b = await sincronizarTodo(crm, datos);
    expect(b.inmuebles).toMatchObject({ creada: 0, existia: 1 });
    expect(b.leads).toMatchObject({ vinculados: 0, yaEstaban: 1 });
    expect(b.servicios).toMatchObject({ creados: 0, yaEstaban: 1 });
    expect(crm.contactos).toHaveLength(3);
  });

  it("un registro con error no frena a los demás", async () => {
    const roto: Property = inmueble({ id: "fantasma" }); // el inmueble no existe para la llave foránea simulada
    const r = await sincronizarTodo(crm, {
      propiedades: [roto, inmueble({ id: "p2", codigo: "CIC-0002", slug: "dos", propietario: { nombre: "Eva Sol", telefono: "312 555 0000" } })],
      leads: [],
      servicios: [],
    });
    expect(r.inmuebles).toMatchObject({ errores: 1, creada: 1 });
  });
});
