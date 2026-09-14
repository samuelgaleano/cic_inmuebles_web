import type { Metadata } from "next";
import Link from "next/link";
import { notFound } from "next/navigation";
import { ArrowLeft, MapPin } from "lucide-react";
import { PropertyGrid } from "@/components/public/property-grid";
import { WhatsAppButton } from "@/components/public/whatsapp-button";
import { JsonLd } from "@/components/seo/json-ld";
import { propertyUrl, siteConfig } from "@/lib/config/site";
import { getCoverMedia, type PublicProperty } from "@/lib/domain";
import { getPublicInventory, getPublicInventoryOrThrow } from "@/lib/data/public-inventory";
import { agruparPorSector, sectorPath, type Sector } from "@/lib/seo/sectores";
import { titularInventario } from "@/lib/seo/titular";
import { formatPriceCompact } from "@/lib/utils/format";

// Mismo ritmo que la home: se regenera cada hora aunque el panel no revalide
// (y `revalidatePublic()` la invalida antes, ver src/lib/actions/admin-properties.ts).
export const revalidate = 3600;

// Build: si Supabase falla justo aquí, se generan cero páginas de sector (no
// rompe el build); se recuperan solas en la siguiente revalidación.
export async function generateStaticParams() {
  return agruparPorSector(await getPublicInventory()).map((s) => ({ sector: s.slug }));
}

/**
 * Runtime: a diferencia de `generateStaticParams`, aquí el error de Supabase
 * SE PROPAGA. Si se tragara y devolviera `[]`, un sector real ausente por una
 * caída pasajera de la base de datos se confundiría con "no existe" y
 * `notFound()` lo dejaría en caché como 404 hasta la siguiente revalidación
 * exitosa — un problema temporal de infraestructura convertido en un error
 * permanente de contenido.
 */
async function cargarSectores(): Promise<Sector[]> {
  return agruparPorSector(await getPublicInventoryOrThrow());
}

/** Titular de la página: "Apartamentos en venta en La Calleja, Bogotá". */
function titularSector(s: Sector): string {
  const t = titularInventario(s.inmuebles);
  return `${t.tipos} en venta en ${s.nombre}, ${s.ciudad}`;
}

function rangoPrecios(items: PublicProperty[]): string {
  const precios = items.map((p) => p.precio).filter((n) => n > 0);
  if (precios.length === 0) return "";
  const min = Math.min(...precios);
  const max = Math.max(...precios);
  return min === max ? formatPriceCompact(min) : `${formatPriceCompact(min)} a ${formatPriceCompact(max)}`;
}

export async function generateMetadata({ params }: { params: Promise<{ sector: string }> }): Promise<Metadata> {
  const { sector } = await params;
  const s = (await cargarSectores()).find((x) => x.slug === sector);
  if (!s) return { title: "Sector no encontrado" };
  // El conteo, la descripción y el rango de precios hablan de lo que aún se
  // puede comprar: un sector con un solo espacio libre entre varios vendidos
  // no debería anunciar "3 inmuebles" ni indexarse por ellos (ver sectores.ts).
  const n = s.disponibles.length;
  const rango = rangoPrecios(s.disponibles);
  const titulo = titularSector(s);
  const description = `${n} ${n === 1 ? "inmueble disponible" : "inmuebles disponibles"} en ${s.nombre}, ${s.ciudad}${rango ? `, ${rango}` : ""}. Visitados y verificados por ${siteConfig.name}. Agenda tu visita por WhatsApp.`;
  const portada = getCoverMedia(s.inmuebles[0])?.url;
  return {
    title: titulo,
    description,
    alternates: { canonical: sectorPath(s) },
    // Con menos de dos disponibles la página duplicaría la ficha (o no vende
    // nada): existe para navegación interna, pero fuera del índice.
    robots: s.indexable ? { index: true, follow: true } : { index: false, follow: true },
    openGraph: { title: titulo, description, images: portada ? [portada] : ["/hero.jpg"] },
  };
}

