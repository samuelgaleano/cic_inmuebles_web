import type { MetadataRoute } from "next";
import { siteConfig } from "@/lib/config/site";

// Crawlers de IA nombrados explícitamente: hoy con la misma política que el
// resto (todo público salvo /admin), pero visibles y auditables para poder
// ajustar el acceso por bot cuando haga falta.
const AI_CRAWLERS = ["GPTBot", "ClaudeBot", "PerplexityBot", "Google-Extended"];

export default function robots(): MetadataRoute.Robots {
  return {
    rules: [
      {
        userAgent: "*",
        allow: "/",
        // El panel admin (Fase 1b) no debe indexarse
        disallow: ["/admin"],
      },
      ...AI_CRAWLERS.map((userAgent) => ({
        userAgent,
        allow: "/",
        disallow: ["/admin"],
      })),
    ],
    sitemap: `${siteConfig.url}/sitemap.xml`,
  };
}
