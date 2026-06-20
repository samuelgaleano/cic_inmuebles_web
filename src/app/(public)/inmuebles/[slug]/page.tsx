import type { Metadata } from "next";
import Link from "next/link";
import { notFound } from "next/navigation";
import {
  ArrowLeft,
  Bath,
  BedDouble,
  Building,
  CalendarClock,
  Car,
  Layers,
  MapPin,
  Maximize,
  Receipt,
} from "lucide-react";
import { PropertyGallery } from "@/components/public/property-gallery";
import { PropertyContactCard } from "@/components/public/property-contact-card";
import { StatusBadge } from "@/components/ui/status-badge";
import { getRepository } from "@/lib/data";
import {
  OPERATION_LABELS,
  PROPERTY_TYPE_LABELS,
  type PropertyMedia,
} from "@/lib/domain";
import { formatArea, formatPrice } from "@/lib/utils/format";
import { siteConfig } from "@/lib/config/site";

export async function generateStaticParams() {
  const properties = await getRepository().properties.listPublic();
  return properties.map((p) => ({ slug: p.slug }));
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
    description: property.descripcionCorta,
    openGraph: {
      title: property.titulo,
      description: property.descripcionCorta,
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
    c.areaConstruida != null && { icon: Maximize, label: "Área construida", value: formatArea(c.areaConstruida) },
    c.areaTotal != null && { icon: Maximize, label: "Área total", value: formatArea(c.areaTotal) },
    c.parqueaderos != null && { icon: Car, label: "Parqueaderos", value: String(c.parqueaderos) },
    c.estrato != null && { icon: Layers, label: "Estrato", value: String(c.estrato) },
    c.piso != null && { icon: Building, label: "Piso", value: String(c.piso) },
    c.antiguedadAnios != null && { icon: CalendarClock, label: "Antigüedad", value: `${c.antiguedadAnios} años` },
    c.administracion != null && { icon: Receipt, label: "Administración", value: formatPrice(c.administracion, property.moneda) },
  ].filter(Boolean) as { icon: typeof BedDouble; label: string; value: string }[];

  const whatsappMessage = `Hola ${siteConfig.name}, me interesa el inmueble "${property.titulo}" (${property.codigo}). ${siteConfig.url}/inmuebles/${property.slug}`;

  return (
    <div className="mx-auto max-w-7xl px-4 py-8 sm:px-6 lg:px-8">
      <Link
        href="/inmuebles"
        className="inline-flex items-center gap-1 text-sm font-medium text-slate-500 hover:text-brand-700"
      >
        <ArrowLeft className="h-4 w-4" /> Volver al catálogo
      </Link>

      <div className="mt-4 grid gap-8 lg:grid-cols-3">
        {/* Columna principal */}
        <div className="lg:col-span-2">
          <PropertyGallery images={images} title={property.titulo} />

          {videoId && (
            <div className="mt-6 aspect-video overflow-hidden rounded-xl">
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
                <span className="rounded-full bg-slate-100 px-2.5 py-1 text-xs font-semibold text-slate-700">
                  {OPERATION_LABELS[property.operacion]}
                </span>
                <StatusBadge status={property.estado} />
                <span className="text-xs text-slate-400">Cód. {property.codigo}</span>
              </div>
              <h1 className="mt-3 text-2xl font-bold tracking-tight text-slate-900 sm:text-3xl">
                {property.titulo}
              </h1>
              <p className="mt-1 flex items-center gap-1 text-slate-600">
                <MapPin className="h-4 w-4" />
                {ubicacion.barrio ? `${ubicacion.barrio}, ` : ""}
                {ubicacion.ciudad}, {ubicacion.departamento}
              </p>
            </div>
          </div>

          {/* Especificaciones */}
          <div className="mt-6 grid grid-cols-2 gap-3 sm:grid-cols-3">
            {specs.map((s) => (
              <div key={s.label} className="rounded-lg border border-slate-200 bg-white p-3">
                <s.icon className="h-5 w-5 text-brand-600" />
                <p className="mt-2 text-xs text-slate-500">{s.label}</p>
                <p className="font-semibold text-slate-900">{s.value}</p>
              </div>
            ))}
          </div>

          {/* Descripción */}
          <section className="mt-8">
            <h2 className="text-xl font-bold text-slate-900">Descripción</h2>
            <p className="mt-3 whitespace-pre-line leading-relaxed text-slate-700">
              {property.descripcion}
            </p>
          </section>

          {/* Amenidades */}
          {property.amenidades.length > 0 && (
            <section className="mt-8">
              <h2 className="text-xl font-bold text-slate-900">Amenidades</h2>
              <ul className="mt-3 flex flex-wrap gap-2">
                {property.amenidades.map((a) => (
                  <li
                    key={a}
                    className="rounded-full border border-slate-200 bg-slate-50 px-3 py-1 text-sm text-slate-700"
                  >
                    {a}
                  </li>
                ))}
              </ul>
            </section>
          )}
        </div>

        {/* Barra lateral */}
        <aside className="lg:col-span-1">
          <div className="lg:sticky lg:top-20 space-y-4">
            <div className="rounded-2xl border border-slate-200 bg-white p-5 shadow-sm">
              <p className="text-sm text-slate-500">Precio</p>
              <p className="text-3xl font-bold text-brand-900">
                {formatPrice(property.precio, property.moneda)}
                {property.operacion === "arriendo" && (
                  <span className="text-base font-normal text-slate-500">/mes</span>
                )}
              </p>
              {property.estado === "vendido" && (
                <p className="mt-2 text-sm font-medium text-rose-600">
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
