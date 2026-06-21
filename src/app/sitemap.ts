import type { MetadataRoute } from "next";
import { getRepository } from "@/lib/data";
import type { PublicProperty } from "@/lib/domain";
import { siteConfig } from "@/lib/config/site";

export default async function sitemap(): Promise<MetadataRoute.Sitemap> {
  const base = siteConfig.url.replace(/\/$/, "");
  let properties: PublicProperty[] = [];
  try {
    properties = await getRepository().properties.listPublic();
  } catch (err) {
    console.error("[sitemap] no se pudo listar inmuebles:", err);
  }

  const staticRoutes: MetadataRoute.Sitemap = [
    { url: `${base}/`, changeFrequency: "daily", priority: 1 },
    { url: `${base}/inmuebles`, changeFrequency: "daily", priority: 0.9 },
    { url: `${base}/vender`, changeFrequency: "monthly", priority: 0.7 },
    { url: `${base}/contacto`, changeFrequency: "monthly", priority: 0.5 },
  ];

  const propertyRoutes: MetadataRoute.Sitemap = properties.map((p) => ({
    url: `${base}/inmuebles/${p.slug}`,
    lastModified: p.actualizadoEn,
    changeFrequency: "weekly",
    priority: 0.8,
  }));

  return [...staticRoutes, ...propertyRoutes];
}
