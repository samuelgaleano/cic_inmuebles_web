import type { Metadata } from "next";
import Link from "next/link";
import { ArrowRight, Building2, Home as HomeIcon, Handshake } from "lucide-react";
import { JsonLd } from "@/components/seo/json-ld";
import { siteConfig } from "@/lib/config/site";

export const metadata: Metadata = {
  title: "Publica tu inmueble · Trabaja con nosotros",
  description:
    "Publica, promociona o vende tu inmueble con CIC Inmuebles. Alternativas para propietarios y para agentes e inmobiliarias, con comisión compartida y planes de publicación.",
  alternates: { canonical: "/publica" },
};

const opciones = [
  {
    href: "/vender",
    icon: HomeIcon,
    tag: "Soy propietario",
    titulo: "Quiero vender mi inmueble",
    desc: "Sé tu agencia de cabecera sin costo inicial. Promocionamos tu propiedad, atendemos a los interesados y solo cobramos comisión cuando se cierra la venta.",
    resaltar: "Sin mensualidad · 3% solo al cerrar",
  },
  {
    href: "/publica/agente",
    icon: Building2,
    tag: "Soy agente o inmobiliaria",
    titulo: "Quiero publicar mis inmuebles",
    desc: "Publica tus propiedades en la vitrina de CIC. Elige entre alianza por resultados, publicación independiente o paquetes de varios inmuebles.",
    resaltar: "Desde $10.000 · pago en línea",
  },
];

export default function PublicaPage() {
  const jsonLd = {
    "@context": "https://schema.org",
    "@type": "BreadcrumbList",
    itemListElement: [
      { "@type": "ListItem", position: 1, name: "Inicio", item: siteConfig.url },
      { "@type": "ListItem", position: 2, name: "Publica tu inmueble", item: `${siteConfig.url}/publica` },
    ],
  };

  return (
    <div className="mx-auto max-w-5xl px-4 py-14 sm:px-6 lg:px-8 lg:py-20">
      <JsonLd data={jsonLd} />

      <div className="mx-auto max-w-2xl text-center">
        <span className="inline-flex items-center gap-2 rounded-full bg-brand-50 px-3.5 py-1.5 text-xs font-semibold uppercase tracking-[0.16em] text-brand-700">
          <Handshake className="h-3.5 w-3.5" /> Trabaja con nosotros
        </span>
        <h1 className="mt-5 text-4xl font-bold tracking-tight text-ink sm:text-5xl">
          Publica, promociona o vende tu inmueble con CIC
        </h1>
        <p className="mt-4 text-lg leading-relaxed text-muted">
          Tenemos una alternativa para cada caso. Cuéntanos quién eres y te mostramos
          la modalidad que mejor se adapta a ti.
        </p>
      </div>

      <div className="mt-12 grid gap-5 sm:grid-cols-2">
        {opciones.map((o) => (
          <Link
            key={o.href}
            href={o.href}
            className="group relative flex flex-col rounded-[1.6rem] border border-line bg-white p-7 transition-all duration-500 ease-[cubic-bezier(0.16,1,0.3,1)] hover:-translate-y-1 hover:border-brand-200 hover:shadow-[0_28px_50px_-28px_rgba(11,26,21,0.3)]"
          >
            <span className="flex h-12 w-12 items-center justify-center rounded-2xl bg-brand-600 text-white shadow-[0_10px_24px_-12px_rgba(7,162,118,0.7)] transition-transform duration-500 group-hover:scale-105">
              <o.icon className="h-6 w-6" />
            </span>
            <p className="mt-5 text-xs font-semibold uppercase tracking-[0.16em] text-brand-600">{o.tag}</p>
            <h2 className="mt-1.5 text-xl font-bold tracking-tight text-ink">{o.titulo}</h2>
            <p className="mt-2 flex-1 text-sm leading-relaxed text-muted">{o.desc}</p>
            <div className="mt-5 flex items-center justify-between">
              <span className="rounded-full bg-surface px-3 py-1 text-xs font-semibold text-ink-soft">{o.resaltar}</span>
              <span className="flex items-center gap-1 text-sm font-semibold text-brand-700 transition-all group-hover:gap-2">
                Ver <ArrowRight className="h-4 w-4" />
              </span>
            </div>
          </Link>
        ))}
      </div>
    </div>
  );
}
