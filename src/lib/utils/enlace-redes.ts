import { siteConfig } from "@/lib/config/site";

/** Redes donde CIC publica sus inmuebles. */
export const REDES = ["instagram", "tiktok", "facebook"] as const;
export type Red = (typeof REDES)[number];

export const ETIQUETA_RED: Record<Red, string> = {
  instagram: "Instagram",
  tiktok: "TikTok",
  facebook: "Facebook",
};

/** URL pública de la ficha etiquetada para una red: así el lead que llega por ahí queda con su origen. */
export function enlaceParaRed(slug: string, red: Red): string {
  const s = encodeURIComponent(slug.trim());
  const params = new URLSearchParams({ utm_source: red, utm_medium: "social", utm_campaign: slug.trim() });
  return `${siteConfig.url}/inmuebles/${s}?${params.toString()}`;
}
