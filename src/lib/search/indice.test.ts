import { describe, expect, it } from "vitest";
import { construirIndice, contextoDe, MAX_INDICE, sugerencias, type ItemIndice } from "./indice";
import type { PublicProperty } from "@/lib/domain";

const prop = (n: number, extra: Partial<PublicProperty> = {}): PublicProperty =>
  ({
    id: `id-${n}`,
    codigo: `10${n}`,
    slug: `casa-${n}`,
    titulo: `Inmueble ${n}`,
    tipo: "apartamento",
    estado: "disponible",
    precio: 500_000_000 + n * 100_000_000,
    ubicacion: { ciudad: "Bogotá", sector: n % 2 ? "Bella Suiza" : "Gilmar" },
    caracteristicas: { habitaciones: 3, banos: 2, area: 80, parqueaderos: 1 },
    descripcion: "🔥 Chimenea\nTerraza amplia",
    medios: [{ id: "m", type: "image", provider: "cloudinary", url: "https://x/y.jpg", order: 0, isCover: true }],
    destacado: false,
    publicado: true,
    creadoEn: "2026-01-01",
    actualizadoEn: "2026-01-01",
    ...extra,
  }) as PublicProperty;

describe("construirIndice", () => {
  it("usa el slug como id, incluye portada y texto normalizado sin emojis", () => {
    const [x] = construirIndice([prop(1)]);
    expect(x.id).toBe("casa-1");
    expect(x.portada).toBe("https://x/y.jpg");
    expect(x.texto).toContain("chimenea");
    expect(x.texto).not.toMatch(/[^\w ñ]/);
  });

  it("recorta el catálogo enviado al navegador", () => {
    const muchos = Array.from({ length: MAX_INDICE + 20 }, (_, i) => prop(i));
    expect(construirIndice(muchos)).toHaveLength(MAX_INDICE);
  });
});

describe("contextoDe", () => {
  it("lista sectores y ciudades reales sin repetir", () => {
    const ctx = contextoDe([prop(1), prop(2), prop(3)]);
    expect(ctx.sectores.sort()).toEqual(["Bella Suiza", "Gilmar"]);
    expect(ctx.ciudades).toEqual(["Bogotá"]);
  });
});

describe("sugerencias", () => {
  const indice = (props: PublicProperty[]): ItemIndice[] => construirIndice(props);

  it("salen del inventario real: sector con más oferta, alcobas más comunes, tope de precio, término frecuente", () => {
    const s = sugerencias(indice([prop(1), prop(3), prop(5), prop(2)]));
    expect(s[0]).toBe("Apartamento en Bella Suiza");
    expect(s).toContain("3 alcobas con parqueadero");
    expect(s.some((x) => /^Hasta \d+ millones$/.test(x))).toBe(true);
    expect(s).toContain("Con chimenea");
  });

  it("no inventa nada si todo está vendido o no hay inventario", () => {
    expect(sugerencias([])).toEqual([]);
    expect(sugerencias(indice([prop(1, { estado: "vendido" })]))).toEqual([]);
  });

  it("no sugiere un término que aparece en un solo inmueble", () => {
    const s = sugerencias(indice([prop(1), prop(2, { descripcion: "sala" })]));
    expect(s).not.toContain("Con chimenea");
  });
});
