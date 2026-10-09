import { describe, expect, it } from "vitest";
import { interpretar, quitarSpans, type ContextoBusqueda } from "./interpretar";

const ctx: ContextoBusqueda = {
  sectores: ["La Calleja", "Alejandría", "Alhambra", "Bella Suiza", "San Patricio", "Gilmar"],
  ciudades: ["Bogotá", "Medellín"],
};

describe("interpretar — precio", () => {
  it("'hasta 900 millones' → precioMax", () => {
    const r = interpretar("apartamento hasta 900 millones", ctx);
    expect(r.filtros.precioMax).toBe(900_000_000);
    expect(r.filtros.precioMin).toBeUndefined();
  });

  it("un monto sin calificador se toma como presupuesto máximo", () => {
    expect(interpretar("800 millones", ctx).filtros.precioMax).toBe(800_000_000);
  });

  it("'desde 500 millones' → precioMin", () => {
    const r = interpretar("desde 500 millones", ctx);
    expect(r.filtros.precioMin).toBe(500_000_000);
    expect(r.filtros.precioMax).toBeUndefined();
  });

  it("'entre 400 y 700 millones' hereda la unidad del segundo monto", () => {
    const r = interpretar("entre 400 y 700 millones", ctx);
    expect(r.filtros.precioMin).toBe(400_000_000);
    expect(r.filtros.precioMax).toBe(700_000_000);
  });

  it("'mil millones' y decimales: 1,2 mil millones = 1.200 millones", () => {
    expect(interpretar("hasta 1,2 mil millones", ctx).filtros.precioMax).toBe(1_200_000_000);
    expect(interpretar("hasta 1.2 mil millones", ctx).filtros.precioMax).toBe(1_200_000_000);
  });

  it("punto como separador de miles: '1.500 millones' = 1.500 millones, no 1,5", () => {
    expect(interpretar("hasta 1.500 millones", ctx).filtros.precioMax).toBe(1_500_000_000);
  });

  it("punto decimal corto: '1.5 millones' = 1,5 millones", () => {
    expect(interpretar("hasta 1.5 millones", ctx).filtros.precioMax).toBe(1_500_000);
  });

  it("monto completo en pesos: $850.000.000", () => {
    expect(interpretar("máximo $850.000.000", ctx).filtros.precioMax).toBe(850_000_000);
    expect(interpretar("850000000", ctx).filtros.precioMax).toBe(850_000_000);
  });

  it("'alrededor de 600 millones' → rango ±15%", () => {
    const r = interpretar("alrededor de 600 millones", ctx);
    expect(r.filtros.precioMin).toBe(510_000_000);
    expect(r.filtros.precioMax).toBe(690_000_000);
  });

  it("'$850M' y '850 MM' se leen como millones", () => {
    expect(interpretar("hasta $850M", ctx).filtros.precioMax).toBe(850_000_000);
    expect(interpretar("hasta 850 MM", ctx).filtros.precioMax).toBe(850_000_000);
  });
});

describe("interpretar — características", () => {
  it("habitaciones: cifras, palabras y sinónimos colombianos", () => {
    expect(interpretar("3 habitaciones", ctx).filtros.habitacionesMin).toBe(3);
    expect(interpretar("tres alcobas", ctx).filtros.habitacionesMin).toBe(3);
    expect(interpretar("de 2 cuartos", ctx).filtros.habitacionesMin).toBe(2);
    expect(interpretar("4 hab", ctx).filtros.habitacionesMin).toBe(4);
    expect(interpretar("3+ habitaciones", ctx).filtros.habitacionesMin).toBe(3);
    expect(interpretar("tres o más alcobas", ctx).filtros.habitacionesMin).toBe(3);
  });

  it("baños y parqueaderos", () => {
    const r = interpretar("2 baños con parqueadero", ctx);
    expect(r.filtros.banosMin).toBe(2);
    expect(r.filtros.parqueaderosMin).toBe(1);
    expect(interpretar("dos parqueaderos", ctx).filtros.parqueaderosMin).toBe(2);
    expect(interpretar("con garaje", ctx).filtros.parqueaderosMin).toBe(1);
  });

  it("área: mínimo, máximo y aproximada", () => {
    expect(interpretar("desde 100 metros", ctx).filtros.areaMin).toBe(100);
    expect(interpretar("hasta 80 m2", ctx).filtros.areaMax).toBe(80);
    const aprox = interpretar("de 100 m²", ctx);
    expect(aprox.filtros.areaMin).toBe(85);
    expect(aprox.filtros.areaMax).toBe(115);
  });

  it("tipo de inmueble", () => {
    expect(interpretar("apto", ctx).filtros.tipo).toBe("apartamento");
    expect(interpretar("busco una casa", ctx).filtros.tipo).toBe("casa");
    expect(interpretar("apartaestudio", ctx).filtros.tipo).toBe("apartaestudio");
    expect(interpretar("casa campestre", ctx).filtros.tipo).toBe("casa_campestre");
  });
});

