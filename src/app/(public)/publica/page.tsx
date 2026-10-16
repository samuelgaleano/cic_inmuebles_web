import type { Metadata } from "next";
import Link from "next/link";
import { ArrowRight, Check } from "lucide-react";
import { BrandMark } from "@/components/brand/brand-mark";
import { JsonLd } from "@/components/seo/json-ld";
import { PLANS } from "@/lib/config/plans";
import { siteConfig } from "@/lib/config/site";
import { cn } from "@/lib/utils/cn";
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
    cifra: "3 %",
    cifraTexto: "solo cuando se cierra la venta",
    puntos: ["Sin mensualidad", "Sin costo inicial", "Atendemos a los interesados"],
    cta: "Quiero vender",
    fondo: "bg-brand-700 text-white",
    marca: "text-white/[0.09]",
    cifraColor: "text-white",
    etiqueta: "bg-white/15 text-white",
    boton: "bg-white text-ink group-hover:bg-brand-50",
  },
  {
    href: "/publica/agente",
    para: "Soy agente o inmobiliaria",
    titulo: "Quiero publicar mis inmuebles",
    desc: "Publica tus propiedades en la vitrina de CIC. Elige entre alianza por resultados, publicación independiente o paquetes de varios inmuebles.",
    cifra: formatPrice(desdeCOP),
    cifraTexto: "desde, con pago en línea",
    puntos: ["Alianza por resultados", "Publicación independiente", "Paquetes de varios inmuebles"],
    cta: "Ver los planes",
    fondo: "bg-ink text-white",
    marca: "text-brand-500/[0.16]",
    cifraColor: "text-brand-400",
    etiqueta: "bg-brand-500 text-ink",
    boton: "bg-brand-500 text-ink group-hover:bg-brand-400",
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

      <header className="wrap pb-10 pt-12 sm:pb-14 sm:pt-20">
        <h1 className="t-hero max-w-3xl">Publica, promociona o vende tu inmueble con CIC.</h1>
        <p className="t-lead mt-5 max-w-2xl">
          Tenemos una alternativa para cada caso. Cuéntanos quién eres y te mostramos la modalidad que mejor se adapta a ti.
        </p>
      </header>

      <div className="wrap grid gap-5 pb-24 md:grid-cols-2 md:gap-6">
        {opciones.map((o) => (
          <Link
            key={o.href}
            href={o.href}
            className={cn(
              "group relative flex min-h-[32rem] flex-col overflow-hidden rounded-[var(--radius-tile)] p-7 transition-transform duration-500 ease-[var(--ease-fluid)] hover:-translate-y-1.5 sm:p-10",
              o.fondo,
            )}
          >
            <BrandMark
              decorativo
              className={cn(
                "pointer-events-none absolute -bottom-16 -right-16 h-[26rem] w-[26rem] transition-transform duration-700 ease-[var(--ease-fluid)] group-hover:scale-110 group-hover:-rotate-3",
                o.marca,
              )}
            />

            <p className={cn("relative w-fit rounded-full px-4 py-1.5 text-[14px] font-medium", o.etiqueta)}>{o.para}</p>
            <h2 className="t-headline relative mt-6 max-w-md">{o.titulo}</h2>
            <p className="relative mt-4 max-w-md leading-relaxed text-white/80">{o.desc}</p>

            <div className="relative mt-8">
              <p className={cn("tnum font-display text-[3.5rem] font-medium leading-none tracking-[-0.03em] sm:text-[4.5rem]", o.cifraColor)}>
                {o.cifra}
              </p>
              <p className="mt-2 text-[15px] text-white/80">{o.cifraTexto}</p>
            </div>

            <ul className="relative mt-6 flex flex-col gap-2 text-[15px] text-white/90">
              {o.puntos.map((t) => (
                <li key={t} className="flex items-center gap-2.5">
                  <Check className="h-4 w-4 shrink-0 text-brand-400" aria-hidden />
                  {t}
                </li>
              ))}
            </ul>

            <span
              className={cn(
                "relative mt-auto inline-flex h-[52px] w-fit items-center gap-2 rounded-full px-7 pt-0 text-base font-medium transition-colors duration-200",
                o.boton,
              )}
            >
              {o.cta}
              <ArrowRight className="h-4 w-4 transition-transform duration-300 group-hover:translate-x-1" aria-hidden />
            </span>
          </Link>
        ))}
      </div>
    </>
  );
}
