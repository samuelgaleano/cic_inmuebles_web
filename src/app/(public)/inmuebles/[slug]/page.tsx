import type { Metadata } from "next";
import Link from "next/link";
import { notFound } from "next/navigation";
import { ArrowLeft, Bath, BedDouble, Building2, MapPin, Maximize, Receipt } from "lucide-react";
import { PropertyGallery } from "@/components/public/property-gallery";
import { PropertyContactCard } from "@/components/public/property-contact-card";
import { StatusBadge } from "@/components/ui/status-badge";
import { getRepository } from "@/lib/data";
import { PROPERTY_TYPE_LABELS, type PropertyMedia } from "@/lib/domain";
import { formatArea, formatPrice } from "@/lib/utils/format";
import { siteConfig } from "@/lib/config/site";

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

export async function generateMetadata({
  params,
}: {
  params: Promise<{ slug: string }>;
}): Promise<Metadata> {
  const { slug } = await params;
  const property = await getRepository().properties.getPublicBySlug(slug);
  if (!property) return { title: "Inmueble no encontrado" };

  const images = property.medios.filter((m) => m.type === "image").map((m) => m.url);
  return {
    title: property.titulo,
    description: property.descripcion,
    openGraph: {
      title: property.titulo,
      description: property.descripcion,
      images: images.slice(0, 1),
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
    property.administracion != null && {
      icon: Receipt,
      label: "Administración",
      value: formatPrice(property.administracion),
    },
    ubicacion.conjunto && { icon: Building2, label: "Conjunto", value: ubicacion.conjunto },
  ].filter(Boolean) as { icon: typeof BedDouble; label: string; value: string }[];

  const ubicacionTexto = [ubicacion.sector, ubicacion.ciudad].filter(Boolean).join(", ");
  const whatsappMessage = `Hola ${siteConfig.name}, me interesa el inmueble "${property.titulo}" (${property.codigo}). ${siteConfig.url}/inmuebles/${property.slug}`;

  return (
    <div className="mx-auto max-w-6xl px-4 py-8 sm:px-6 lg:px-8">
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

          {/* Especificaciones */}
          {specs.length > 0 && (
            <div className="mt-6 grid grid-cols-2 gap-3 sm:grid-cols-3">
              {specs.map((s) => (
                <div key={s.label} className="rounded-xl border border-line bg-white p-4 transition-colors hover:border-brand-200">
                  <span className="flex h-9 w-9 items-center justify-center rounded-lg bg-brand-50 text-brand-700">
                    <s.icon className="h-5 w-5" />
                  </span>
                  <p className="mt-3 text-xs text-muted">{s.label}</p>
                  <p className="font-semibold text-ink">{s.value}</p>
                </div>
              ))}
            </div>
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
