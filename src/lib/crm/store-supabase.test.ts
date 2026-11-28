import { beforeEach, describe, expect, it, vi } from "vitest";

/**
 * SupabaseCrmStore y el repositorio de leads contra un PostgREST falso: que usen la vista y las llaves de la 0013
 * cuando existen y que, sin la migración (o sin la 0012), degraden al método anterior en vez de romper el panel.
 */

type Op = [string, unknown[]];
interface Consulta {
  tabla: string;
  ops: Op[];
}
type Respuesta = { data?: unknown; error?: { message: string; code?: string } | null; count?: number | null };

const estado = vi.hoisted(() => ({ handler: (_q: Consulta): Respuesta => ({ data: [] }), consultas: [] as Consulta[] }));

/** Cadena de PostgREST que anota cada llamada y, al esperarla, responde con `estado.handler`. */
function cliente() {
  return {
    from(tabla: string) {
      const q: Consulta = { tabla, ops: [] };
      estado.consultas.push(q);
      const b: Record<string, unknown> = new Proxy(
        {},
        {
          get(_t, prop) {
            if (prop === "then") {
              return (ok: (v: unknown) => unknown, ko: (e: unknown) => unknown) => {
                const r = estado.handler(q);
                return Promise.resolve({ data: r.data ?? null, error: r.error ?? null, count: r.count ?? null }).then(ok, ko);
              };
            }
            return (...args: unknown[]) => {
              q.ops.push([String(prop), args]);
              return b;
            };
          },
        },
      );
      return b;
    },
  };
}

vi.mock("@/lib/data/supabase/client", () => ({ getSupabaseAdmin: () => cliente(), isSupabaseConfigured: () => true }));

const { getCrmStore } = await import("./store");
const { createSupabaseRepository } = await import("@/lib/data/supabase-repository");

const op = (q: Consulta, nombre: string) => q.ops.find(([n]) => n === nombre)?.[1];
const UUID_A = "11111111-1111-4111-8111-111111111111";
const UUID_LEAD = "22222222-2222-4222-8222-222222222222";
const fila = (id: string, nombre: string, extra: Record<string, unknown> = {}) => ({
  id,
  nombre,
  telefono: null,
  telefono_e164: null,
  email: null,
  ciudad: null,
  notas: null,
  origen: "web",
  archivado: false,
  created_at: "2026-11-01T00:00:00.000Z",
  proximo_contacto_at: null,
  proximo_contacto_nota: null,
  ...extra,
});

beforeEach(() => {
  delete (globalThis as { __crmStore?: unknown }).__crmStore;
  estado.consultas = [];
});

