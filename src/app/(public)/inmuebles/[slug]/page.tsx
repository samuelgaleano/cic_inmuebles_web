import type { Metadata } from "next";
import Link from "next/link";
import { notFound } from "next/navigation";
import { ArrowLeft } from "lucide-react";
import { AgendarVisita } from "@/components/public/agendar-visita";
import { BarraMovil } from "@/components/public/barra-movil";
import { BotonCompartir } from "@/components/public/boton-compartir";
import { BotonComparar } from "@/components/public/boton-comparar";
import { BotonFavorito } from "@/components/public/boton-favorito";
import { DescripcionFicha } from "@/components/public/descripcion-ficha";
import { EstadoPublico } from "@/components/public/estado-publico";
import { Galeria } from "@/components/public/galeria";
import { RejillaInmuebles } from "@/components/public/rejilla-inmuebles";
import { SimuladorCuota } from "@/components/public/simulador-cuota";
import { VideoYoutube } from "@/components/public/video-youtube";
import { JsonLd } from "@/components/seo/json-ld";
import { getRepository } from "@/lib/data";
import {
  PROPERTY_TYPE_LABELS,
  type PropertyMedia,
  type PropertyStatus,
  type PropertyType,
  type PublicProperty,
} from "@/lib/domain";
import { ordenarDescripcion } from "@/lib/ficha/descripcion";
import { contextoDePrecio, fraseContexto } from "@/lib/ficha/valor";
import { formatArea, formatPrice, formatPriceOrConsult } from "@/lib/utils/format";
import { propertyUrl, siteConfig } from "@/lib/config/site";
import { getPublicInventoryOrThrow } from "@/lib/data/public-inventory";
import { agruparPorSector, encontrarSector, sectorPath } from "@/lib/seo/sectores";
import { ogImageUrl } from "@/lib/utils/image-loader";

// La ficha se regenera cada hora aunque el panel no la revalide (antes quedaba semanas en la caché del CDN).
export const revalidate = 3600;

// Estado del inmueble → disponibilidad schema.org ("en_proceso" NO es InStock).
const SCHEMA_AVAILABILITY: Record<PropertyStatus, string> = {
  disponible: "https://schema.org/InStock",
  en_proceso: "https://schema.org/LimitedAvailability",
  vendido: "https://schema.org/SoldOut",
};

// Tipo de inmueble → tipo schema.org de lo ofrecido.
const SCHEMA_ITEM_TYPE: Record<PropertyType, string> = {
  apartamento: "Apartment",
  apartaestudio: "Apartment",
  casa: "House",
  casa_campestre: "House",
  finca: "House",
  oficina: "Place",
  local: "Place",
  bodega: "Place",
  lote: "Place",
};

// numberOfBedrooms/numberOfBathroomsTotal/floorSize son propiedades de
// Accommodation: solo aplican a los tipos residenciales, no a Place.
const ACCOMMODATION_TYPES = new Set(["Apartment", "House"]);

export async function generateStaticParams() {
  try {
    const properties = await getRepository().properties.listPublic();
    return properties.map((p) => ({ slug: p.slug }));
  } catch (err) {
    // Si la base de datos no está disponible en build, generamos bajo demanda.
    console.error("[inmuebles] generateStaticParams:", err);
    return [];
  }
}

/**
 * Title y description de la ficha a partir de los campos estructurados.
 * El campo libre `descripcion` es texto operativo (emojis, saltos de línea)
 * y no sirve como snippet de buscador.
 */
function propertyMeta(p: PublicProperty) {
  const tipo = PROPERTY_TYPE_LABELS[p.tipo];
  const lugar = [p.ubicacion.sector, p.ubicacion.ciudad].filter(Boolean).join(", ");
  const c = p.caracteristicas;

  // Lo que la gente busca va primero ("Apartamento en venta en Bella Suiza,
  // Bogotá"); el nombre del inmueble se agrega solo si aporta algo distinto
  // del sector (p. ej. "Area19 Calleja" sí; "Bella Suiza" en Bella Suiza no).
  const sector = p.ubicacion.sector?.toLocaleLowerCase("es");
  const nombreAporta = !sector || p.titulo.toLocaleLowerCase("es") !== sector;
  const title = `${tipo} en venta${lugar ? ` en ${lugar}` : ""}${nombreAporta ? ` · ${p.titulo}` : ""}`;

  const detalles = [
    c.habitaciones != null && `${c.habitaciones} habitaciones`,
    c.banos != null && `${c.banos} baños`,
    c.area != null && formatArea(c.area),
  ]
    .filter(Boolean)
    .join(", ");
  const description = [
    `${tipo} en venta${lugar ? ` en ${lugar}` : ""}`,
    detalles || null,
    `${formatPrice(p.precio)}. Agenda tu visita con ${siteConfig.name}.`,
  ]
    .filter(Boolean)
    .join(". ");

  return { title, description: description.slice(0, 160) };
}