export default async function SectorPage({ params }: { params: Promise<{ sector: string }> }) {
  const { sector } = await params;
  const sectores = await cargarSectores();
  const s = sectores.find((x) => x.slug === sector);
  if (!s) notFound();

  const titulo = titularSector(s);
  const n = s.disponibles.length;
  const rango = rangoPrecios(s.disponibles);
  const otros = sectores.filter((x) => x.slug !== s.slug && x.ciudad === s.ciudad);
  const url = `${siteConfig.url}${sectorPath(s)}`;

  const jsonLd = [
    {
      "@context": "https://schema.org",
      "@type": "BreadcrumbList",
      itemListElement: [
        { "@type": "ListItem", position: 1, name: "Inicio", item: siteConfig.url },
        { "@type": "ListItem", position: 2, name: "Inmuebles", item: `${siteConfig.url}/inmuebles` },
        { "@type": "ListItem", position: 3, name: s.nombre, item: url },
      ],
    },
    {
      "@context": "https://schema.org",
      "@type": "ItemList",
      name: titulo,
      // La lista refleja lo que la grilla muestra de verdad (incluye vendidos, con su badge).
      numberOfItems: s.inmuebles.length,
      itemListElement: s.inmuebles.map((p, i) => ({
        "@type": "ListItem",
        position: i + 1,
        name: p.titulo,
        url: propertyUrl(p.slug),
      })),
    },
  ];

  return (
    <div className="mx-auto max-w-6xl px-4 py-12 sm:px-6 lg:px-8">
      <JsonLd data={jsonLd} />

      <Link
        href="/inmuebles"
        className="inline-flex items-center gap-1.5 py-2 text-sm font-medium text-muted transition-colors hover:gap-2 hover:text-brand-700"
      >
        <ArrowLeft className="h-4 w-4" aria-hidden="true" /> Todos los inmuebles
      </Link>

      <header className="mt-4 max-w-2xl">
        <p className="inline-flex items-center gap-1.5 text-sm font-medium text-brand-700">
          <MapPin className="h-4 w-4" aria-hidden="true" /> {s.ciudad}
        </p>
        <h1 className="mt-2 text-balance text-3xl font-bold tracking-tight text-ink sm:text-4xl">{titulo}</h1>
        <p className="mt-3 text-muted">
          {n > 0 ? (
            <>
              <span className="font-semibold text-ink">{n}</span> {n === 1 ? "inmueble disponible" : "inmuebles disponibles"}
              {rango && (
                <>
                  {" "}· {n === 1 ? "" : "de "}
                  <span className="font-semibold text-ink">{rango}</span>
                </>
              )}
              .{" "}
            </>
          ) : (
            "Por ahora todo lo publicado aquí ya se vendió. "
          )}
          Cada uno visitado y verificado por nosotros; agenda tu visita por WhatsApp.
        </p>
      </header>

      <div className="mt-8">
        <PropertyGrid properties={s.inmuebles} />
      </div>

      <section className="mt-12 rounded-[1.6rem] border border-line bg-surface p-6 sm:p-8" aria-labelledby="sector-cta">
        <h2 id="sector-cta" className="text-xl font-bold tracking-tight text-ink">
          ¿Buscas algo distinto en {s.nombre}?
        </h2>
        <p className="mt-2 max-w-xl text-sm leading-relaxed text-muted">
          El catálogo es corto a propósito y cambia seguido. Cuéntanos qué buscas y te avisamos apenas
          entre un inmueble que encaje.
        </p>
        <WhatsAppButton
          className="mt-5"
          label="Cuéntanos qué buscas"
          message={`Hola ${siteConfig.name}, busco un inmueble en ${s.nombre}, ${s.ciudad}. ¿Me ayudan?`}
        />
      </section>

      {otros.length > 0 && (
        <nav className="mt-10" aria-labelledby="otros-sectores">
          <h2 id="otros-sectores" className="text-sm font-semibold text-muted">
            Otros sectores en {s.ciudad}
          </h2>
          <ul className="mt-3 flex flex-wrap gap-2">
            {otros.map((o) => (
              <li key={o.slug}>
                <Link
                  href={sectorPath(o)}
                  className="inline-flex items-center gap-1.5 rounded-full border border-line bg-white px-3.5 py-1.5 text-sm font-medium text-ink transition-colors hover:border-brand-300 hover:bg-brand-50 hover:text-brand-800"
                >
                  {o.nombre}
                  <span className="text-xs text-muted">{o.inmuebles.length}</span>
                </Link>
              </li>
            ))}
          </ul>
        </nav>
      )}
    </div>
  );
}
