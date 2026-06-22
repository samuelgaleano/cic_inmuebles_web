import { describe, expect, it } from "vitest";
import { generateSpecDoc, parseSpecDoc } from "./drive";
import { PROPERTY_TYPE_LABELS } from "@/lib/domain";
import { seedProperties } from "@/lib/data/seed";

describe("parseSpecDoc (round-trip con generateSpecDoc)", () => {
  const property = seedProperties[0];

  it("recupera los campos clave del documento de especificaciones", () => {
    const doc = generateSpecDoc(property);
    const parsed = parseSpecDoc(doc);

    expect(parsed.fields.titulo).toBe(property.titulo);
    expect(parsed.fields.ciudad).toBe(property.ubicacion.ciudad);
    expect(parsed.fields.tipo).toBe(PROPERTY_TYPE_LABELS[property.tipo]);
    expect(parsed.descripcionCorta).toBe(property.descripcionCorta);
    expect(parsed.descripcion.trim()).toBe(property.descripcion.trim());
  });

  it("tolera documentos vacíos sin lanzar", () => {
    const parsed = parseSpecDoc("");
    expect(parsed.fields).toEqual({});
    expect(parsed.descripcion).toBe("");
  });

  it("ignora líneas sin formato clave: valor", () => {
    const parsed = parseSpecDoc("texto suelto\nciudad: Medellín\n");
    expect(parsed.fields.ciudad).toBe("Medellín");
  });
});
