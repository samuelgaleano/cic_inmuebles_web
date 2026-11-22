import type { MetadataRoute } from "next";
import { siteConfig } from "@/lib/config/site";

// Crawlers de IA nombrados explícitamente: misma política que el resto pero con
// pausa entre solicitudes (la respetan los que cumplen el estándar), visibles y
// auditables para poder ajustar el acceso por bot cuando haga falta.
const AI_CRAWLERS = ["GPTBot", "ClaudeBot", "PerplexityBot", "Google-Extended"];
const RETARDO_IA_S = 10;

/**
 * Lo que ningún rastreador debe pedir: no aporta al índice y en su mayoría son rutas dinámicas (invocan funciones).
 *  - /admin y /api: privados o sin contenido.
 *  - /comparar y /favoritos: dependen del navegador de cada visitante (ya son noindex).
 *  - Las variantes filtradas /inmuebles?… NO se bloquean: /inmuebles es ISR (se sirve desde la CDN sin invocar
 *    funciones) y un bloqueo impediría a Google leer su `X-Robots-Tag: noindex` y el canonical; además el
 *    SearchAction del sitio apunta a /inmuebles?q=.
 *  - /publica/agente/pago y /renovar: pantallas personales de retorno de pago y renovación.
 */
export const RUTAS_SIN_RASTREO = [
  "/admin",
  "/api/",
  "/comparar",
  "/favoritos",
  "/publica/agente/pago",
  "/publica/agente/renovar",
];

export default function robots(): MetadataRoute.Robots {
  return {
    rules: [
      {
        userAgent: "*",
        allow: "/",
        disallow: RUTAS_SIN_RASTREO,
      },
      ...AI_CRAWLERS.map((userAgent) => ({
        userAgent,
        allow: "/",
        disallow: RUTAS_SIN_RASTREO,
        crawlDelay: RETARDO_IA_S,
      })),
    ],
    sitemap: `${siteConfig.url}/sitemap.xml`,
  };
}
