import { beforeEach, describe, expect, it, vi } from "vitest";

const { sesion } = vi.hoisted(() => ({ sesion: { activa: false } }));
vi.mock("@/lib/auth", () => ({ getAdminSession: async () => (sesion.activa ? { email: "jefe@cic.com" } : null) }));
vi.mock("@/lib/export/datasets", async () => {
  const real = await vi.importActual<typeof import("@/lib/export/datasets")>("@/lib/export/datasets");
  return { ...real, construirCsv: vi.fn(async (d: string) => `\uFEFFdato;${d}\r\n`) };
});

import { GET } from "./route";

const llamar = (dataset: string) => GET(new Request(`http://localhost/api/admin/export/${dataset}`), { params: Promise.resolve({ dataset }) });

describe("GET /api/admin/export/[dataset]", () => {
  beforeEach(() => {
    sesion.activa = false;
  });

  it("sin sesión de administrador no entrega nada (lleva datos personales)", async () => {
    for (const d of ["leads", "contactos", "plantilla-vendedores", "no-existe"]) {
      const r = await llamar(d);
      expect(r.status).toBe(401);
      expect(r.headers.get("cache-control")).toBe("no-store");
      expect(await r.text()).not.toContain("dato;");
    }
  });

  it("con sesión descarga un CSV con nombre del día, sin caché y sin adivinar el tipo", async () => {
    sesion.activa = true;
    const r = await llamar("leads");
    expect(r.status).toBe(200);
    expect(r.headers.get("content-type")).toBe("text/csv; charset=utf-8");
    expect(r.headers.get("content-disposition")).toMatch(/^attachment; filename="cic-leads-\d{4}-\d{2}-\d{2}\.csv"$/);
    expect(r.headers.get("cache-control")).toBe("no-store");
    expect(r.headers.get("x-content-type-options")).toBe("nosniff");
    expect(await r.text()).toContain("dato;leads");
  });

  it("las plantillas se descargan con las columnas de la hoja del CRM", async () => {
    sesion.activa = true;
    const v = await (await llamar("plantilla-vendedores")).text();
    expect(v).toContain("NOMBRE;CELULAR;UBICACION;PRECIO");
    const c = await (await llamar("plantilla-compradores")).text();
    expect(c).toContain("NUMERAL INMUEBLE 1");
  });

  it("un nombre desconocido o con trucos de ruta da 404", async () => {
    sesion.activa = true;
    for (const d of ["usuarios", "../../etc/passwd", "__proto__", "constructor"]) expect((await llamar(d)).status).toBe(404);
  });
});
