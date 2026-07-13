import type { Metadata } from "next";
import Link from "next/link";
import { notFound } from "next/navigation";
import { ArrowLeft, Bath, BedDouble, Building2, Car, MapPin, Maximize, Receipt } from "lucide-react";
import { PropertyGallery } from "@/components/public/property-gallery";
import { PropertyContactCard } from "@/components/public/property-contact-card";
import { StatusBadge } from "@/components/ui/status-badge";
import { JsonLd } from "@/components/seo/json-ld";
import { getRepository } from "@/lib/data";
import {
  PROPERTY_TYPE_LABELS,
  type PropertyMedia,
  type PropertyStatus,
  type PropertyType,
} from "@/lib/domain";
import { formatArea, formatPrice } from "@/lib/utils/format";
import { propertyUrl, siteConfig } from "@/lib/config/site";

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
function propertyMeta(p: NonNullable<Awaited<ReturnType<ReturnType<typeof getRepository>["properties"]["getPublicBySlug"]>>>) {
  const tipo = PROPERTY_TYPE_LABELS[p.tipo];
  const lugar = [p.ubicacion.sector, p.ubicacion.ciudad].filter(Boolean).join(", ");
  const c = p.caracteristicas;

  const title = lugar ? `${p.titulo} — ${tipo} en venta en ${p.ubicacion.ciudad}` : `${p.titulo} — ${tipo} en venta`;

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
      // Si el inmueble no tiene fotos, usamos la imagen de marca del sitio
      // (este openGraph reemplaza por completo al del layout raíz).
      images: images.length > 0 ? images.slice(0, 1) : ["/hero.jpg"],
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

export default async function PropertyDetailPage({
  params,
}: {
  params: Promise<{ slug: string }>;
}) {
  const { slug } = await params;
  const property = await getRepository().properties.getPublicBySlug(slug);
  if (!property) notFound();

  const images = property.medios.filter((m) => m.type === "image");
  const video = property.medios.find((m) => m.type === "video");
  const videoId = video ? youtubeId(video) : null;
  const { caracteristicas: c, ubicacion } = property;

  const specs = [
    c.habitaciones != null && { icon: BedDouble, label: "Habitaciones", value: String(c.habitaciones) },
    c.banos != null && { icon: Bath, label: "Baños", value: String(c.banos) },
    c.area != null && { icon: Maximize, label: "Área", value: formatArea(c.area) },
    c.parqueaderos != null && {
      icon: Car,
      label: "Parqueadero",
      value: c.parqueaderos > 0 ? String(c.parqueaderos) : "No tiene",
    },
    property.administracion != null && {
      icon: Receipt,
      label: "Administración",
      value: formatPrice(property.administracion),
    },
    ubicacion.conjunto && { icon: Building2, label: "Conjunto", value: ubicacion.conjunto },
  ].filter(Boolean) as { icon: typeof BedDouble; label: string; value: string }[];

  const ubicacionTexto = [ubicacion.sector, ubicacion.ciudad].filter(Boolean).join(", ");
  const fichaUrl = propertyUrl(property.slug);
  const whatsappMessage = `Hola ${siteConfig.name}, me interesa el inmueble "${property.titulo}" (${property.codigo}). ${fichaUrl}`;

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
      price: property.precio,
      priceCurrency: "COP",
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
    <div className="mx-auto max-w-6xl px-4 py-8 sm:px-6 lg:px-8">
      <JsonLd data={jsonLd} />
      <Link
        href="/inmuebles"
        className="inline-flex items-center gap-1.5 text-sm font-medium text-muted transition-colors hover:gap-2 hover:text-brand-700"
      >
        <ArrowLeft className="h-4 w-4" /> Volver al catálogo
      </Link>

      <div className="mt-4 grid gap-8 lg:grid-cols-3">
        {/* Columna principal */}
        <div className="lg:col-span-2">
          <PropertyGallery images={images} title={property.titulo} />

          {videoId && (
            <div className="mt-6 aspect-video overflow-hidden rounded-[1.4rem] border border-line">
              <iframe
                src={`https://www.youtube.com/embed/${videoId}`}
                title={`Video de ${property.titulo}`}
                allow="accelerometer; autoplay; clipboard-write; encrypted-media; gyroscope; picture-in-picture"
                allowFullScreen
                loading="lazy"
                className="h-full w-full"
              />
            </div>
          )}

          {/* Encabezado */}
          <div className="mt-6 flex flex-wrap items-start justify-between gap-3">
            <div>
              <div className="flex flex-wrap items-center gap-2">
                <span className="rounded-full bg-brand-50 px-2.5 py-1 text-xs font-semibold text-brand-700">
                  {PROPERTY_TYPE_LABELS[property.tipo]}
                </span>
                <StatusBadge status={property.estado} />
                <span className="text-xs text-muted">Cód. {property.codigo}</span>
              </div>
              <h1 className="mt-3 text-2xl font-bold tracking-tight text-ink sm:text-3xl">
                {property.titulo}
              </h1>
              {ubicacionTexto && (
                <p className="mt-1.5 flex items-center gap-1.5 text-muted">
                  <MapPin className="h-4 w-4 text-brand-500" />
                  {ubicacionTexto}
                </p>
              )}
            </div>
          </div>

          {/* Especificaciones: lista de definición (par campo-valor legible
              por buscadores e IAs, no solo divs decorativos) */}
          {specs.length > 0 && (
            <dl className="mt-6 grid grid-cols-2 gap-3 sm:grid-cols-3">
              {specs.map((s) => (
                <div key={s.label} className="rounded-xl border border-line bg-white p-4 transition-colors hover:border-brand-200">
                  <span className="flex h-9 w-9 items-center justify-center rounded-lg bg-brand-50 text-brand-700">
                    <s.icon className="h-5 w-5" />
                  </span>
                  <dt className="mt-3 text-xs text-muted">{s.label}</dt>
                  <dd className="font-semibold text-ink">{s.value}</dd>
                </div>
              ))}
            </dl>
          )}

          {/* Descripción */}
          {property.descripcion && (
            <section className="mt-10">
              <h2 className="text-xl font-bold tracking-tight text-ink">Descripción</h2>
              <p className="mt-3 whitespace-pre-line leading-relaxed text-ink-soft">
                {property.descripcion}
              </p>
            </section>
          )}
        </div>

        {/* Barra lateral */}
        <aside className="lg:col-span-1">
          <div className="lg:sticky lg:top-24 space-y-4">
            <div className="rounded-[1.4rem] border border-line bg-white p-6 shadow-[0_10px_40px_-28px_rgba(11,26,21,0.35)]">
              <p className="text-xs font-semibold uppercase tracking-[0.16em] text-brand-600">Precio</p>
              <p className="mt-1 font-display text-3xl font-extrabold tracking-tight text-ink">
                {formatPrice(property.precio)}
              </p>
              {property.estado === "vendido" && (
                <p className="mt-3 rounded-lg bg-rose-50 px-3 py-2 text-sm font-medium text-rose-700">
                  Este inmueble ya fue vendido. Escríbenos para ver opciones similares.
                </p>
              )}
            </div>

            <PropertyContactCard
              propertyId={property.id}
              propertySlug={property.slug}
              title={property.titulo}
              whatsappMessage={whatsappMessage}
            />
          </div>
        </aside>
      </div>
    </div>
  );
}
