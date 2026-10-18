import { beforeEach, describe, expect, it } from "vitest";
import type { Property } from "@/lib/domain";
import { comisionValor, leerPorcentaje, leerPrecio, sinTildes, sugerirInmuebles, validarContacto } from "./reglas";
import { CrmStoreError, MemoryCrmStore } from "./store";

function inmueble(extra: Partial<Property> & { id: string }): Property {
  return {
    codigo: extra.id,
    slug: `slug-${extra.id}`,
    titulo: "Apartamento",
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
    ...extra,
  };
}

describe("reglas del CRM", () => {
  it("la comisión se calcula por porcentaje y no falla sin precio (la hoja daba #VALUE!)", () => {
    expect(comisionValor(450_000_000, 3)).toBe(13_500_000);
    expect(comisionValor(450_000_000, 2.5)).toBe(11_250_000);
    expect(comisionValor(undefined, 3)).toBeUndefined();
    expect(comisionValor(null, 3)).toBeUndefined();
  });

  it("lee precios como los escribe la gente", () => {
    expect(leerPrecio("450.000.000")).toBe(450_000_000);
    expect(leerPrecio("$ 450,000,000")).toBe(450_000_000);
    expect(leerPrecio("450000000")).toBe(450_000_000);
    expect(leerPrecio("")).toBeUndefined();
    expect(leerPrecio("  ")).toBeUndefined();
    expect(leerPrecio("mucho")).toBeNull();
    expect(leerPrecio("-5")).toBeNull();
    expect(leerPrecio("1e9")).toBeNull();
  });

  it("lee porcentajes con coma o punto y rechaza lo fuera de rango", () => {
    expect(leerPorcentaje("3")).toBe(3);
    expect(leerPorcentaje("2,5")).toBe(2.5);
    expect(leerPorcentaje("")).toBe(3);
    expect(leerPorcentaje("101")).toBeNull();
    expect(leerPorcentaje("-1")).toBeNull();
    expect(leerPorcentaje("tres")).toBeNull();
  });

  it("valida el contacto: nombre obligatorio, teléfono normalizado, correo en minúscula", () => {
    const ok = validarContacto({ nombre: "  Marta   Pérez ", telefono: "300 123 4567", email: " MARTA@Ejemplo.CO " });
    expect(ok).toMatchObject({ ok: true, valor: { nombre: "Marta Pérez", telefono: "+57 300 123 4567", telefonoE164: "+573001234567", email: "marta@ejemplo.co", origen: "manual" } });
    expect(validarContacto({ nombre: "A" })).toMatchObject({ ok: false, errores: { nombre: expect.any(String) } });
    expect(validarContacto({ nombre: "Ana", telefono: "123" })).toMatchObject({ ok: false, errores: { telefono: expect.any(String) } });
    expect(validarContacto({ nombre: "Ana", email: "no-es-correo" })).toMatchObject({ ok: false, errores: { email: expect.any(String) } });
    const sinOpcionales = validarContacto({ nombre: "Ana" });
    expect(sinOpcionales).toMatchObject({ ok: true });
    if (sinOpcionales.ok) expect(Object.keys(sinOpcionales.valor).sort()).toEqual(["nombre", "origen"]);
  });

  it("sinTildes compara ubicaciones escritas a mano", () => {
    expect(sinTildes("  Bogotá, D.C.  ")).toBe("bogota d c");
    expect(sinTildes("Chicó-Navarra")).toBe("chico navarra");
  });

  describe("inmuebles sugeridos", () => {
    const todos = [
      inmueble({ id: "a", precio: 350_000_000, ubicacion: { ciudad: "Bogotá", sector: "Cedritos" } }),
      inmueble({ id: "b", precio: 440_000_000, ubicacion: { ciudad: "Bogotá", sector: "Chicó" } }),
      inmueble({ id: "c", precio: 600_000_000, ubicacion: { ciudad: "Bogotá", sector: "Cedritos" } }),
      inmueble({ id: "d", precio: 300_000_000, estado: "vendido", ubicacion: { ciudad: "Bogotá", sector: "Cedritos" } }),
      inmueble({ id: "e", precio: 480_000_000, ubicacion: { ciudad: "Medellín", sector: "Laureles" } }),
    ];

    it("respeta presupuesto (con 10 % de margen) y zona, y deja fuera lo vendido", () => {
      const r = sugerirInmuebles({ ubicacion: "cerca de Cedritos", precioMax: 450_000_000 }, todos);
      expect(r.map((s) => s.property.id)).toEqual(["a"]);
      expect(r[0].motivo).toContain("dentro del presupuesto");
      expect(r[0].motivo).toContain("cedritos");
    });

    it("con solo presupuesto devuelve lo que cabe, más barato dentro del margen incluido", () => {
      const ids = sugerirInmuebles({ precioMax: 440_000_000 }, todos).map((s) => s.property.id);
      expect(ids).toContain("a");
      expect(ids).toContain("b");
      expect(ids).toContain("e"); // 480 M = 9 % sobre el presupuesto
      expect(ids).not.toContain("c");
      expect(ids).not.toContain("d");
    });

    it("excluye los ya propuestos y respeta el límite", () => {
      expect(sugerirInmuebles({ precioMax: 1_000_000_000 }, todos, ["a", "b"]).map((s) => s.property.id).sort()).toEqual(["c", "e"]);
      expect(sugerirInmuebles({ precioMax: 1_000_000_000 }, todos, [], 2)).toHaveLength(2);
    });

    it("sin criterios sugiere los disponibles; con una zona sin coincidencias, nada", () => {
      expect(sugerirInmuebles({}, todos)).toHaveLength(4);
      expect(sugerirInmuebles({ ubicacion: "Cartagena" }, todos)).toEqual([]);
    });
  });
});

