import { describe, expect, it } from "vitest";
import { ordenarDescripcion } from "./descripcion";

const estructurados = {
  precio: 850_000_000,
  administracion: 950_000,
  area: 128,
  habitaciones: 4,
  banos: 4,
  parqueaderos: 2,
};

const BELLA_SUIZA = `🏡 Ficha Técnica del Apartamento

📍 Apartamento en venta
💰 Valor: $850.000.000
🏢 Administración: $950.000

📐 Área: 128 m²
🛏️ Habitaciones: 3
🚿 Baños: 3
🧹 Cuarto y baño de servicio

🛋️ Sala comedor amplia
🔥 Chimenea
👨‍👩‍👧 Family room
📚 Estudio
🧺 Zona de lavandería
🌿 Balcón

🚗 Parqueaderos: 2 en línea
📦 Depósito
🛡️ Vigilancia 24/7

✨ Apartamento amplio, cómodo y funcional, ideal para familias que buscan espacios generosos, buena distribución y seguridad permanente.`;

const ALHAMBRA = `Penthouse remodelado con diseño exclusivo y máxima valorización ✨

📐 Área construida: 136.22 m²
📏 Área privada: 131.46 m²
📍 Estrato 5

🛏️ 4 habitaciones
🚿 3 baños
🚗 2 parqueaderos
📦 Depósito privado

⸻

💎 Un espacio diseñado para quienes no negocian el confort:

🔥 Chimenea
💦 Turco
🌇 Terraza privada con zona BBQ

🛁 Habitación principal de lujo:
Jacuzzi + walking closet

🛗 Ascensor privado directo al apartamento

💰 Precio: $1.420.000.000
💳 Administración: $970.000`;

const SAN_PATRICIO = `✨🏡 Apartamento para estrenar con acabados premium 🏡✨

📐 122 m²

🛏️ 3 alcobas, cada una con baño y vestier privado
🚻 Baño social

🏢 Zonas comunes tipo club:
🌇 Terraza en cubierta para eventos
🏋️ Gimnasio dotado con baño completo

💎 Ideal para quienes buscan diseño, comodidad y exclusividad en un solo lugar`;

describe("ordenarDescripcion", () => {
  it("elimina emojis, encabezados de plantilla y datos que ya están en la ficha", () => {
    const d = ordenarDescripcion(BELLA_SUIZA, estructurados);
    const todo = JSON.stringify(d);
    expect(todo).not.toMatch(/[\u{1F300}-\u{1FAFF}\u{2600}-\u{27BF}\u{FE0F}]/u);
    expect(todo).not.toMatch(/Ficha T/i);
    expect(todo).not.toMatch(/\$850\.000\.000|Valor|Administraci/);
  });

  it("conserva como características lo que no está en los datos estructurados", () => {
    const d = ordenarDescripcion(BELLA_SUIZA, estructurados);
    const items = d.grupos.flatMap((g) => g.items);
    expect(items).toEqual(
      expect.arrayContaining(["Chimenea", "Family room", "Estudio", "Depósito", "Vigilancia 24/7", "Cuarto y baño de servicio"]),
    );
  });

  it("deja la frase de cierre como párrafo, sin el emoji", () => {
    const d = ordenarDescripcion(BELLA_SUIZA, estructurados);
    expect(d.parrafos.join(" ")).toMatch(/^Apartamento amplio, cómodo y funcional/);
  });

  it("no muestra cifras que contradicen la ficha: manda lo estructurado", () => {
    // La descripción dice 3 hab / 3 baños; la ficha dice 4 / 4.
    const d = ordenarDescripcion(BELLA_SUIZA, estructurados);
    expect(JSON.stringify(d)).not.toMatch(/Habitaciones: 3|Baños: 3/);
    expect(d.conflictos).toEqual(expect.arrayContaining(["habitaciones", "baños"]));
  });

  it("separa el titular de la lista y respeta los subtítulos con dos puntos", () => {
    const d = ordenarDescripcion(ALHAMBRA, { precio: 1_420_000_000, administracion: 970_000, area: 135, habitaciones: 4, banos: 3, parqueaderos: 2 });
    expect(d.titular).toBe("Penthouse remodelado con diseño exclusivo y máxima valorización");
    const grupo = d.grupos.find((g) => g.titulo?.startsWith("Un espacio diseñado"));
    expect(grupo?.items).toEqual(expect.arrayContaining(["Chimenea", "Turco", "Terraza privada con zona BBQ"]));
  });

  it("rescata datos útiles que la ficha no tiene (estrato, área privada)", () => {
    const d = ordenarDescripcion(ALHAMBRA, { precio: 1_420_000_000, area: 135, habitaciones: 4, banos: 3, parqueaderos: 2 });
    expect(d.datos).toEqual(expect.arrayContaining([{ etiqueta: "Estrato", valor: "5" }, { etiqueta: "Área privada", valor: "131.46 m²" }]));
  });

  it("'Subtítulo:' seguido de una línea suelta la mantiene junto al subtítulo", () => {
    const d = ordenarDescripcion(ALHAMBRA, {});
    const g = d.grupos.find((x) => x.titulo === "Habitación principal de lujo");
    expect(g?.items).toEqual(["Jacuzzi + walking closet"]);
  });

  it("titular con emojis a ambos lados y listas con viñetas de zonas comunes", () => {
    const d = ordenarDescripcion(SAN_PATRICIO, { area: 122, habitaciones: 3 });
    expect(d.titular).toBe("Apartamento para estrenar con acabados premium");
    expect(d.grupos.find((g) => g.titulo === "Zonas comunes tipo club")?.items).toEqual([
      "Terraza en cubierta para eventos",
      "Gimnasio dotado con baño completo",
    ]);
    expect(d.parrafos.join(" ")).toMatch(/Ideal para quienes buscan diseño/);
  });

  it("texto vacío o solo espacios: estructura vacía, sin lanzar", () => {
    for (const t of ["", "   ", "\n\n", undefined as unknown as string]) {
      const d = ordenarDescripcion(t, estructurados);
      expect(d.grupos).toEqual([]);
      expect(d.parrafos).toEqual([]);
      expect(d.datos).toEqual([]);
    }
  });

  it("texto libre sin formato de ficha: queda como párrafos", () => {
    const d = ordenarDescripcion("Hermoso apartamento con vista panorámica.\n\nExcelente ubicación cerca de parques y centros comerciales, ideal para familias.", {});
    expect(d.parrafos).toEqual([
      "Hermoso apartamento con vista panorámica.",
      "Excelente ubicación cerca de parques y centros comerciales, ideal para familias.",
    ]);
  });

  it("nunca pierde en silencio una línea que no reconoce", () => {
    const d = ordenarDescripcion("Línea rara 123 xyz\nOtra cosa única", {});
    const todo = JSON.stringify(d);
    expect(todo).toContain("Línea rara 123 xyz");
    expect(todo).toContain("Otra cosa única");
  });
});
