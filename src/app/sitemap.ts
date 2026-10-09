import type { MetadataRoute } from "next";
import { getRepository } from "@/lib/data";
import type { PublicProperty } from "@/lib/domain";
import { propertyUrl, siteConfig } from "@/lib/config/site";
import { agruparPorSector, sectorPath } from "@/lib/seo/sectores";

// Regeneración horaria; el panel además lo revalida al publicar, editar o borrar.
export const revalidate = 3600;

export default async function sitemap(): Promise<MetadataRoute.Sitemap> {
  // siteConfig.url ya viene normalizada sin barra final.
  const base = siteConfig.url;
  // Sin try/catch a propósito: si la base de datos falla al regenerar, Next sigue sirviendo el sitemap
  // anterior en vez de cachear uno sin fichas.
  const properties: PublicProperty[] = await getRepository().properties.listPublic();

  // Última modificación real del catálogo: el inmueble editado más reciente.
  // Aplica a la home y al listado, cuyo contenido cambia con el catálogo.
  const fechas = properties
    .map((p) => p.actualizadoEn)
    .filter((f): f is string => Boolean(f))
    .sort();
  const catalogoModificado = fechas.at(-1);

  const staticRoutes: MetadataRoute.Sitemap = [
    { url: base, lastModified: catalogoModificado, changeFrequency: "daily", priority: 1 },
    { url: `${base}/inmuebles`, lastModified: catalogoModificado, changeFrequency: "daily", priority: 0.9 },
    { url: `${base}/vender`, changeFrequency: "monthly", priority: 0.7 },
    { url: `${base}/publica`, changeFrequency: "monthly", priority: 0.7 },
    { url: `${base}/publica/agente`, changeFrequency: "monthly", priority: 0.6 },
    { url: `${base}/publica/condiciones`, changeFrequency: "yearly", priority: 0.3 },
    { url: `${base}/contacto`, changeFrequency: "monthly", priority: 0.5 },
  ];

  const propertyRoutes: MetadataRoute.Sitemap = properties.map((p) => ({
    url: propertyUrl(p.slug),
    lastModified: p.actualizadoEn,
    changeFrequency: "weekly",
    priority: 0.8,
  }));

  // Páginas por sector: solo las que entran al índice (ver seo/sectores.ts).
  const sectorRoutes: MetadataRoute.Sitemap = agruparPorSector(properties)
    .filter((s) => s.indexable)
    .map((s) => ({
      url: `${base}${sectorPath(s)}`,
      lastModified: s.inmuebles.map((p) => p.actualizadoEn).filter(Boolean).sort().at(-1),
      changeFrequency: "weekly",
      priority: 0.7,
    }));

  return [...staticRoutes, ...sectorRoutes, ...propertyRoutes];
}
