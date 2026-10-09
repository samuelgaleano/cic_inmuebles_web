import type { Metadata } from "next";
import Link from "next/link";
import { BrandMark } from "@/components/brand/brand-mark";
import { buttonVariants } from "@/components/ui/button";
import { Reveal } from "@/components/ui/reveal";
import { Declaracion } from "@/components/public/declaracion";
import { HeroBuscador } from "@/components/public/hero-buscador";
import { TiraPortafolio } from "@/components/public/tira-portafolio";
import { WhatsAppButton } from "@/components/public/whatsapp-button";
import { JsonLd } from "@/components/seo/json-ld";
import { getPublicInventoryOrThrow } from "@/lib/data/public-inventory";
import { PROPERTY_TYPE_LABELS } from "@/lib/domain";
import { propertyUrl, siteConfig } from "@/lib/config/site";
import { construirIndice, contextoDe, sugerencias } from "@/lib/search/indice";
import { agruparPorSector, sectorPath } from "@/lib/seo/sectores";
import { tipoSingular, titularInventario } from "@/lib/seo/titular";
import { formatPriceCompact } from "@/lib/utils/format";

export const metadata: Metadata = {
  alternates: { canonical: "/" },
};

/** "Bella Suiza, Calleja y Gilmar" (máximo `max` nombres, el resto en "más sectores"). */
function listaSectores(sectores: string[], max = 4): string {
  const vis = sectores.slice(0, max);
  if (vis.length === 0) return "";
  if (vis.length === 1) return vis[0];
  const ultimo = sectores.length > max ? "más sectores" : vis[vis.length - 1];
  const primeros = sectores.length > max ? vis : vis.slice(0, -1);
  return `${primeros.join(", ")} y ${ultimo}`;
}

/** Titular que entra palabra por palabra desde una máscara (solo CSS). */
function TitularAnimado({ texto }: { texto: string }) {
  const palabras = texto.split(" ");
  return (
    <>
      {palabras.map((w, i) => (
        <span key={i}>
          <span className="palabra">
            <span style={{ "--i": i } as React.CSSProperties}>{w}</span>
          </span>
          {i < palabras.length - 1 ? " " : ""}
        </span>
      ))}
    </>
  );
}

// Red de seguridad: regenera la página cada hora aunque falle la
// revalidación bajo demanda del panel admin.
export const revalidate = 3600;

