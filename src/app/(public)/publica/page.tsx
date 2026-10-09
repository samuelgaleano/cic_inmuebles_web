import type { Metadata } from "next";
import Link from "next/link";
import { ArrowRight } from "lucide-react";
import { JsonLd } from "@/components/seo/json-ld";
import { PLANS } from "@/lib/config/plans";
import { siteConfig } from "@/lib/config/site";
import { formatPrice } from "@/lib/utils/format";

// Derivado del catálogo: si cambia la tarifa mínima, cambia aquí solo.
const desdeCOP = Math.min(
  ...PLANS.filter((p) => p.audience === "agente" && p.mode === "pago").map((p) => p.precioCOP),
);

export const metadata: Metadata = {
  title: "Publica tu inmueble · Trabaja con nosotros",
  description:
    "Publica, promociona o vende tu inmueble con CIC Inmuebles. Alternativas para propietarios y para agentes e inmobiliarias, con comisión compartida y planes de publicación.",
  alternates: { canonical: "/publica" },
  openGraph: {
    title: "Publica tu inmueble | CIC Inmuebles",
    description:
      "Alternativas para propietarios y para agentes e inmobiliarias, con comisión compartida y planes de publicación.",
    url: `${siteConfig.url}/publica`,
    images: [siteConfig.ogImage],
  },
};

const opciones = [
  {
    href: "/vender",
    para: "Soy propietario",
    titulo: "Quiero vender mi inmueble",
    desc: "Sé tu agencia de cabecera sin costo inicial. Promocionamos tu propiedad, atendemos a los interesados y solo cobramos comisión cuando se cierra la venta.",
    resaltar: "Sin mensualidad · 3% solo al cerrar",
  },
  {
    href: "/publica/agente",
    para: "Soy agente o inmobiliaria",
    titulo: "Quiero publicar mis inmuebles",
    desc: "Publica tus propiedades en la vitrina de CIC. Elige entre alianza por resultados, publicación independiente o paquetes de varios inmuebles.",
    resaltar: `Desde ${formatPrice(desdeCOP)} · pago en línea`,
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
    <>
      <JsonLd data={jsonLd} />

      <header className="wrap pb-12 pt-14 sm:pb-16 sm:pt-20">
        <h1 className="t-display max-w-4xl">Publica, promociona o vende tu inmueble con CIC.</h1>
        <p className="t-lead mt-5 max-w-2xl">
          Tenemos una alternativa para cada caso. Cuéntanos quién eres y te mostramos la modalidad que mejor se adapta a ti.
        </p>
      </header>

      <div className="wrap grid gap-5 pb-28 md:grid-cols-2">
        {opciones.map((o) => (
          <Link
            key={o.href}
            href={o.href}
            className="group flex min-h-[22rem] flex-col rounded-[var(--radius-tile)] bg-surface p-8 transition-colors duration-300 hover:bg-brand-50 sm:p-10"
          >
            <p className="text-[15px] text-muted">{o.para}</p>
            <h2 className="t-headline mt-3 max-w-md">{o.titulo}</h2>
            <p className="mt-5 max-w-md flex-1 leading-relaxed text-ink-soft">{o.desc}</p>
            <div className="mt-8 flex items-center justify-between gap-4 border-t border-line-strong/60 pt-5">
              <span className="text-[15px] font-medium">{o.resaltar}</span>
              <span className="flex h-11 w-11 shrink-0 items-center justify-center rounded-full bg-ink text-white transition-transform duration-300 group-hover:translate-x-1">
                <ArrowRight className="h-5 w-5" aria-hidden />
              </span>
            </div>
          </Link>
        ))}
      </div>
    </>
  );
}