describe("interpretar — lugar", () => {
  it("reconoce sectores del inventario, con o sin tildes, mayúsculas y artículos", () => {
    expect(interpretar("en bella suiza", ctx).filtros.sectores).toEqual(["Bella Suiza"]);
    expect(interpretar("CALLEJA", ctx).filtros.sectores).toEqual(["La Calleja"]);
    expect(interpretar("alejandria", ctx).filtros.sectores).toEqual(["Alejandría"]);
    expect(interpretar("por san patricio", ctx).filtros.sectores).toEqual(["San Patricio"]);
  });

  it("tolera un error de digitación en sectores largos", () => {
    expect(interpretar("alejandra", ctx).filtros.sectores).toEqual(["Alejandría"]);
    expect(interpretar("alambra", ctx).filtros.sectores).toEqual(["Alhambra"]);
  });

  it("no inventa sectores que no existen", () => {
    expect(interpretar("en Usaquén", ctx).filtros.sectores).toBeUndefined();
  });

  it("reconoce la ciudad", () => {
    expect(interpretar("apartamentos en Bogota", ctx).filtros.ciudad).toBe("Bogotá");
    expect(interpretar("medellin", ctx).filtros.ciudad).toBe("Medellín");
  });
});

describe("interpretar — frase completa y términos sueltos", () => {
  it("combina todo en una sola frase", () => {
    const r = interpretar(
      "Busco apartamento de 3 alcobas en Bella Suiza, con parqueadero, hasta 900 millones",
      ctx,
    );
    expect(r.filtros).toMatchObject({
      tipo: "apartamento",
      habitacionesMin: 3,
      parqueaderosMin: 1,
      precioMax: 900_000_000,
      sectores: ["Bella Suiza"],
    });
    expect(r.chips.map((c) => c.tipo).sort()).toEqual(
      ["habitaciones", "parqueaderos", "precio", "sector", "tipo"].sort(),
    );
  });

  it("lo que no entiende queda como término de texto (p. ej. 'chimenea')", () => {
    const r = interpretar("apartamento con chimenea", ctx);
    expect(r.filtros.tipo).toBe("apartamento");
    expect(r.filtros.terminos).toEqual(["chimenea"]);
  });

  it("palabras de relleno no se vuelven términos", () => {
    const r = interpretar("quiero un apartamento por favor", ctx);
    expect(r.filtros.terminos).toBeUndefined();
  });

  it("un código numérico de 3 a 5 dígitos es un término (código del inmueble)", () => {
    expect(interpretar("1013", ctx).filtros.terminos).toEqual(["1013"]);
  });

  it("texto vacío o solo espacios: sin filtros ni chips", () => {
    const r = interpretar("   ", ctx);
    expect(r.chips).toEqual([]);
    expect(r.filtros).toEqual({});
  });
});

describe("chips y edición de la consulta", () => {
  it("cada chip recuerda su fragmento original para poder quitarlo", () => {
    const texto = "apartamento en Bella Suiza hasta 900 millones";
    const r = interpretar(texto, ctx);
    const precio = r.chips.find((c) => c.tipo === "precio")!;
    expect(quitarSpans(texto, precio.spans)).toBe("apartamento en Bella Suiza");
    const sector = r.chips.find((c) => c.tipo === "sector")!;
    expect(interpretar(quitarSpans(texto, sector.spans), ctx).filtros.sectores).toBeUndefined();
  });

  it("las etiquetas son legibles en español", () => {
    const r = interpretar("3 alcobas hasta 900 millones", ctx);
    const etiquetas = r.chips.map((c) => c.etiqueta);
    expect(etiquetas).toContain("3+ habitaciones");
    expect(etiquetas).toContain("Hasta $900 M");
  });
});