export async function generateMetadata({
  params,
}: {
  params: Promise<{ slug: string }>;
}): Promise<Metadata> {
  const { slug } = await params;
  const property = await getRepository().properties.getPublicBySlug(slug);
  if (!property) return { title: "Inmueble no encontrado" };

  const images = property.medios.filter((m) => m.type === "image").map((m) => m.url);
  const meta = propertyMeta(property);
  return {
    title: meta.title,
    description: meta.description,
    alternates: { canonical: `/inmuebles/${property.slug}` },
    openGraph: {
      title: meta.title,
      description: meta.description,
      url: propertyUrl(property.slug),
      // Si el inmueble no tiene fotos, usamos la imagen de marca del sitio
      // (este openGraph reemplaza por completo al del layout raíz). La foto sale ya
      // recortada a 1200×630: antes WhatsApp recibía el original vertical.
      images:
        images.length > 0
          ? [{ url: ogImageUrl(images[0]), width: 1200, height: 630, alt: property.titulo }]
          : [siteConfig.ogImage],
    },
  };
}

/** Extrae el ID de un video de YouTube a partir de su URL o ID directo. */
function youtubeId(media: PropertyMedia): string | null {
  if (media.provider !== "youtube") return null;
  const url = media.url;
  if (!url.includes("/") && !url.includes("=")) return url; // ya es un ID
  const match = url.match(/(?:youtu\.be\/|v=|embed\/)([\w-]{11})/);
  return match?.[1] ?? null;
}

/** Hasta 3 inmuebles parecidos: primero los del mismo sector, luego los de precio más cercano. */
function similares(actual: PublicProperty, todos: PublicProperty[]): PublicProperty[] {
  return todos
    .filter((p) => p.id !== actual.id && p.estado !== "vendido")
    .map((p) => ({
      p,
      mismoSector: p.ubicacion.sector && p.ubicacion.sector === actual.ubicacion.sector ? 0 : 1,
      distancia: Math.abs(p.precio - actual.precio),
    }))
    .sort((a, b) => a.mismoSector - b.mismoSector || a.distancia - b.distancia)
    .slice(0, 3)
    .map((x) => x.p);
}