describe("SupabaseCrmStore con y sin la migración 0013", () => {
  it("pagina la vista contactos_resumen con filtros, orden, rango y conteo", async () => {
    estado.handler = (q) => (q.tabla === "contactos_resumen" ? { data: [fila(UUID_A, "Ana", { captaciones: 2, busquedas: 0, ultima_actividad: "2026-11-05T00:00:00.000Z" })], count: 73 } : { data: [] });
    const r = await getCrmStore().paginaContactos({ tipo: "vendedor", origen: "web", sinProximo: true, pagina: 2 });
    expect(r).toMatchObject({ total: 73, pagina: 2, porPagina: 50 });
    expect(r.filas[0]).toMatchObject({ id: UUID_A, captaciones: 2, busquedas: 0, ultimaActividad: "2026-11-05T00:00:00.000Z" });
    const q = estado.consultas[0];
    expect(q.tabla).toBe("contactos_resumen");
    expect(op(q, "range")).toEqual([50, 99]);
    expect(op(q, "gt")).toEqual(["captaciones", 0]);
    expect(op(q, "is")).toEqual(["proximo_contacto_at", null]);
    expect(q.ops.filter(([n]) => n === "eq")).toEqual([
      ["eq", ["archivado", false]],
      ["eq", ["origen", "web"]],
    ]);
    // Una sola consulta: ni in() de ids ni lecturas de captaciones, búsquedas o actividades.
    expect(estado.consultas).toHaveLength(1);
  });

  it("sin la vista usa el método anterior (y no la vuelve a pedir)", async () => {
    estado.handler = (q) => {
      if (q.tabla === "contactos_resumen") return { error: { code: "PGRST205", message: "Could not find the table 'public.contactos_resumen' in the schema cache" } };
      if (q.tabla === "contactos") return { data: [fila(UUID_A, "Ana")] };
      if (q.tabla === "captaciones") return { data: [{ contacto_id: UUID_A }] };
      return { data: [] };
    };
    const crm = getCrmStore();
    const r = await crm.paginaContactos({ tipo: "vendedor" });
    expect(r.total).toBe(1);
    expect(r.filas[0]).toMatchObject({ nombre: "Ana", captaciones: 1 });
    estado.consultas = [];
    await crm.paginaContactos({});
    expect(estado.consultas.some((q) => q.tabla === "contactos_resumen")).toBe(false);
  });

  it("la actividad de un lead se busca por su llave; sin la columna, por la marca del texto", async () => {
    estado.handler = (q) => (q.tabla === "actividades" && op(q, "eq")?.[0] === "lead_id" ? { data: [{ id: "a1", contacto_id: UUID_A, property_id: null, tipo: "nota", detalle: "x", ocurrio_en: "2026-11-01T00:00:00.000Z" }] } : { data: [] });
    const crm = getCrmStore();
    expect(await crm.existeActividad({ tipo: "lead", id: UUID_LEAD }, UUID_A)).toBe(true);
    const { nueva } = await crm.registrarActividadUnica({ contactoId: UUID_A, tipo: "nota", detalle: `Lead [lead:${UUID_LEAD}]` }, { tipo: "lead", id: UUID_LEAD });
    expect(nueva).toBe(false);
    expect(estado.consultas.some((q) => op(q, "insert"))).toBe(false);

    // Base sin la 0013: la columna no existe.
    delete (globalThis as { __crmStore?: unknown }).__crmStore;
    estado.handler = (q) => {
      if (q.tabla === "actividades" && op(q, "eq")?.[0] === "lead_id") return { error: { code: "42703", message: "column actividades.lead_id does not exist" } };
      if (q.tabla === "actividades" && op(q, "insert")) return { data: { id: "a2", contacto_id: UUID_A, property_id: null, tipo: "nota", detalle: "y", ocurrio_en: "2026-11-01T00:00:00.000Z" } };
      if (q.tabla === "actividades") return { data: [{ id: "a1", contacto_id: UUID_A, property_id: null, tipo: "nota", detalle: "otra cosa", ocurrio_en: "2026-11-01T00:00:00.000Z" }] };
      return { data: [] };
    };
    const sin = getCrmStore();
    expect(await sin.existeActividad({ tipo: "lead", id: UUID_LEAD }, UUID_A)).toBe(false);
    estado.consultas = [];
    const r = await sin.registrarActividadUnica({ contactoId: UUID_A, tipo: "nota", detalle: `Lead [lead:${UUID_LEAD}]` }, { tipo: "lead", id: UUID_LEAD });
    expect(r.nueva).toBe(true);
    const ins = estado.consultas.find((q) => op(q, "insert"));
    // Se inserta sin la columna que no existe.
    expect(op(ins!, "insert")?.[0]).not.toHaveProperty("lead_id");
  });

  it("crear la búsqueda de un lead que ya la tiene devuelve esa (índice único)", async () => {
    const existente = { id: "b1", contacto_id: UUID_A, tipo: "comprador", ubicacion: null, precio_max: null, especificacion: null, potencial: false, estado: "activa", notas: null, created_at: "2026-11-01T00:00:00.000Z" };
    estado.handler = (q) => {
      if (q.tabla === "busquedas" && op(q, "insert")) return { error: { code: "23505", message: 'duplicate key value violates unique constraint "busquedas_lead_uk"' } };
      if (q.tabla === "busquedas") return { data: existente };
      return { data: [] };
    };
    const b = await getCrmStore().crearBusqueda({ contactoId: UUID_A, tipo: "comprador", potencial: false, estado: "activa" }, { leadId: UUID_LEAD });
    expect(b.id).toBe("b1");
    expect(op(estado.consultas[0], "insert")?.[0]).toMatchObject({ lead_id: UUID_LEAD });
    expect(op(estado.consultas[1], "eq")).toEqual(["lead_id", UUID_LEAD]);
  });

  it("«Por hacer» se arma con conteos y anti-joins de PostgREST, sin traer tablas", async () => {
    estado.handler = (q) => ({ data: q.tabla === "contactos" ? [] : [{ contacto_id: UUID_A, contactos: { id: UUID_A, nombre: "Ana", telefono: "300", email: null, archivado: false } }], count: 7 });
    const p = await getCrmStore().pendientes(3);
    expect(p.porAprobar).toEqual({ total: 7, items: [{ id: UUID_A, nombre: "Ana", telefono: "300", archivado: false }] });
    expect(p.totales).toEqual({ contactos: 7, vendedores: 7, compradores: 7 });
    // Toda consulta que trae filas lleva tope; las demás solo cuentan (head).
    for (const q of estado.consultas) {
      const soloCuenta = (op(q, "select")?.[1] as { head?: boolean } | undefined)?.head === true;
      expect(soloCuenta || q.ops.some(([n]) => n === "limit")).toBe(true);
    }
    const sinPropuestas = estado.consultas.find((q) => q.tabla === "busquedas" && q.ops.some(([n, a]) => n === "is" && a[0] === "busqueda_inmuebles"));
    expect(sinPropuestas).toBeDefined();
  });
});

