import { beforeEach, describe, expect, it, vi } from "vitest";

/**
 * Store de Supabase contra un cliente falso: la renovación pagada usa la función SQL de 0011
 * (`aplicar_renovacion`) y, si la función no existe todavía, cae al camino anterior por pasos.
 */

type Respuesta = { data: unknown; error: { message: string; code?: string } | null };

const estado = vi.hoisted(() => ({
  rpc: null as null | ((nombre: string, args: Record<string, unknown>) => { data: unknown; error: { message: string; code?: string } | null }),
  respuestas: {} as Record<string, { data: unknown; error: { message: string; code?: string } | null }>,
  llamadas: [] as string[],
  rpcArgs: [] as Record<string, unknown>[],
}));

function builder(tabla: string) {
  let op = "";
  const b: Record<string, unknown> = {};
  const resolver = (): Promise<Respuesta> => {
    estado.llamadas.push(`${tabla}.${op}`);
    return Promise.resolve(estado.respuestas[`${tabla}.${op}`] ?? { data: null, error: null });
  };
  for (const m of ["insert", "update", "delete", "select", "upsert"]) {
    b[m] = () => {
      if (!op) op = m;
      return b;
    };
  }
  for (const m of ["eq", "is", "in", "lt", "lte", "gte", "order", "limit", "or"]) b[m] = () => b;
  b.maybeSingle = resolver;
  b.single = resolver;
  b.then = (ok: (r: Respuesta) => unknown, ko: (e: unknown) => unknown) => resolver().then(ok, ko);
  return b;
}

vi.mock("@/lib/data/supabase/client", () => ({
  isSupabaseConfigured: () => true,
  getSupabaseAdmin: () => ({
    from: (tabla: string) => builder(tabla),
    rpc: async (nombre: string, args: Record<string, unknown>) => {
      estado.rpcArgs.push(args);
      estado.llamadas.push(`rpc.${nombre}`);
      return estado.rpc ? estado.rpc(nombre, args) : { data: null, error: null };
    },
  }),
}));

const { getServiciosStore, ServiciosStoreError } = await import("./store");

const ID = "00000000-0000-4000-8000-000000000001";
const VENCE = "2026-11-30T12:00:00.000Z";
const NUEVO = "2027-02-28T12:00:00.000Z";

function fila(extra: Record<string, unknown> = {}) {
  return {
    id: ID,
    tx_id: "tx-original",
    reference: null,
    plan_id: "alianza-90",
    dias: 90,
    cliente_email: null,
    cliente_nombre: "Marta",
    cliente_telefono: null,
    estado: "activo",
    property_slug: "bella-suiza",
    inicio_at: "2026-09-01T12:00:00.000Z",
    vence_at: NUEVO,
    aviso_7d_at: null,
    aviso_1d_at: null,
    aviso_vencido_at: null,
    created_at: "2026-09-01T12:00:00.000Z",
    ...extra,
  };
}

function store() {
  delete (globalThis as { __serviciosStore?: unknown }).__serviciosStore;
  return getServiciosStore();
}

