import { describe, expect, it } from "vitest";
import nextConfig from "../../../next.config";
import robots from "@/app/robots";
import { leerParams } from "@/lib/search/url";

describe("robots.txt", () => {
  const reglas = robots().rules as { userAgent: string; allow?: string; disallow?: string[]; crawlDelay?: number }[];

  it("todos los agentes dejan fuera el panel, la API, las listas personales y el retorno de pago", () => {
    expect(reglas.length).toBeGreaterThan(1);
    for (const r of reglas) {
      for (const ruta of ["/admin", "/api/", "/comparar", "/favoritos", "/publica/agente/pago", "/publica/agente/renovar"]) {
        expect(r.disallow, r.userAgent).toContain(ruta);
      }
    }
  });

  it("no bloquea el catálogo base ni las fichas", () => {
    for (const r of reglas) {
      expect(r.allow).toBe("/");
      expect(r.disallow).not.toContain("/inmuebles");
      expect(r.disallow).not.toContain("/inmuebles/");
      // bloquear las variantes impediría leer su noindex por cabecera
      expect(r.disallow!.some((d) => d.startsWith("/inmuebles"))).toBe(false);
    }
  });

  it("los bots de IA llevan pausa entre solicitudes", () => {
    const ia = reglas.filter((r) => r.userAgent !== "*");
    expect(ia.length).toBeGreaterThan(0);
    for (const r of ia) expect(r.crawlDelay).toBeGreaterThan(0);
  });
});

describe("cabeceras de next.config", () => {
  it("cada parámetro de filtro del catálogo marca noindex en /inmuebles", async () => {
    const cabeceras = await nextConfig.headers!();
    const noindex = cabeceras.filter((h) => h.headers.some((x) => x.key === "X-Robots-Tag"));
    const claves = noindex.map((h) => (h.has?.[0] as { key: string }).key);
    // Todo parámetro que entiende el catálogo debe estar cubierto.
    const entiende = Object.keys(
      Object.fromEntries(
        [
          "q", "tipo", "estado", "ciudad", "sector", "termino", "orden",
          "habitacionesMin", "banosMin", "parqueaderosMin", "precioMin", "precioMax", "areaMin", "areaMax",
        ].map((k) => [k, 1]),
      ),
    );
    for (const k of entiende) expect(claves).toContain(k);
    for (const h of noindex) expect(h.source).toBe("/inmuebles");
    // y el lector de la URL sigue entendiendo esos mismos parámetros
    expect(leerParams(new URLSearchParams("q=casa&precioMax=500")).texto).toBe("casa");
  });

  it("og.jpg y llms.txt llevan Cache-Control de un día", async () => {
    const cabeceras = await nextConfig.headers!();
    for (const src of ["/og.jpg", "/llms.txt"]) {
      const h = cabeceras.find((x) => x.source === src);
      expect(h?.headers[0].value).toMatch(/s-maxage=86400/);
    }
  });
});
