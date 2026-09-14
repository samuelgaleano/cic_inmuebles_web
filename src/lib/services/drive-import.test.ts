import { describe, expect, it, vi } from "vitest";

vi.mock("@/lib/data", () => ({ getRepository: () => ({}) }));
vi.mock("@/lib/integrations/drive", () => ({}));
vi.mock("@/lib/integrations/sheets", () => ({}));
vi.mock("@/lib/integrations/cloudinary", () => ({}));

import { cleanTitle, normalizeCity } from "./drive-import";

describe("normalizeCity", () => {
  it("no rompe las tildes: 'Bogotá' se queda 'Bogotá' (antes salía 'BogotÁ')", () => {
    expect(normalizeCity("Bogotá")).toBe("Bogotá");
    expect(normalizeCity("bogotá")).toBe("Bogotá");
    expect(normalizeCity("BOGOTA")).toBe("Bogotá");
    expect(normalizeCity("Chía")).toBe("Chía");
  });
});

describe("cleanTitle", () => {
  it("pone mayúscula inicial por palabra sin partir las tildes", () => {
    expect(cleanTitle("alejandría")).toBe("Alejandría");
    expect(cleanTitle("puente-largo-alhambra")).toBe("Puente Largo Alhambra");
    expect(cleanTitle("edificio_san_patricio")).toBe("Edificio San Patricio");
    expect(cleanTitle("ciudad jardín?")).toBe("Ciudad Jardín");
  });

  it("conserva siglas y mayúsculas internas de la carpeta, igual que el panel", () => {
    expect(cleanTitle("Edificio BBVA")).toBe("Edificio BBVA");
    expect(cleanTitle("Torres del CAN")).toBe("Torres del CAN");
  });
});
