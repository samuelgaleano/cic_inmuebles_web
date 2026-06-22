import { describe, expect, it } from "vitest";
import { propertyToSheetRow, SHEET_HEADER } from "./sheets";
import { PROPERTY_STATUS_LABELS } from "@/lib/domain";
import { seedProperties } from "@/lib/data/seed";

describe("propertyToSheetRow", () => {
  const property = seedProperties[0];
  const row = propertyToSheetRow(property);

  it("genera una fila con tantas columnas como el encabezado", () => {
    expect(row).toHaveLength(SHEET_HEADER.length);
  });

  it("coloca el ID en la primera columna (clave de upsert)", () => {
    expect(row[0]).toBe(property.id);
    expect(SHEET_HEADER[0]).toBe("ID");
  });

  it("usa la etiqueta legible del estado y el precio numérico", () => {
    expect(row[SHEET_HEADER.indexOf("Estado")]).toBe(PROPERTY_STATUS_LABELS[property.estado]);
    expect(row[SHEET_HEADER.indexOf("Precio")]).toBe(property.precio);
  });

  it("incluye la URL pública del inmueble", () => {
    const url = String(row[SHEET_HEADER.indexOf("URL pública")]);
    expect(url).toContain(`/inmuebles/${property.slug}`);
  });
});