describe("almacén del CRM (memoria, mismas reglas que la base)", () => {
  let crm: MemoryCrmStore;
  const base = { origen: "manual" as const };

  beforeEach(() => {
    crm = new MemoryCrmStore();
    crm.propiedadesValidas = new Set(["p1", "p2"]);
  });

  it("no duplica a una persona con el mismo teléfono: devuelve la existente", async () => {
    const a = await crm.crearContacto({ ...base, nombre: "Ana", telefonoE164: "+573001112233" });
    const b = await crm.crearContacto({ ...base, nombre: "Ana P.", telefonoE164: "+573001112233" });
    expect(a.creado).toBe(true);
    expect(b.creado).toBe(false);
    expect(b.contacto.id).toBe(a.contacto.id);
    expect(crm.contactos).toHaveLength(1);
  });

  it("una misma persona puede ser vendedora y compradora; el listado lo refleja", async () => {
    const { contacto } = await crm.crearContacto({ ...base, nombre: "Luis" });
    await crm.crearCaptacion({ contactoId: contacto.id, propertyId: "p1", comisionPct: 3, estatusPago: "pendiente", aprobada: false, multimedia: "por_coordinar", estado: "nueva", precioEsperado: 450_000_000 });
    await crm.crearBusqueda({ contactoId: contacto.id, tipo: "comprador", potencial: true, estado: "activa" });
    const [fila] = await crm.listarContactos();
    expect(fila).toMatchObject({ captaciones: 1, busquedas: 1 });
    expect((await crm.listarCaptaciones(contacto.id))[0].comisionValor).toBe(13_500_000);
  });

  it("la comisión se recalcula al cambiar el porcentaje o el precio", async () => {
    const { contacto } = await crm.crearContacto({ ...base, nombre: "Luis" });
    const c = await crm.crearCaptacion({ contactoId: contacto.id, comisionPct: 3, estatusPago: "pendiente", aprobada: false, multimedia: "por_coordinar", estado: "nueva" });
    expect(c.comisionValor).toBeUndefined();
    expect((await crm.actualizarCaptacion(c.id, { precioEsperado: 200_000_000 }))?.comisionValor).toBe(6_000_000);
    expect((await crm.actualizarCaptacion(c.id, { comisionPct: 2 }))?.comisionValor).toBe(4_000_000);
    expect((await crm.actualizarCaptacion(c.id, { precioEsperado: undefined }))?.comisionValor).toBeUndefined();
  });

  it("un inmueble solo tiene una captación vigente (pero se puede volver a captar si la anterior se descartó)", async () => {
    const { contacto } = await crm.crearContacto({ ...base, nombre: "Luis" });
    const nueva = { contactoId: contacto.id, propertyId: "p1", comisionPct: 3, estatusPago: "pendiente" as const, aprobada: false, multimedia: "por_coordinar" as const, estado: "nueva" as const };
    const primera = await crm.crearCaptacion(nueva);
    await expect(crm.crearCaptacion(nueva)).rejects.toThrow(CrmStoreError);
    await crm.actualizarCaptacion(primera.id, { estado: "descartada" });
    await expect(crm.crearCaptacion(nueva)).resolves.toMatchObject({ propertyId: "p1" });
  });

  it("las llaves foráneas se respetan: contacto o inmueble inexistente", async () => {
    await expect(crm.crearCaptacion({ contactoId: "no-existe", comisionPct: 3, estatusPago: "pendiente", aprobada: false, multimedia: "por_coordinar", estado: "nueva" })).rejects.toThrow(/llave/);
    const { contacto } = await crm.crearContacto({ ...base, nombre: "Luis" });
    await expect(crm.crearCaptacion({ contactoId: contacto.id, propertyId: "fantasma", comisionPct: 3, estatusPago: "pendiente", aprobada: false, multimedia: "por_coordinar", estado: "nueva" })).rejects.toThrow(/llave/);
    await expect(crm.registrarActividad({ contactoId: contacto.id, propertyId: "fantasma", tipo: "nota", detalle: "x" })).rejects.toThrow(/llave/);
    await expect(crm.proponer("sin-busqueda", "p1")).rejects.toThrow(/llave/);
  });

  it("proponer es idempotente y la propuesta cambia de estado o se quita", async () => {
    const { contacto } = await crm.crearContacto({ ...base, nombre: "Eva" });
    const b = await crm.crearBusqueda({ contactoId: contacto.id, tipo: "inmobiliaria", potencial: false, estado: "activa" });
    await crm.proponer(b.id, "p1");
    await crm.proponer(b.id, "p1");
    await crm.proponer(b.id, "p2");
    expect(await crm.listarPropuestas([b.id])).toHaveLength(2);
    await crm.cambiarEstadoPropuesta(b.id, "p1", "visito");
    expect((await crm.listarPropuestas([b.id])).find((p) => p.propertyId === "p1")?.estado).toBe("visito");
    await crm.quitarPropuesta(b.id, "p1");
    expect((await crm.listarPropuestas([b.id])).map((p) => p.propertyId)).toEqual(["p2"]);
    expect(await crm.listarPropuestas([])).toEqual([]);
  });

  it("la línea de tiempo va de lo más nuevo a lo más viejo y alimenta «última actividad»", async () => {
    const { contacto } = await crm.crearContacto({ ...base, nombre: "Eva" });
    await crm.registrarActividad({ contactoId: contacto.id, tipo: "llamada", detalle: "primera", ocurrioEn: "2026-10-01T10:00:00.000Z" });
    await crm.registrarActividad({ contactoId: contacto.id, tipo: "visita", detalle: "segunda", ocurrioEn: "2026-10-05T10:00:00.000Z" });
    expect((await crm.listarActividades(contacto.id)).map((a) => a.detalle)).toEqual(["segunda", "primera"]);
    expect((await crm.listarContactos())[0].ultimaActividad).toBe("2026-10-05T10:00:00.000Z");
  });

  it("buscar por nombre, teléfono o correo; archivar oculta sin borrar", async () => {
    const a = await crm.crearContacto({ ...base, nombre: "Marta Pérez", telefono: "+57 300 123 4567", telefonoE164: "+573001234567", email: "marta@ejemplo.co" });
    await crm.crearContacto({ ...base, nombre: "Otro" });
    expect(await crm.listarContactos({ q: "marta" })).toHaveLength(1);
    expect(await crm.listarContactos({ q: "123 4567" })).toHaveLength(1);
    expect(await crm.listarContactos({ q: "ejemplo.co" })).toHaveLength(1);
    await crm.archivarContacto(a.contacto.id, true);
    expect(await crm.listarContactos()).toHaveLength(1);
    expect(await crm.listarContactos({ incluirArchivados: true })).toHaveLength(2);
    expect(await crm.obtenerContacto(a.contacto.id)).toMatchObject({ archivado: true });
  });

  it("actualizar un contacto puede vaciar campos y no permite el teléfono de otra persona", async () => {
    const a = await crm.crearContacto({ ...base, nombre: "Ana", email: "a@b.co", telefonoE164: "+573001112233" });
    await crm.crearContacto({ ...base, nombre: "Otro", telefonoE164: "+573009998877" });
    const c = await crm.actualizarContacto(a.contacto.id, { email: undefined, ciudad: "Bogotá" });
    expect(c?.email).toBeUndefined();
    expect(c?.ciudad).toBe("Bogotá");
    await expect(crm.actualizarContacto(a.contacto.id, { telefonoE164: "+573009998877" })).rejects.toThrow(CrmStoreError);
  });
});