describe("repositorio de leads", () => {
  it("primer contacto: solo los que no lo tienen y, sin la columna de 0012, no rompe", async () => {
    const repo = createSupabaseRepository();
    estado.handler = () => ({ data: [{ id: UUID_LEAD }] });
    expect(await repo.leads.marcarPrimerContacto([UUID_LEAD, "no-uuid"], "2026-11-28T15:00:00.000Z")).toBe(1);
    const q = estado.consultas[0];
    expect(op(q, "update")).toEqual([{ primer_contacto_at: "2026-11-28T15:00:00.000Z" }]);
    expect(op(q, "is")).toEqual(["primer_contacto_at", null]);
    expect(op(q, "in")).toEqual(["id", [UUID_LEAD]]);
    estado.handler = () => ({ error: { code: "PGRST204", message: "Could not find the 'primer_contacto_at' column of 'leads' in the schema cache" } });
    expect(await repo.leads.marcarPrimerContacto([UUID_LEAD], "2026-11-28T15:00:00.000Z")).toBe(0);
  });

  it("suprimir: sin la columna suprimido_at los deja descartados", async () => {
    const repo = createSupabaseRepository();
    let n = 0;
    estado.handler = () => (n++ === 0 ? { error: { code: "PGRST204", message: "Could not find the 'suprimido_at' column of 'leads' in the schema cache" } } : { data: [{ id: UUID_LEAD }] });
    expect(await repo.leads.suprimir([UUID_LEAD], "2026-11-28T15:00:00.000Z")).toBe(1);
    expect(op(estado.consultas[1], "update")?.[0]).toMatchObject({ nombre: "Suprimido", telefono: "", email: null, mensaje: null, estado: "descartado" });
  });

  it("la página de leads pide un rango y el conteo", async () => {
    const repo = createSupabaseRepository();
    estado.handler = () => ({ data: [], count: 120 });
    expect(await repo.leads.listPage({ pagina: 3, porPagina: 50, estado: "nuevo" })).toEqual({ leads: [], total: 120 });
    expect(op(estado.consultas[0], "range")).toEqual([100, 149]);
    expect(op(estado.consultas[0], "eq")).toEqual(["estado", "nuevo"]);
  });
});
