import { beforeEach, describe, expect, it, vi } from "vitest";

const { crear, avisar, getPublicBySlug } = vi.hoisted(() => ({
  crear: vi.fn(),
  avisar: vi.fn(),
  getPublicBySlug: vi.fn(),
}));

vi.mock("@/lib/data", () => ({
  getRepository: () => ({ leads: { create: crear }, properties: { getPublicBySlug } }),
}));
vi.mock("@/lib/notifications/email", () => ({ sendLeadNotification: avisar }));
// `after` solo existe dentro de una petición real: aquí corre al instante.
vi.mock("next/server", () => ({ after: (fn: () => Promise<void>) => fn() }));

import { createLeadAction } from "./leads";

function form(entries: Record<string, string>): FormData {
  const fd = new FormData();
  for (const [k, v] of Object.entries(entries)) fd.set(k, v);
  return fd;
}

const valido = { tipo: "comprador", nombre: "Ana Pérez", telefono: "300 123 4567", intencion: "visita", propertySlug: "bella-suiza" };

beforeEach(() => {
  crear.mockReset();
  avisar.mockReset();
  getPublicBySlug.mockReset();
  crear.mockImplementation(async (input: Record<string, unknown>) => ({ id: "l1", creadoEn: "2026-10-09", estado: "nuevo", ...input }));
  getPublicBySlug.mockResolvedValue({ titulo: "Bella Suiza", codigo: "1013" });
});

describe("createLeadAction", () => {
  it("con datos inválidos devuelve el error por campo Y lo que el usuario escribió", async () => {
    const r = await createLeadAction(
      { status: "idle" },
      form({ tipo: "vendedor", nombre: "Ana Pérez", telefono: "12", email: "ana@x.co", ciudad: "Bogotá", mensaje: "Apto 3 alcobas" }),
    );
    expect(r.status).toBe("error");
    expect(r.errors).toEqual({ telefono: "Ingresa un celular o teléfono válido, por ejemplo 300 123 4567" });
    // Sin esto, React 19 vacía el formulario al terminar la acción y el usuario reescribe todo.
    expect(r.values).toEqual({
      nombre: "Ana Pérez",
      telefono: "12",
      email: "ana@x.co",
      ciudad: "Bogotá",
      mensaje: "Apto 3 alcobas",
    });
  });

  it("nunca devuelve el honeypot ni los campos ocultos como valores", async () => {
    const r = await createLeadAction(
      { status: "idle" },
      form({ tipo: "comprador", nombre: "A", telefono: "abc", website: "spam", propertyId: "p1", fuente: "web" }),
    );
    expect(r.status).toBe("error");
    expect(Object.keys(r.values ?? {})).toEqual(["nombre", "telefono"]);
  });

  it("rechaza lo que parece teléfono pero no lo es", async () => {
    for (const telefono of ["-------", "+++++++", "1234567890", "0000000000"]) {
      const r = await createLeadAction({ status: "idle" }, form({ ...valido, telefono }));
      expect(r.status, telefono).toBe("error");
      expect(r.errors?.telefono, telefono).toBeTruthy();
    }
  });

  it("guarda el teléfono en forma única y arma el WhatsApp con día y franja", async () => {
    const r = await createLeadAction({ status: "idle" }, form({ ...valido, preferencia: "sábado 10 de octubre, en la tarde" }));
    expect(r.status).toBe("success");
    expect(crear).toHaveBeenCalledWith(expect.objectContaining({ telefono: "+57 300 123 4567", preferencia: "sábado 10 de octubre, en la tarde" }));
    const url = decodeURIComponent(r.whatsappUrl ?? "");
    expect(url).toContain("Hola, soy Ana Pérez.");
    expect(url).toContain("Bella Suiza (1013)");
    expect(url).toContain("Preferencia: sábado 10 de octubre, en la tarde.");
  });

  it("un fallo del correo no convierte un lead guardado en un error", async () => {
    avisar.mockRejectedValue(new Error("resend caído"));
    const r = await createLeadAction({ status: "idle" }, form(valido));
    expect(r.status).toBe("success");
    expect(avisar).toHaveBeenCalledTimes(1);
  });

  it("si la base de datos falla, el visitante conserva un WhatsApp con lo que escribió", async () => {
    crear.mockRejectedValue(new Error("supabase caído"));
    const r = await createLeadAction({ status: "idle" }, form(valido));
    expect(r.status).toBe("error");
    expect(r.values?.nombre).toBe("Ana Pérez");
    expect(decodeURIComponent(r.whatsappUrl ?? "")).toContain("Hola, soy Ana Pérez.");
    expect(avisar).not.toHaveBeenCalled();
  });

  it("topes de longitud: un nombre de 100 KB no pasa", async () => {
    const r = await createLeadAction({ status: "idle" }, form({ ...valido, nombre: "x".repeat(100_000) }));
    expect(r.status).toBe("error");
    expect(r.errors?.nombre).toBeTruthy();
  });
});
