import { describe, expect, it, vi } from "vitest";

vi.mock("@/lib/data", () => ({ getRepository: () => ({ leads: { create: vi.fn() } }) }));
vi.mock("@/lib/notifications/email", () => ({ sendLeadNotification: vi.fn() }));

import { createLeadAction } from "./leads";

function form(entries: Record<string, string>): FormData {
  const fd = new FormData();
  for (const [k, v] of Object.entries(entries)) fd.set(k, v);
  return fd;
}

describe("createLeadAction", () => {
  it("con datos inválidos devuelve el error por campo Y lo que el usuario escribió", async () => {
    const r = await createLeadAction(
      { status: "idle" },
      form({ tipo: "vendedor", nombre: "Ana Pérez", telefono: "12", email: "ana@x.co", ciudad: "Bogotá", mensaje: "Apto 3 alcobas" }),
    );
    expect(r.status).toBe("error");
    expect(r.errors).toEqual({ telefono: "Ingresa un teléfono válido" });
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
});