export default async function HomePage() {
  // Disponibles primero, luego en proceso y vendidos (orden del repositorio). Si la base de datos
  // falla justo al regenerar, se lanza el error: Next conserva la versión anterior en vez de cachear
  // una portada vacía durante una hora.
  const todos = await getPublicInventoryOrThrow();
  const indice = construirIndice(todos);
  const ctx = contextoDe(todos);
  const vitrina = todos.slice(0, 12);

  // El titular sale de lo que hay publicado: hoy "Apartamentos en venta en
  // Bogotá"; si entra una casa o un inmueble de otra ciudad, se ensancha solo.
  const titular = titularInventario(todos);
  const sectores = listaSectores(titular.sectores);
  const sectoresHome = agruparPorSector(todos);
  const nSectores = titular.sectores.length;

  // Cifras reales del inventario, nada de relleno.
  const resumen = [
    `${todos.length} ${todos.length === 1 ? tipoSingular(titular.tipos) : titular.tipos.toLowerCase()} en venta`,
    nSectores > 1 ? `${nSectores} sectores` : nSectores === 1 ? titular.sectores[0] : "",
    titular.desde ? `desde ${formatPriceCompact(titular.desde)}` : "",
  ]
    .filter(Boolean)
    .join(" · ");

  // La tira solo necesita lo que pinta la tarjeta (no el texto de búsqueda).
  const tarjetas = indice.slice(0, 12).map(({ texto: _texto, ...resto }) => resto);

  // Enriquece el nodo de organización del layout (mismo @id) con el área de
  // servicio real: las ciudades del inventario publicado, además del país.
  const cityNames = [...new Set(todos.map((p) => p.ubicacion.ciudad).filter(Boolean))];
  const areaJsonLd = {
    "@context": "https://schema.org",
    "@type": "RealEstateAgent",
    "@id": `${siteConfig.url}/#org`,
    areaServed: [
      { "@type": "Country", name: "Colombia" },
      ...cityNames.map((name) => ({ "@type": "City", name })),
    ],
  };

  // La vitrina como lista para buscadores: qué fichas hay y en qué orden.
  const vitrinaJsonLd = {
    "@context": "https://schema.org",
    "@type": "ItemList",
    name: titular.titulo,
    numberOfItems: vitrina.length,
    itemListElement: vitrina.map((p, i) => ({
      "@type": "ListItem",
      position: i + 1,
      url: propertyUrl(p.slug),
      name: [p.titulo, PROPERTY_TYPE_LABELS[p.tipo], p.ubicacion.sector, p.ubicacion.ciudad].filter(Boolean).join(" · "),
    })),
  };

  return (
    <>
      <JsonLd data={areaJsonLd} />
      {vitrina.length > 0 && <JsonLd data={vitrinaJsonLd} />}

      {/* ─────────────── Portada: titular + buscador por frase ─────────────── */}
      <section className="relative overflow-hidden">
        <BrandMark decorativo className="pointer-events-none absolute -right-24 top-4 hidden h-[40rem] w-[40rem] text-surface lg:block" />
        <div className="wrap relative pb-16 pt-14 sm:pb-24 sm:pt-24">
          <h1 className="t-display max-w-5xl">
            <TitularAnimado texto={`${titular.tipos} en venta en ${titular.lugar}`} />
          </h1>

          <p className="t-lead anim-sube mt-7 max-w-2xl" style={{ "--d": "520ms" } as React.CSSProperties}>
            {titular.ciudad && sectores
              ? `Un portafolio corto en ${titular.ciudad}, en ${sectores}: cada inmueble visitado y verificado por nosotros. ¿Vendes el tuyo? Te acompañamos de principio a fin.`
              : "Te ayudamos a vender tu inmueble de forma rápida y segura. Encuentra el tuyo en un portafolio corto, visitado y verificado por nosotros."}
          </p>

          <div className="anim-sube mt-12 max-w-3xl" style={{ "--d": "680ms" } as React.CSSProperties}>
            <HeroBuscador indice={indice} ctx={ctx} sugerencias={sugerencias(indice)} />
          </div>
        </div>
      </section>

      {/* ─────────────── El portafolio: tira horizontal ─────────────── */}
      <section aria-labelledby="portafolio" className="pb-8 sm:pb-16">
        {tarjetas.length > 0 ? (
          <TiraPortafolio titulo="Pocos inmuebles. Los correctos." descripcion={resumen} items={tarjetas} />
        ) : (
          <div className="wrap">
            <h2 id="portafolio" className="t-headline">Pocos inmuebles. Los correctos.</h2>
            <p className="t-lead mt-4 max-w-xl">
              Estamos preparando el portafolio. Escríbenos por WhatsApp y te mostramos lo disponible.
            </p>
          </div>
        )}

        {sectoresHome.length > 0 && (
          <nav className="wrap mt-8" aria-label="Sectores">
            <ul className="flex flex-wrap gap-x-6 gap-y-1">
              {sectoresHome.map((s) => (
                <li key={s.slug}>
                  <Link href={sectorPath(s)} className="link-arrow py-1.5 text-[15px]">
                    {s.tipos} en {s.nombre} <span className="tnum text-muted">({s.inmuebles.length})</span>
                  </Link>
                </li>
              ))}
            </ul>
          </nav>
        )}
      </section>

      {/* ─────────────── Declaración de principios ─────────────── */}
      <section className="bg-surface" aria-label="Cómo trabajamos">
        <div className="wrap section-y">
          <Declaracion
            className="max-w-4xl"
            texto="Un portafolio corto, a propósito. Visitamos y verificamos cada inmueble antes de publicarlo, respondemos directo por WhatsApp y, si vendes, solo cobramos cuando se cierra la venta."
          />
        </div>
      </section>

      {/* ─────────────── Tres pasos, en texto ─────────────── */}
      <section className="wrap section-y" aria-labelledby="pasos">
        <h2 id="pasos" className="t-headline max-w-3xl">Del primer mensaje a las llaves.</h2>
        <ol className="mt-14 grid gap-x-10 gap-y-12 md:grid-cols-3">
          {[
            {
              t: "Cuéntanos qué buscas",
              d: "Escribe una frase con tus palabras: zona, alcobas, presupuesto. El catálogo la entiende y te dice por qué aparece cada inmueble.",
            },
            {
              t: "Elige tu día",
              d: "Marca el día y la franja que te sirven. Un asesor te confirma la visita por WhatsApp.",
            },
            {
              t: "Te acompañamos hasta las llaves",
              d: "Negociación y papeleo, de principio a fin, con respuesta directa y sin intermediarios.",
            },
          ].map((paso, i) => (
            <Reveal as="li" key={paso.t} delay={i * 110} className="border-t border-ink pt-6">
              <h3 className="t-title">{paso.t}</h3>
              <p className="mt-3 max-w-sm text-muted">{paso.d}</p>
            </Reveal>
          ))}
        </ol>
      </section>

      {/* ─────────────── Para propietarios ─────────────── */}
      <section className="bg-ink text-white" aria-labelledby="vende">
        <div className="wrap section-y">
          <h2 id="vende" className="t-display max-w-3xl">¿Vendes tu inmueble?</h2>
          <p className="mt-6 max-w-xl text-[1.1875rem] leading-snug text-white/75 sm:text-[1.375rem]">
            Sin costo inicial. Nos encargamos de las fotos, la publicación, las visitas y la negociación, y solo cobramos una comisión del 3% cuando se cierra la venta.
          </p>
          <div className="mt-10 flex flex-wrap gap-3">
            <Link href="/vender" className={buttonVariants({ variant: "inverse", size: "lg" })}>
              Vender mi inmueble
            </Link>
            <WhatsAppButton
              size="lg"
              message={`Hola ${siteConfig.name}, tengo un inmueble que quiero vender y me gustaría más información.`}
              label="Hablar por WhatsApp"
            />
          </div>
          <p className="mt-16 max-w-2xl border-t border-white/15 pt-6 text-[15px] leading-relaxed text-white/70">
            ¿Eres agente inmobiliario? Aliémonos: tú traes el inmueble, nosotros lo promocionamos y lo movemos, y compartimos la comisión 50/50.{" "}
            <Link href="/contacto" className="font-medium text-white underline underline-offset-4 transition-colors hover:text-brand-300">
              Hablemos
            </Link>
            .
          </p>
        </div>
      </section>
    </>
  );
}
