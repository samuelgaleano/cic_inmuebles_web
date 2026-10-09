import { describe, expect, it } from "vitest";
import { matchesFilters } from "./filtering";
import type { Property } from "@/lib/domain";

const base = (p: Partial<Property> & { id: string }): Property =>
  ({
    codigo: "1000",
    slug: p.id,
    titulo: "Apartamento",
    tipo: "apartamento",
    estado: "disponible",
    precio: 800_000_000,
    ubicacion: { ciudad: "Bogotá" },
    caracteristicas: {},
    descripcion: "",
    medios: [],
    destacado: false,
    publicado: true,
    creadoEn: "2026-01-01",
    actualizadoEn: "2026-01-01",
    ...p,
  }) as Property;

const bella = base({
  id: "bella",
  titulo: "Bella Suiza",
  codigo: "1013",
  precio: 850_000_000,
  ubicacion: { ciudad: "Bogotá", sector: "Bella Suiza", conjunto: "Edificio Bella Suiza" },
  caracteristicas: { habitaciones: 4, banos: 4, area: 128, parqueaderos: 2 },
  descripcion: "🔥 Chimenea\n🌿 Balcón",
});
const gilmar = base({
  id: "gilmar",
  titulo: "Tierra Colina",
  codigo: "1020",
  precio: 405_000_000,
  estado: "en_proceso",
  ubicacion: { ciudad: "Bogotá", sector: "Gilmar" },
  caracteristicas: { habitaciones: 2, banos: 2, area: 60, parqueaderos: 1 },
});

describe("matchesFilters", () => {
  it("sin filtros todo pasa", () => {
    expect(matchesFilters(bella)).toBe(true);
    expect(matchesFilters(bella, {})).toBe(true);
  });

  it("filtros clásicos: tipo, estado, ciudad, precio, habitaciones", () => {
    expect(matchesFilters(gilmar, { estado: "en_proceso" })).toBe(true);
    expect(matchesFilters(bella, { estado: "en_proceso" })).toBe(false);
    expect(matchesFilters(bella, { precioMax: 800_000_000 })).toBe(false);
    expect(matchesFilters(bella, { habitacionesMin: 4 })).toBe(true);
    expect(matchesFilters(bella, { ciudad: "bogota" })).toBe(true);
    expect(matchesFilters(bella, { tipo: "casa" })).toBe(false);
  });

  it("filtros de la búsqueda inteligente", () => {
    expect(matchesFilters(bella, { sectores: ["Bella Suiza"], banosMin: 3, parqueaderosMin: 2, areaMin: 100 })).toBe(true);
    expect(matchesFilters(gilmar, { sectores: ["Bella Suiza"] })).toBe(false);
    expect(matchesFilters(bella, { terminos: ["chimenea"] })).toBe(true);
    expect(matchesFilters(gilmar, { terminos: ["chimenea"] })).toBe(false);
    expect(matchesFilters(bella, { terminos: ["1013"] })).toBe(true);
  });

  it("el emoji de la descripción no estorba la búsqueda de términos", () => {
    expect(matchesFilters(bella, { terminos: ["balcon"] })).toBe(true);
  });

  it("la búsqueda literal del panel admin sigue siendo por subcadena", () => {
    expect(matchesFilters(bella, { q: "edificio bella" })).toBe(true);
    expect(matchesFilters(bella, { q: "palmeira" })).toBe(false);
  });
});
