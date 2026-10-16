import { describe, expect, it } from "vitest";
import { toPublicProperty, type Property } from "./property";

const base = {
  id: "1",
  slug: "demo",
  codigo: "1",
  titulo: "Demo",
  tipo: "apartamento",
  estado: "disponible",
  precio: 100,
  publicado: true,
  descripcion: "",
  medios: [],
  ubicacion: { ciudad: "Bogotá", direccion: "Calle 1" },
  propietario: { nombre: "X" },
  notasInternas: "n",
  creadoEn: "",
  actualizadoEn: "",
} as unknown as Property;

describe("toPublicProperty", () => {
  it("trata las cantidades negativas como «sin dato» (p. ej. -3 parqueaderos)", () => {
    const p = toPublicProperty({
      ...base,
      administracion: -5,
      caracteristicas: { habitaciones: 3, banos: -1, area: 80, parqueaderos: -3 },
    } as Property);
    expect(p.caracteristicas.parqueaderos).toBeUndefined();
    expect(p.caracteristicas.banos).toBeUndefined();
    expect(p.administracion).toBeUndefined();
    expect(p.caracteristicas.habitaciones).toBe(3);
    expect(p.caracteristicas.area).toBe(80);
  });

  it("conserva el cero (un inmueble sin parqueadero) y no filtra datos privados", () => {
    const p = toPublicProperty({ ...base, caracteristicas: { parqueaderos: 0 } } as Property);
    expect(p.caracteristicas.parqueaderos).toBe(0);
    expect(JSON.stringify(p)).not.toContain("Calle 1");
  });
});
