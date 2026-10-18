import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

/**
 * Las server actions del panel se pueden invocar con un POST a cualquier
 * pagina (el proxy solo cubre /admin). Estas pruebas recorren TODAS las
 * acciones exportadas de los modulos admin-* (salvo admin-vigencias, que tiene
 * su propia guardia y sus pruebas) y comprueban que sin sesion no tocan el
 * repositorio ni las integraciones.
 */

const { cookieValor, tocados, redirigir } = vi.hoisted(() => ({
  cookieValor: { actual: undefined as string | undefined },
  tocados: [] as string[],
  redirigir: vi.fn((url: string) => {
    throw new Error(`NEXT_REDIRECT:${url}`);
  }),
}));

vi.mock("next/headers", () => ({
  cookies: async () => ({ get: () => (cookieValor.actual ? { value: cookieValor.actual } : undefined) }),
}));
vi.mock("next/navigation", () => ({ redirect: redirigir }));
vi.mock("next/cache", () => ({ revalidatePath: vi.fn() }));

/** Repositorio espia: cualquier acceso a cualquier metodo queda registrado. */
function espia(ruta: string): unknown {
  return new Proxy(() => undefined, {
    get: (_t, prop) => (typeof prop === "string" ? espia(`${ruta}.${prop}`) : undefined),
    apply: (_t, _this, _args) => {
      tocados.push(ruta);
      return Promise.resolve(ruta.endsWith(".list") ? [] : { id: "x", slug: "x" });
    },
  });
}
vi.mock("@/lib/data", () => ({ getRepository: () => espia("repo") }));
vi.mock("@/lib/crm/store", () => ({
  getCrmStore: () => espia("crm"),
  CrmNoDisponibleError: class extends Error {},
  CrmStoreError: class extends Error {},
}));
vi.mock("@/lib/integrations/drive", () => ({
  isDriveConfigured: () => true,
  ensurePropertyArchive: async () => {
    tocados.push("drive.ensurePropertyArchive");
    return "carpeta";
  },
}));
vi.mock("@/lib/integrations/sheets", () => ({
  isSheetsConfigured: () => true,
  syncPropertyToSheet: async () => void tocados.push("sheets.syncProperty"),
  syncAllPropertiesToSheet: async () => void tocados.push("sheets.syncAll"),
}));
vi.mock("@/lib/services/drive-import", () => ({
  runDriveImport: async () => {
    tocados.push("drive.import");
    return { ran: true, ok: true };
  },
}));

import { createSessionToken } from "@/lib/auth/session";
import * as agenda from "./admin-agenda";
import * as crm from "./admin-crm";
import * as datos from "./admin-datos";
import * as drive from "./admin-drive";
import * as leads from "./admin-leads";
import * as properties from "./admin-properties";
import * as sheets from "./admin-sheets";
import * as templates from "./admin-templates";

/** Un formulario que pasaria todas las validaciones si hubiera sesion. */
function formularioCompleto(): FormData {
  const fd = new FormData();
  const campos: Record<string, string> = {
    id: "abc",
    estado: "nuevo",
    nombre: "Prueba",
    email: "prueba@cic.com",
    contenido: "Hola",
    tipo: "apartamento",
    precio: "100",
    ciudad: "Bogota",
    agentId: "a1",
    propertyId: "p1",
    clienteNombre: "Ana",
    clienteTelefono: "3001234567",
    inicioEn: "2026-10-20T10:00",
  };
  for (const [k, v] of Object.entries(campos)) fd.set(k, v);
  return fd;
}

/** Invoca la accion con la firma que use (FormData; prev+FormData; id+FormData; id+prev+FormData). */
function invocar(nombre: string, fn: (...args: unknown[]) => Promise<unknown>): Promise<unknown> {
  const fd = formularioCompleto();
  switch (nombre) {
    case "resyncSheetAction":
      return fn();
    case "importPropertiesFromDriveAction":
    case "createPropertyAction":
      return fn({}, fd);
    case "importarHojaAction":
      return fn(null, fd);
    case "updateTemplateAction":
      return fn("abc", fd);
    case "updatePropertyAction":
      return fn("abc", {}, fd);
    default:
      return fn(fd);
  }
}

const modulos = { agenda, crm, datos, drive, leads, properties, sheets, templates };
const acciones = Object.entries(modulos).flatMap(([modulo, m]) =>
  Object.entries(m)
    .filter(([, v]) => typeof v === "function")
    .map(([nombre, fn]) => [`${modulo}.${nombre}`, nombre, fn as (...args: unknown[]) => Promise<unknown>] as const),
);

beforeEach(() => {
  tocados.length = 0;
  cookieValor.actual = undefined;
  redirigir.mockClear();
  vi.stubEnv("ADMIN_EMAIL", "jefe@cic.com");
  vi.stubEnv("ADMIN_PASSWORD", "clave-fuerte");
  vi.stubEnv("ADMIN_SESSION_SECRET", "secreto-largo");
  vi.spyOn(console, "warn").mockImplementation(() => {});
});

afterEach(() => {
  vi.unstubAllEnvs();
  vi.restoreAllMocks();
});

describe("acciones del panel sin sesion", () => {
  it("hay acciones que revisar (si esto falla, cambio la forma de exportarlas)", () => {
    expect(acciones.length).toBeGreaterThanOrEqual(30);
  });

  it.each(acciones)("%s redirige al login y no toca datos", async (_id, nombre, fn) => {
    await expect(invocar(nombre, fn)).rejects.toThrow("NEXT_REDIRECT:/admin/login");
    expect(tocados).toEqual([]);
  });

  it("con un token falsificado tampoco pasa", async () => {
    cookieValor.actual = "eyJlbWFpbCI6ImplZmVAY2ljLmNvbSIsImV4cCI6OTk5OTk5OTk5OTk5OX0.firmaFalsa";
    await expect(leads.deleteLeadAction(formularioCompleto())).rejects.toThrow("NEXT_REDIRECT:/admin/login");
    expect(tocados).toEqual([]);
  });
});

describe("acciones del panel con sesion", () => {
  it("con sesion valida la accion si llega al repositorio", async () => {
    cookieValor.actual = createSessionToken("jefe@cic.com");
    await leads.deleteLeadAction(formularioCompleto());
    expect(tocados).toEqual(["repo.leads.remove"]);
    expect(redirigir).not.toHaveBeenCalled();
  });

  it("una sesion emitida antes de cambiar la contrasena ya no sirve", async () => {
    cookieValor.actual = createSessionToken("jefe@cic.com");
    vi.stubEnv("ADMIN_PASSWORD", "clave-rotada");
    await expect(leads.deleteLeadAction(formularioCompleto())).rejects.toThrow("NEXT_REDIRECT:/admin/login");
    expect(tocados).toEqual([]);
  });
});
