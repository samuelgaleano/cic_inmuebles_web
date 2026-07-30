import { describe, expect, it } from "vitest";
import { readFileSync } from "node:fs";
import path from "node:path";
import { generateSpecDoc, parseSpecDoc } from "./drive";
import {
  PROPERTY_STATUS_LABELS,
  PROPERTY_STATUSES,
  PROPERTY_TYPE_LABELS,
  PROPERTY_TYPES,
} from "@/lib/domain";
import { seedProperties } from "@/lib/data/seed";

describe("parseSpecDoc (round-trip con generateSpecDoc)", () => {
  const property = seedProperties[0];

  it("recupera los campos clave del documento de especificaciones", () => {
    const doc = generateSpecDoc(property);
    const parsed = parseSpecDoc(doc);

    expect(parsed.fields.titulo).toBe(property.titulo);
    expect(parsed.fields.ciudad).toBe(property.ubicacion.ciudad);
    expect(parsed.fields.tipo).toBe(PROPERTY_TYPE_LABELS[property.tipo]);
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

  // Los especificaciones.md los escribe el usuario en Windows (Bloc de notas) y
  // llegan desde Drive con finales de línea CRLF: deben parsearse igual que LF.
  it("parsea igual un documento con finales de línea de Windows (CRLF)", () => {
    const doc = generateSpecDoc(property);
    const conLf = parseSpecDoc(doc);
    const conCrlf = parseSpecDoc(doc.replace(/\n/g, "\r\n"));

    expect(conCrlf.fields).toEqual(conLf.fields);
    expect(conCrlf.descripcion).toBe(conLf.descripcion);
    expect(conCrlf.descripcionCorta).toBe(conLf.descripcionCorta);
  });
});

describe("plantilla especificaciones.md (docs/)", () => {
  const text = readFileSync(
    path.join(process.cwd(), "docs/plantilla-especificaciones.md"),
    "utf8",
  );
  const parsed = parseSpecDoc(text);

  it("extrae los campos esenciales (las notas con # se ignoran)", () => {
    expect(parsed.fields.titulo).toBeTruthy();
    expect(parsed.fields.ciudad).toBeTruthy();
    expect(Number(parsed.fields.precio)).toBeGreaterThan(0);
    expect(parsed.descripcion.length).toBeGreaterThan(0);
  });

  it("usa valores válidos para tipo y estado", () => {
    const okTipo = PROPERTY_TYPES.some((k) => PROPERTY_TYPE_LABELS[k] === parsed.fields.tipo);
    const okEstado = PROPERTY_STATUSES.some((k) => PROPERTY_STATUS_LABELS[k] === parsed.fields.estado);
    expect(okTipo).toBe(true);
    expect(okEstado).toBe(true);
  });
});
