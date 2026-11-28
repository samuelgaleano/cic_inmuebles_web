import { describe, expect, it } from "vitest";
import nextConfig from "../../../next.config";
import { ANCHO_MAXIMO, ANCHOS_DISPOSITIVO, mediaLoader, ogImagen } from "./image-loader";

const CLOUD = "https://res.cloudinary.com/demo/image/upload/v1/cic/foto.jpg";
const DRIVE = "https://lh3.googleusercontent.com/d/abc123=w1600";

describe("mediaLoader", () => {
  it("nunca pide a Cloudinary más de 1.600 px", () => {
    expect(mediaLoader({ src: CLOUD, width: 3840 })).toBe("https://res.cloudinary.com/demo/image/upload/f_auto,q_auto,c_limit,w_1600/v1/cic/foto.jpg");
    expect(mediaLoader({ src: CLOUD, width: 828 })).toContain("w_828/");
  });

  it("Drive también se recorta al tope", () => {
    expect(mediaLoader({ src: DRIVE, width: 2048 })).toBe("https://lh3.googleusercontent.com/d/abc123=w1600");
    expect(mediaLoader({ src: DRIVE, width: 640 })).toBe("https://lh3.googleusercontent.com/d/abc123=w640");
  });

  it("lo demás pasa igual", () => {
    expect(mediaLoader({ src: "https://i.ytimg.com/vi/x/hqdefault.jpg", width: 640 })).toBe("https://i.ytimg.com/vi/x/hqdefault.jpg");
  });
});

describe("Open Graph", () => {
  it("solo Cloudinary declara 1200×630 (es la única que sale recortada)", () => {
    expect(ogImagen(CLOUD)).toEqual({ url: expect.stringContaining("c_fill,g_auto,w_1200,h_630"), width: 1200, height: 630 });
    expect(ogImagen(DRIVE)).toEqual({ url: "https://lh3.googleusercontent.com/d/abc123=w1200" });
  });
});

describe("configuración de imágenes", () => {
  it("el optimizador de Vercel queda apagado y el srcset termina en el tope del loader", () => {
    expect(nextConfig.images?.loader).toBe("custom");
    expect(nextConfig.images?.remotePatterns).toEqual([]);
    expect(nextConfig.images?.deviceSizes).toEqual([...ANCHOS_DISPOSITIVO]);
    expect(Math.max(...ANCHOS_DISPOSITIVO)).toBe(ANCHO_MAXIMO);
  });

  it("la CSP actual se mantiene y la completa va solo en modo reporte", async () => {
    const base = (await nextConfig.headers!()).find((h) => h.source === "/:path*")!;
    const csp = base.headers.find((h) => h.key === "Content-Security-Policy")!.value;
    const reporte = base.headers.find((h) => h.key === "Content-Security-Policy-Report-Only")!.value;
    expect(csp).toContain("frame-ancestors 'self'");
    expect(csp).not.toContain("script-src");
    expect(reporte).toMatch(/script-src 'self' 'unsafe-inline'[^;]*https:\/\/checkout\.wompi\.co/);
    expect(reporte).toMatch(/frame-src [^;]*https:\/\/checkout\.wompi\.co[^;]*https:\/\/www\.youtube-nocookie\.com/);
    expect(reporte).toMatch(/img-src [^;]*res\.cloudinary\.com[^;]*googleusercontent\.com[^;]*i\.ytimg\.com/);
    expect(reporte).not.toContain("report-uri");
  });
});