describe("aplicarRenovacion (Supabase)", () => {
  beforeEach(() => {
    estado.rpc = null;
    estado.respuestas = {};
    estado.llamadas = [];
    estado.rpcArgs = [];
  });

  it("con la función de 0011: una sola llamada atómica y devuelve el servicio extendido", async () => {
    estado.rpc = () => ({ data: { resultado: "aplicada", servicio: fila() }, error: null });
    const r = await store().aplicarRenovacion("tx-ren", ID, { inicioAt: null, venceAt: NUEVO }, VENCE);
    expect(r.resultado).toBe("aplicada");
    expect(r.resultado === "aplicada" && r.servicio.venceAt).toBe(NUEVO);
    expect(estado.llamadas).toEqual(["rpc.aplicar_renovacion"]);
    expect(estado.rpcArgs[0]).toEqual({ p_tx_id: "tx-ren", p_servicio_id: ID, p_vence_esperado: VENCE, p_inicio_at: null, p_vence_at: NUEVO });
  });

  it("ya aplicada o en conflicto: lo informa sin tocar tablas", async () => {
    estado.rpc = () => ({ data: { resultado: "ya_aplicada" }, error: null });
    expect((await store().aplicarRenovacion("tx-ren", ID, { inicioAt: null, venceAt: NUEVO }, VENCE)).resultado).toBe("ya_aplicada");
    estado.rpc = () => ({ data: { resultado: "conflicto" }, error: null });
    expect((await store().aplicarRenovacion("tx-ren", ID, { inicioAt: null, venceAt: NUEVO }, VENCE)).resultado).toBe("conflicto");
    expect(estado.llamadas.filter((l) => !l.startsWith("rpc."))).toEqual([]);
  });

  it("sin la función (PGRST202): cae al camino por pasos (reclamo, extensión y tramo)", async () => {
    estado.rpc = () => ({ data: null, error: { code: "PGRST202", message: "Could not find the function public.aplicar_renovacion in the schema cache" } });
    estado.respuestas["servicios_publicacion.update"] = { data: fila(), error: null };
    const r = await store().aplicarRenovacion("tx-ren", ID, { inicioAt: null, venceAt: NUEVO }, VENCE);
    expect(r.resultado).toBe("aplicada");
    expect(estado.llamadas).toEqual(["rpc.aplicar_renovacion", "servicios_renovaciones.insert", "servicios_publicacion.update", "servicios_periodos.insert"]);
  });

  it("sin la función (42883) y con el vencimiento cambiado: deshace el reclamo y devuelve conflicto", async () => {
    estado.rpc = () => ({ data: null, error: { code: "42883", message: "function aplicar_renovacion(...) does not exist" } });
    estado.respuestas["servicios_publicacion.update"] = { data: null, error: null };
    const r = await store().aplicarRenovacion("tx-ren", ID, { inicioAt: null, venceAt: NUEVO }, VENCE);
    expect(r.resultado).toBe("conflicto");
    expect(estado.llamadas).toContain("servicios_renovaciones.delete");
    expect(estado.llamadas).not.toContain("servicios_periodos.insert");
  });

  it("camino por pasos con el reclamo ya hecho: ya aplicada, sin extender otra vez", async () => {
    estado.rpc = () => ({ data: null, error: { code: "PGRST202", message: "x" } });
    estado.respuestas["servicios_renovaciones.insert"] = { data: null, error: { code: "23505", message: "duplicate key" } };
    const r = await store().aplicarRenovacion("tx-ren", ID, { inicioAt: null, venceAt: NUEVO }, VENCE);
    expect(r.resultado).toBe("ya_aplicada");
    expect(estado.llamadas).not.toContain("servicios_publicacion.update");
  });

  it("cualquier otro error de la base se lanza (la conciliación lo retoma)", async () => {
    estado.rpc = () => ({ data: null, error: { code: "57014", message: "canceling statement due to statement timeout" } });
    await expect(store().aplicarRenovacion("tx-ren", ID, { inicioAt: null, venceAt: NUEVO }, VENCE)).rejects.toBeInstanceOf(ServiciosStoreError);
  });
});

describe("tablas de 0011 sin aplicar (Supabase)", () => {
  beforeEach(() => {
    estado.respuestas = {};
    estado.llamadas = [];
  });

  it("fichas y datos de un servicio salen vacíos en vez de romper el panel", async () => {
    const sinTabla = { data: null, error: { code: "42P01", message: 'relation "servicio_fichas" does not exist' } };
    estado.respuestas["servicio_fichas.select"] = sinTabla;
    estado.respuestas["servicio_datos.select"] = { data: null, error: { code: "PGRST205", message: "Could not find the table in the schema cache" } };
    const s = store();
    expect((await s.fichasDePaquetes([ID])).size).toBe(0);
    expect((await s.datosDeServicios([ID])).size).toBe(0);
  });

  it("las fichas traen el slug del inmueble enlazado", async () => {
    estado.respuestas["servicio_fichas.select"] = {
      data: [
        { servicio_id: ID, property_id: "p1", properties: { slug: "bella-suiza" } },
        { servicio_id: ID, property_id: "p2", properties: null },
      ],
      error: null,
    };
    const m = await store().fichasDePaquetes([ID]);
    expect(m.get(ID)).toEqual([
      { propertyId: "p1", slug: "bella-suiza" },
      { propertyId: "p2", slug: null },
    ]);
  });
});
