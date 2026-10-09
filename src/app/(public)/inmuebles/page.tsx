import type { Metadata } from "next";
import Link from "next/link";
import { Catalogo } from "@/components/public/catalogo";
import { JsonLd } from "@/components/seo/json-ld";
import { propertyUrl, siteConfig } from "@/lib/config/site";
import { getPublicInventory } from "@/lib/data/public-inventory";
import { construirIndice, contextoDe, sugerencias } from "@/lib/search/indice";
import { buscar } from "@/lib/search/motor";
import { leerParams } from "@/lib/search/url";
import { agruparPorSector, sectorPath } from "@/lib/seo/sectores";
import { titularInventario } from "@/lib/seo/titular";

export async function generateMetadata(): Promise<Metadata> {
  const t = titularInventario(await getPublicInventory());
  const donde = t.sectores.length > 0 ? `${t.lugar}: ${t.sectores.slice(0, 5).join(", ")}` : t.lugar;
  return {
    title: t.titulo,
    description: `${t.tipos} en venta en ${donde}. Describe lo que buscas, filtra por precio y características y agenda tu visita con ${siteConfig.name}.`.slice(0, 160),
    alternates: { canonical: "/inmuebles" },
    openGraph: {
      title: `${t.titulo} | ${siteConfig.name}`,
      description: `${t.tipos} en venta en ${donde}.`.slice(0, 200),
      url: `${siteConfig.url}/inmuebles`,
      images: [siteConfig.ogImage],
    },
  };
}

type SearchParams = Record<string, string | string[] | undefined>;

export default async function InmueblesPage({ searchParams }: { searchParams: Promise<SearchParams> }) {
  const inicial = leerParams(await searchParams);

  const todos = await getPublicInventory();
  const indice = construirIndice(todos);
  const ctx = contextoDe(todos);
  const titular = titularInventario(todos);
  const sectores = agruparPorSector(todos);

  // Mismo motor que usa el navegador: el HTML del servidor coincide con el primer render del cliente.
  const visibles = buscar(indice, inicial, ctx).resultados;

  // Datos estructurados (schema.org): lista de lo que muestra esta vista. Se omite
  // cuando no hay resultados (un ItemList vacío no aporta).
  const jsonLd =
    visibles.length > 0
      ? {
          "@context": "https://schema.org",
          "@type": "ItemList",
          name: titular.titulo,
          numberOfItems: visibles.length,
          itemListElement: visibles.map(({ item }, i) => ({
            "@type": "ListItem",
            position: i + 1,
            name: [item.titulo, item.sector, item.ciudad].filter(Boolean).join(" · "),
            url: propertyUrl(item.slug),
          })),
        }
      : null;

  return (
    <>
      {jsonLd && <JsonLd data={jsonLd} />}

      <header className="wrap pb-10 pt-14 sm:pb-12 sm:pt-20">
        <h1 className="t-display max-w-4xl">{titular.titulo}</h1>
        <p className="t-lead mt-5 max-w-2xl">
          {todos.length > 0
            ? "Cuéntanos qué buscas con tus palabras: zona, alcobas, presupuesto. El catálogo te muestra lo que encaja y por qué."
            : "Estamos preparando el portafolio. Escríbenos por WhatsApp y te mostramos lo disponible."}
        </p>
      </header>

      <Catalogo indice={indice} ctx={ctx} sugerencias={sugerencias(indice)} inicial={inicial} />

      {sectores.length > 0 && (
        <nav aria-labelledby="por-sector" className="wrap mt-24">
          <div className="border-t border-line pt-8">
            <h2 id="por-sector" className="text-[15px] font-semibold">Explora por sector</h2>
            <ul className="mt-4 flex flex-wrap gap-x-6 gap-y-2">
              {sectores.map((s) => (
                <li key={s.slug}>
                  <Link href={sectorPath(s)} className="link-arrow py-1 text-[15px]">
                    {s.tipos} en {s.nombre} <span className="tnum text-muted">({s.inmuebles.length})</span>
                  </Link>
                </li>
              ))}
            </ul>
          </div>
        </nav>
      )}
      <div className="h-24" />
    </>
  );
}
