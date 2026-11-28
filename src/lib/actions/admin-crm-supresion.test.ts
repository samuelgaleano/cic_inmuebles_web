import { beforeEach, describe, expect, it, vi } from "vitest";
import { MemoryCrmStore, NOMBRE_SUPRIMIDO, TEXTO_SUPRIMIDO } from "@/lib/crm/store";
import { createMemoryRepository } from "@/lib/data/memory-repository";
import type { Repository } from "@/lib/data/repository";

/** Acciones del panel: supresión (Ley 1581), primera respuesta del lead y visita realizada desde la agenda. */

const { estado, redirigir } = vi.hoisted(() => ({
  estado: { crm: null as unknown, repo: null as unknown },
  redirigir: vi.fn((url: string) => {
    throw new Error(`NEXT_REDIRECT:${url}`);
  }),
}));

vi.mock("@/lib/auth", () => ({ exigirAdmin: async () => ({ email: "jefe@cic.com" }) }));
vi.mock("next/navigation", () => ({
  redirect: redirigir,
  unstable_rethrow: (e: unknown) => {
    if (e instanceof Error && e.message.startsWith("NEXT_REDIRECT")) throw e;
  },
}));
vi.mock("next/cache", () => ({ revalidatePath: vi.fn(), revalidateTag: vi.fn() }));
vi.mock("@/lib/crm/store", async (original) => ({ ...(await original<typeof import("@/lib/crm/store")>()), getCrmStore: () => estado.crm }));
vi.mock("@/lib/integrations/sheets", () => ({ isSheetsConfigured: () => false, syncPropertyToSheet: async () => undefined }));
vi.mock("@/lib/data", () => ({ getRepository: () => estado.repo }));

const crmAcciones = await import("./admin-crm");
const leadsAcciones = await import("./admin-leads");
const agenda = await import("./admin-agenda");

function form(campos: Record<string, string>): FormData {
  const fd = new FormData();
  for (const [k, v] of Object.entries(campos)) fd.set(k, v);
  return fd;
}

async function redirigeA(p: Promise<unknown>): Promise<string> {
  try {
    await p;
  } catch (e) {
    if (e instanceof Error && e.message.startsWith("NEXT_REDIRECT:")) return decodeURIComponent(e.message.slice("NEXT_REDIRECT:".length));
    throw e;
  }
  return "";
}

let crm: MemoryCrmStore;
let repo: Repository;
beforeEach(() => {
  crm = new MemoryCrmStore();
  repo = createMemoryRepository();
  estado.crm = crm;
  estado.repo = repo;
  redirigir.mockClear();
});

describe("Suprimir datos de esta persona", () => {
  it("pide la confirmación escrita (segundo paso) y sin ella no toca nada", async () => {
    const { contacto } = await crm.crearContacto({ nombre: "Marta Pérez", telefono: "300 123 4567", telefonoE164: "+573001234567", origen: "web" });
    const url = await redirigeA(crmAcciones.suprimirDatosAction(form({ contactoId: contacto.id, confirmar: "si" })));
    expect(url).toContain("escribe SUPRIMIR");
    expect((await crm.obtenerContacto(contacto.id))?.nombre).toBe("Marta Pérez");
  });

  it("anonimiza contacto, leads, citas y propietario del inmueble; conserva montos y deja constancia", async () => {
    const inmueble = (await repo.properties.list())[0];
    await repo.properties.update(inmueble.id, { propietario: { nombre: "Marta Pérez", telefono: "300 123 4567", email: "marta@ejemplo.co" } });
    const lead = await repo.leads.create({ tipo: "vendedor", nombre: "Marta Pérez", telefono: "+57 300 123 4567", email: "marta@ejemplo.co", mensaje: "Vendo mi apto, llamar después de las 6", fuente: "web" });
    const { contacto } = await crm.crearContacto({ nombre: "Marta Pérez", telefono: "300 123 4567", telefonoE164: "+573001234567", email: "marta@ejemplo.co", origen: "web" });
    await crm.crearCaptacion({ contactoId: contacto.id, propertyId: inmueble.id, precioEsperado: 400_000_000, comisionPct: 3, estatusPago: "pendiente", aprobada: true, multimedia: "listo", estado: "publicada" });
    await crm.registrarActividad({ contactoId: contacto.id, tipo: "llamada", detalle: "Contó detalles de su familia" });
    await repo.appointments.create({ propertyId: inmueble.id, contactoId: contacto.id, clienteNombre: "Marta Pérez", clienteTelefono: "300 123 4567", inicioEn: "2026-12-01T15:00:00.000Z", duracionMin: 60 });

    const url = await redirigeA(crmAcciones.suprimirDatosAction(form({ contactoId: contacto.id, confirmar: "suprimir" })));
    expect(url).toBe(`/admin/crm/contactos/${contacto.id}`);

    expect(await crm.obtenerContacto(contacto.id)).toMatchObject({ nombre: NOMBRE_SUPRIMIDO, archivado: true });
    const l = await repo.leads.getById(lead.id);
    expect(l).toMatchObject({ nombre: NOMBRE_SUPRIMIDO, telefono: "" });
    expect(l?.email).toBeUndefined();
    expect(l?.mensaje).toBeUndefined();
    expect(l?.suprimidoAt).toBeDefined();
    const [cita] = await repo.appointments.list();
    expect(cita).toMatchObject({ clienteNombre: NOMBRE_SUPRIMIDO, clienteTelefono: "" });
    expect((await repo.properties.getById(inmueble.id))?.propietario).toBeUndefined();
    expect(crm.captaciones[0].precioEsperado).toBe(400_000_000);
    const acts = await crm.listarActividades(contacto.id);
    expect(acts.find((a) => a.tipo === "llamada")?.detalle).toBe(TEXTO_SUPRIMIDO);
    expect(acts[0].detalle).toMatch(/^Datos suprimidos el \d{4}-\d{2}-\d{2} a pedido de la persona \(Ley 1581\)/);
  });
});

