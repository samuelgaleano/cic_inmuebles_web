import type { Metadata } from "next";
import Link from "next/link";
import { ArrowRight, Check } from "lucide-react";
import { buttonVariants } from "@/components/ui/button";
import { HeroBuscador } from "@/components/public/hero-buscador";
import { HeroVitrina } from "@/components/public/hero-vitrina";
import { PasosInteractivos } from "@/components/public/pasos-interactivos";
import { PruebaPortafolio } from "@/components/public/prueba-portafolio";
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

// Fichas cuyas fotos llevan una marca de agua ajena (Metrocuadrado.com): se quedan en el catálogo, pero
// no se usan en las fotos grandes de la portada hasta que CIC las reemplace.
const SIN_FOTO_GRANDE = ["puente-largo-alhambra"];

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
  const fotosGrandes = tarjetas.filter((t) => !SIN_FOTO_GRANDE.includes(t.slug));

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

      {/* ─────────────── Portada: titular, acciones, vitrina de fotos reales y buscador ─────────────── */}
      <section className="relative overflow-hidden" aria-label="Portada">
        <div className="wrap relative grid items-start gap-x-14 gap-y-9 pb-14 pt-8 sm:pt-14 lg:grid-cols-[minmax(0,1.05fr)_minmax(0,0.95fr)] lg:gap-y-8 lg:pb-24 lg:pt-12">
          <div className="min-w-0 lg:col-start-1 lg:row-start-1">
            <h1 className="t-hero max-w-3xl">
              <TitularAnimado texto={`${titular.tipos} en venta en ${titular.lugar}`} />
            </h1>

            <p className="t-lead anim-sube mt-6 max-w-xl" style={{ "--d": "520ms" } as React.CSSProperties}>
              {titular.ciudad && sectores
                ? `Un portafolio corto en ${titular.ciudad}, en ${sectores}: cada inmueble visitado y verificado por nosotros. ¿Vendes el tuyo? Te acompañamos de principio a fin.`
                : "Te ayudamos a vender tu inmueble de forma rápida y segura. Encuentra el tuyo en un portafolio corto, visitado y verificado por nosotros."}
            </p>

            <div className="anim-sube mt-8 flex flex-wrap gap-3" style={{ "--d": "640ms" } as React.CSSProperties}>
              <Link href="/inmuebles" className={buttonVariants({ variant: "primary", size: "lg" })}>
                {todos.length > 0 ? `Ver los ${todos.length} inmuebles` : "Ver los inmuebles"}
                <ArrowRight className="h-4 w-4 transition-transform duration-200 group-hover:translate-x-0.5" aria-hidden />
              </Link>
              <WhatsAppButton
                size="lg"
                label="Hablar con un asesor"
                message={`Hola ${siteConfig.name}, quiero ver inmuebles y me gustaría hablar con un asesor.`}
              />
            </div>
          </div>

          <div className="anim-sube min-w-0 lg:col-start-2 lg:row-span-2 lg:row-start-1" style={{ "--d": "380ms" } as React.CSSProperties}>
            <HeroVitrina items={fotosGrandes} resumen={resumen || undefined} className="mt-2 lg:mt-3" />
          </div>

          <div className="anim-sube min-w-0 lg:col-start-1 lg:row-start-2" style={{ "--d": "760ms" } as React.CSSProperties}>
            <p className="mb-3 text-[15px] font-medium text-ink-soft">O cuéntanos qué buscas, con tus palabras:</p>
            <HeroBuscador indice={indice} ctx={ctx} sugerencias={sugerencias(indice)} />
            <ul className="mt-6 flex flex-wrap gap-x-6 gap-y-2 text-[14px] text-ink-soft">
              {["Cada inmueble, visitado y verificado", "Respuesta directa por WhatsApp", "Si vendes, 3 % solo al cerrar"].map((t) => (
                <li key={t} className="flex items-center gap-2">
                  <Check className="h-4 w-4 text-brand-700" aria-hidden />
                  {t}
                </li>
              ))}
            </ul>
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

      {/* ─────────────── Declaración de principios, con sus pruebas ─────────────── */}
      <section className="bg-surface" aria-labelledby="corto">
        <div className="wrap section-y">
          <PruebaPortafolio items={fotosGrandes} total={todos.length} />
        </div>
      </section>

      {/* ─────────────── Del primer mensaje a las llaves: recorrido interactivo ─────────────── */}
      <section className="wrap section-y" aria-labelledby="pasos">
        <h2 id="pasos" className="t-headline max-w-3xl">Del primer mensaje a las llaves.</h2>
        <PasosInteractivos indice={indice} ctx={ctx} sugerencias={sugerencias(indice)} />
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
