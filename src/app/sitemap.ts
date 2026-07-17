import type { MetadataRoute } from "next";
import { getRepository } from "@/lib/data";
import type { PublicProperty } from "@/lib/domain";
import { propertyUrl, siteConfig } from "@/lib/config/site";

// Si Supabase falla justo durante un build, el sitemap quedaría congelado
// solo con las rutas estáticas hasta el siguiente deploy; con revalidación
// horaria se recupera solo.
export const revalidate = 3600;

export default async function sitemap(): Promise<MetadataRoute.Sitemap> {
  // siteConfig.url ya viene normalizada sin barra final.
  const base = siteConfig.url;
  let properties: PublicProperty[] = [];
  try {
    properties = await getRepository().properties.listPublic();
  } catch (err) {
    console.error("[sitemap] no se pudo listar inmuebles:", err);
  }

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

  return [...staticRoutes, ...propertyRoutes];
}