describe("primera respuesta del lead", () => {
  it("se marca al pulsar WhatsApp o llamar y al sacarlo de «nuevo», sin pisar la primera", async () => {
    const a = await repo.leads.create({ tipo: "comprador", nombre: "Ana", telefono: "+57 300 000 0001", fuente: "web" });
    const b = await repo.leads.create({ tipo: "comprador", nombre: "Beto", telefono: "+57 300 000 0002", fuente: "web" });
    // ids de memoria: uuid v4 (randomUUID), válidos para la acción.
    await leadsAcciones.registrarPrimerContactoAction({ leadId: a.id });
    const primera = (await repo.leads.getById(a.id))?.primerContactoAt;
    expect(primera).toBeDefined();
    await new Promise((r) => setTimeout(r, 5));
    await leadsAcciones.registrarPrimerContactoAction({ leadId: a.id });
    expect((await repo.leads.getById(a.id))?.primerContactoAt).toBe(primera);

    await leadsAcciones.setLeadStatusAction(form({ id: b.id, estado: "contactado" }));
    expect((await repo.leads.getById(b.id))?.primerContactoAt).toBeDefined();
  });

  it("descartar un lead nuevo no cuenta como respuesta", async () => {
    const c = await repo.leads.create({ tipo: "comprador", nombre: "Caro", telefono: "+57 300 000 0003", fuente: "web" });
    await leadsAcciones.setLeadStatusAction(form({ id: c.id, estado: "descartado" }));
    expect((await repo.leads.getById(c.id))?.primerContactoAt).toBeUndefined();
  });

  it("desde la ficha del contacto marca los leads de esa persona", async () => {
    const l = await repo.leads.create({ tipo: "comprador", nombre: "Dani", telefono: "+57 300 000 0004", fuente: "web" });
    const { contacto } = await crm.crearContacto({ nombre: "Dani", telefono: "300 000 0004", telefonoE164: "+573000000004", origen: "web" });
    await leadsAcciones.registrarPrimerContactoAction({ contactoId: contacto.id });
    expect((await repo.leads.getById(l.id))?.primerContactoAt).toBeDefined();
  });
});

describe("agenda: cita realizada", () => {
  it("registra la visita en el CRM y pasa la propuesta a «visitó»", async () => {
    const inmueble = (await repo.properties.list())[0];
    const { contacto } = await crm.crearContacto({ nombre: "Eva", telefono: "300 000 0005", telefonoE164: "+573000000005", origen: "web" });
    const b = await crm.crearBusqueda({ contactoId: contacto.id, tipo: "comprador", potencial: false, estado: "activa" });
    await crm.proponer(b.id, inmueble.id);
    // Agendada desde la ficha: vuelve a la ficha y la cita queda enlazada a la persona.
    const url = await redirigeA(
      agenda.createAppointmentAction(form({ propertyId: inmueble.id, clienteNombre: "Eva", clienteTelefono: "300 000 0005", inicioEn: "2026-12-02T10:00", contactoId: contacto.id, volver: "ficha" })),
    );
    expect(url).toBe(`/admin/crm/contactos/${contacto.id}`);
    const [cita] = await repo.appointments.list();
    expect(cita.contactoId).toBe(contacto.id);

    await agenda.setAppointmentStatusAction(form({ id: cita.id, estado: "realizada" }));
    expect((await crm.listarPropuestas([b.id]))[0].estado).toBe("visito");
    const visita = (await crm.listarActividades(contacto.id)).find((a) => a.tipo === "visita");
    expect(visita?.detalle).toContain(inmueble.codigo);
    await agenda.setAppointmentStatusAction(form({ id: cita.id, estado: "realizada" }));
    expect((await crm.listarActividades(contacto.id)).filter((a) => a.tipo === "visita")).toHaveLength(1);
  });
});