export default async function PropertyDetailPage({
  params,
}: {
  params: Promise<{ slug: string }>;
}) {
  const { slug } = await params;
  const property = await getRepository().properties.getPublicBySlug(slug);
  if (!property) notFound();

  // Si la base de datos falla al regenerar, Next conserva la versión anterior en vez de cachear una ficha sin contexto.
  const todos = await getPublicInventoryOrThrow();
  // El grupo de sector exacto de este inmueble (mismo slug, así que sin
  // ambigüedad de nombre ni de ciudad), para enlazar a la URL real que
  // agruparPorSector generó — incluida la desambiguada por colisión.
  const sector = encontrarSector(agruparPorSector(todos), property);

  const images = property.medios.filter((m) => m.type === "image");
  const video = property.medios.find((m) => m.type === "video");
  const videoId = video ? youtubeId(video) : null;
  const { caracteristicas: c, ubicacion } = property;

  const descripcion = ordenarDescripcion(property.descripcion, {
    precio: property.precio,
    administracion: property.administracion,
    area: c.area,
    habitaciones: c.habitaciones,
    banos: c.banos,
    parqueaderos: c.parqueaderos,
  });

  // Las cifras grandes: solo lo que el inmueble tiene (un 0 no es una cifra que presumir).
  const cifras = [
    c.habitaciones != null && { etiqueta: "Habitaciones", valor: String(c.habitaciones), unidad: "" },
    c.banos != null && { etiqueta: "Baños", valor: String(c.banos), unidad: "" },
    c.area != null && { etiqueta: "Área", valor: new Intl.NumberFormat("es-CO").format(c.area), unidad: "m²" },
    c.parqueaderos != null && c.parqueaderos > 0 && { etiqueta: c.parqueaderos === 1 ? "Parqueadero" : "Parqueaderos", valor: String(c.parqueaderos), unidad: "" },
  ].filter(Boolean) as { etiqueta: string; valor: string; unidad: string }[];

  const contexto = contextoDePrecio(
    { id: property.id, precio: property.precio, area: c.area, estado: property.estado },
    todos.map((p) => ({ id: p.id, precio: p.precio, area: p.caracteristicas.area, estado: p.estado })),
  );

  const datos: { etiqueta: string; valor: string; nota?: string }[] = [
    { etiqueta: "Código", valor: property.codigo },
    ...(ubicacion.conjunto ? [{ etiqueta: "Conjunto o edificio", valor: ubicacion.conjunto }] : []),
    ...(property.administracion != null ? [{ etiqueta: "Administración", valor: `${formatPrice(property.administracion)} al mes` }] : []),
    ...(c.parqueaderos === 0 ? [{ etiqueta: "Parqueadero", valor: "No tiene" }] : []),
    ...(contexto ? [{ etiqueta: "Precio por m²", valor: formatPrice(contexto.porM2), nota: fraseContexto(contexto) }] : []),
    ...descripcion.datos,
  ];

  const ubicacionTexto = [ubicacion.sector, ubicacion.ciudad].filter(Boolean).join(", ");
  const fichaUrl = propertyUrl(property.slug);
  const parecidos = similares(property, todos);

  // Datos estructurados (schema.org): la ficha como oferta inmobiliaria
  // (Offer + itemOffered, no Product: Google no admite Product para finca raíz)
  // + migas de pan. El seller enlaza al nodo de organización del layout (@id).
  const schemaType = SCHEMA_ITEM_TYPE[property.tipo];
  const esVivienda = ACCOMMODATION_TYPES.has(schemaType);
  const jsonLd = [
    {
      "@context": "https://schema.org",
      "@type": "Offer",
      name: property.titulo,
      description: propertyMeta(property).description,
      sku: property.codigo,
      category: PROPERTY_TYPE_LABELS[property.tipo],
      url: fichaUrl,
      // Un precio sin cargar (0) no se publica como oferta de $0.
      ...(property.precio > 0 && { price: property.precio, priceCurrency: "COP" }),
      availability: SCHEMA_AVAILABILITY[property.estado],
      seller: { "@id": `${siteConfig.url}/#org` },
      ...(images.length > 0 && { image: images.slice(0, 3).map((m) => m.url) }),
      itemOffered: {
        "@type": schemaType,
        name: property.titulo,
        ...(esVivienda && c.habitaciones != null && { numberOfBedrooms: c.habitaciones }),
        ...(esVivienda && c.banos != null && { numberOfBathroomsTotal: c.banos }),
        ...(esVivienda &&
          c.area != null && {
            floorSize: { "@type": "QuantitativeValue", value: c.area, unitCode: "MTK" },
          }),
        ...(ubicacion.ciudad && {
          address: {
            "@type": "PostalAddress",
            addressLocality: ubicacion.ciudad,
            addressCountry: "CO",
          },
        }),
      },
    },
    {
      "@context": "https://schema.org",
      "@type": "BreadcrumbList",
      itemListElement: [
        { "@type": "ListItem", position: 1, name: "Inicio", item: siteConfig.url },
        { "@type": "ListItem", position: 2, name: "Inmuebles", item: `${siteConfig.url}/inmuebles` },
        { "@type": "ListItem", position: 3, name: property.titulo, item: fichaUrl },
      ],
    },
  ];

  return (
    <>
      <JsonLd data={jsonLd} />

      <header className="wrap pb-8 pt-8 sm:pb-10">
        <Link href="/inmuebles" className="link-arrow py-2 text-[15px]">
          <ArrowLeft className="h-4 w-4" aria-hidden="true" /> Inmuebles
        </Link>

        <p className="mt-8 text-[15px] text-muted">
          {PROPERTY_TYPE_LABELS[property.tipo]}
          {ubicacionTexto && " · "}
          {sector ? (
            // Enlace interno a la página del sector: le da a Google el contexto "apartamentos en X".
            <>
              <Link href={sectorPath(sector)} className="text-ink-soft underline decoration-line-strong underline-offset-4 transition-colors hover:text-brand-700 hover:decoration-brand-700">
                {sector.nombre}
              </Link>
              {ubicacion.ciudad ? `, ${ubicacion.ciudad}` : ""}
            </>
          ) : (
            ubicacionTexto
          )}
        </p>
        <h1 className="t-display mt-2 max-w-4xl">{property.titulo}</h1>

        <div className="mt-6 flex flex-wrap items-center justify-between gap-x-8 gap-y-3">
          <div className="flex flex-wrap items-baseline gap-x-5 gap-y-1">
            <p className="tnum text-[2rem] font-semibold tracking-[-0.03em] sm:text-[2.5rem]">{formatPriceOrConsult(property.precio)}</p>
            <EstadoPublico estado={property.estado} />
          </div>
          <div className="-mx-2 flex flex-wrap items-center gap-1">
            <BotonFavorito id={property.slug} titulo={property.titulo} variante="plano" />
            <BotonCompartir url={fichaUrl} titulo={`${property.titulo} · ${siteConfig.name}`} texto={propertyMeta(property).description} />
            <BotonComparar id={property.slug} titulo={property.titulo} className="mx-2" />
          </div>
        </div>

        {property.estado === "vendido" && (
          <p className="mt-6 max-w-xl rounded-[var(--radius-card)] bg-surface px-5 py-4 text-[15px]">
            Este inmueble ya fue vendido. Escríbenos y te mostramos opciones similares.
          </p>
        )}
        {property.estado === "en_proceso" && (
          <p className="mt-6 max-w-xl rounded-[var(--radius-card)] bg-surface px-5 py-4 text-[15px]">
            Está en proceso de venta. Escríbenos para confirmar si sigue disponible.
          </p>
        )}
      </header>

      <Galeria
        titulo={property.titulo}
        slug={property.slug}
        fotos={images.map((m) => ({ id: m.id, url: m.url, alt: m.alt }))}
      />

      <div className="wrap mt-16 grid grid-cols-[minmax(0,1fr)] gap-16 lg:grid-cols-[minmax(0,1fr)_25rem] lg:gap-20">
        <div className="min-w-0 space-y-20">
          {cifras.length > 0 && (
            <dl className="grid grid-cols-2 gap-px overflow-hidden rounded-[var(--radius-card)] bg-line sm:grid-cols-4">
              {cifras.map((s) => (
                <div key={s.etiqueta} className="bg-white px-5 py-6">
                  <dt className="text-[14px] text-muted">{s.etiqueta}</dt>
                  <dd className="tnum mt-1 text-[2.5rem] font-semibold leading-none tracking-[-0.03em]">
                    {s.valor}
                    {s.unidad && <span className="ml-1 text-[1.125rem] font-medium tracking-normal text-muted">{s.unidad}</span>}
                  </dd>
                </div>
              ))}
            </dl>
          )}

          <DescripcionFicha d={descripcion} />

          {videoId && (
            <section aria-labelledby="video-titulo">
              <h2 id="video-titulo" className="t-title mb-6">Recorrido en video</h2>
              <VideoYoutube id={videoId} titulo={property.titulo} />
            </section>
          )}

          {datos.length > 0 && (
            <section aria-labelledby="datos-titulo">
              <h2 id="datos-titulo" className="t-title">Datos del inmueble</h2>
              <dl className="mt-6">
                {datos.map((d) => (
                  <div key={d.etiqueta} className="grid gap-x-6 border-t border-line py-4 sm:grid-cols-[13rem_1fr]">
                    <dt className="text-[15px] text-muted">{d.etiqueta}</dt>
                    <dd className="tnum text-[15px] font-medium">
                      {d.valor}
                      {d.nota && <span className="mt-1 block text-[13px] font-normal text-muted">{d.nota} Compara solo entre inmuebles de CIC, no con el mercado.</span>}
                    </dd>
                  </div>
                ))}
              </dl>
            </section>
          )}

          {property.estado !== "vendido" && <SimuladorCuota precio={property.precio} />}
        </div>

        <div className="min-w-0 lg:sticky lg:top-24 lg:self-start">
          <AgendarVisita
            propertyId={property.id}
            propertySlug={property.slug}
            titulo={property.titulo}
            codigo={property.codigo}
            url={fichaUrl}
            precio={formatPriceOrConsult(property.precio)}
            vendido={property.estado === "vendido"}
          />
        </div>
      </div>

      {parecidos.length > 0 && (
        <section className="mt-28 bg-surface" aria-labelledby="parecidos-titulo">
          <div className="wrap section-y">
            <h2 id="parecidos-titulo" className="t-headline max-w-2xl">Otros inmuebles que podrían interesarte</h2>
            <div className="mt-12">
              <RejillaInmuebles inmuebles={parecidos} />
            </div>
          </div>
        </section>
      )}

      {property.estado !== "vendido" && <BarraMovil titulo={property.titulo} precio={formatPriceOrConsult(property.precio)} />}
    </>
  );
}
