import type { MetadataRoute } from "next";
import { siteConfig } from "@/lib/config/site";

export default function robots(): MetadataRoute.Robots {
  const base = siteConfig.url.replace(/\/$/, "");
  return {
    rules: {
      userAgent: "*",
      allow: "/",
      // El panel admin (Fase 1b) no debe indexarse
      disallow: ["/admin"],
    },
    sitemap: `${base}/sitemap.xml`,
  };
}
