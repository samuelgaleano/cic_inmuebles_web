import type { Metadata } from "next";
import { ChevronDown } from "lucide-react";
import { LeadForm } from "@/components/public/lead-form";
import { WhatsAppButton } from "@/components/public/whatsapp-button";
import { JsonLd } from "@/components/seo/json-ld";
import { siteConfig } from "@/lib/config/site";

export const metadata: Metadata = {
  title: "Vende tu inmueble",
  description:
    "Publica tu apartamento o casa con CIC Inmuebles y véndelo de forma rápida y segura en toda Colombia. Nos encargamos de fotos, visitas y negociación.",
  alternates: { canonical: "/vender" },
  openGraph: {
    title: "Vende tu inmueble | CIC Inmuebles",
    description:
      "Sin costo inicial: nos encargamos de fotos, publicación, visitas y negociación, y solo cobramos una comisión del 3% cuando se cierra la venta.",
    url: `${siteConfig.url}/vender`,
    images: [siteConfig.ogImage],
  },
};

// Preguntas frecuentes reales del proceso. Formato pregunta-respuesta:
// cada respuesta es un pasaje autocontenible citable por buscadores e IAs.
const faqs = [
  {
    q: "¿Cómo publico mi inmueble con CIC Inmuebles?",
    a: "Déjanos los datos básicos en el formulario (toma menos de un minuto) o escríbenos por WhatsApp. Un asesor te contacta, visitamos y verificamos el inmueble, tomamos fotos profesionales y lo publicamos en nuestro portafolio.",
  },
  {
    q: "¿Qué hace CIC Inmuebles durante la venta?",
    a: "Nos encargamos de todo el proceso: presentación profesional del inmueble, publicación y promoción, atención de interesados, coordinación de visitas y acompañamiento en la negociación y la promesa de compraventa hasta el cierre.",
  },
  {
    q: "¿En qué ciudades venden inmuebles?",
    a: "Operamos en Colombia, con inventario principalmente en Bogotá y sus alrededores. Cuéntanos dónde está tu inmueble y te confirmamos enseguida si podemos gestionarlo.",
  },
  {
    q: "¿Trabajan con agentes inmobiliarios?",
    a: "Sí. Si eres agente y tienes un inmueble para vender, hacemos alianza: tú lo traes, nosotros lo promocionamos y gestionamos, y compartimos la comisión 50/50.",
  },
  {
    q: "¿Cómo los contacto?",
    a: `Por WhatsApp o llamada al ${siteConfig.phoneDisplay}, por correo a ${siteConfig.email}, o con el formulario de esta página. Respondemos directamente, sin intermediarios.`,
  },
];

const faqJsonLd = {
  "@context": "https://schema.org",
  "@type": "FAQPage",
  mainEntity: faqs.map((f) => ({
    "@type": "Question",
    name: f.q,
    acceptedAnswer: { "@type": "Answer", text: f.a },
  })),
};

const beneficios = [
  { t: "Mayor exposición", d: "Publicamos tu inmueble en nuestro catálogo y canales digitales." },
  { t: "Presentación profesional", d: "Fotos, descripción y ficha optimizada para vender más rápido." },
  { t: "Gestión completa", d: "Atendemos interesados, coordinamos visitas y acompañamos la negociación." },
  { t: "Acompañamiento legal", d: "Te guiamos en la promesa de compraventa y el cierre." },
];

export default function VenderPage() {
  return (
    <>
      <JsonLd data={faqJsonLd} />

      <header className="wrap pb-12 pt-14 sm:pb-16 sm:pt-20">
        <h1 className="t-display max-w-4xl">Vende tu inmueble sin complicaciones.</h1>
        <p className="t-lead mt-5 max-w-2xl">
          Déjanos los datos y un asesor te contactará. Nosotros nos encargamos del resto para que vendas de forma rápida y segura.
        </p>
      </header>

      {/*
        El formulario va primero en el DOM: en móvil aparece justo después del
        titular (antes quedaba al final de una página de 4.500 px). En escritorio
        se muestra a la derecha y se queda pegado solo si el viewport es lo
        bastante alto para verlo entero (en portátiles bajos fluye con la página).
      */}
      <div className="wrap grid grid-cols-[minmax(0,1fr)] gap-14 lg:grid-cols-[minmax(0,1fr)_28rem] lg:items-start lg:gap-20">
        <div className="lg:order-2">
          <div
            id="formulario"
            className="scroll-mt-24 rounded-[var(--radius-card)] border border-line bg-white p-6 sm:p-7 lg:top-24 lg:[@media(min-height:820px)]:sticky"
          >
            <h2 className="text-[1.375rem] font-semibold tracking-[-0.02em]">Cuéntanos sobre tu inmueble</h2>
            <p className="mt-1 text-[15px] text-muted">Solo necesitamos lo básico para contactarte. Toma menos de un minuto.</p>
            <div className="mt-6">
              <LeadForm tipo="vendedor" variant="vendedor" submitLabel="Quiero vender mi inmueble" />
            </div>
          </div>
        </div>

        <div className="min-w-0 space-y-20 lg:order-1">
          <section aria-labelledby="costo" className="rounded-[var(--radius-tile)] bg-surface p-8 sm:p-10">
            <h2 id="costo" className="t-title">Sin costo inicial.</h2>
            <p className="mt-4 max-w-xl text-[1.0625rem] leading-relaxed text-ink-soft">
              Nos convertimos en tu agencia inmobiliaria de cabecera: si quieres, tomamos fotos y videos de tu inmueble para darle más exposición y atraer más clientes. Solo cobramos una comisión del{" "}
              <strong className="font-semibold text-ink">3% cuando se cierra la venta</strong>.
            </p>
          </section>

          <section aria-labelledby="por-que">
            <h2 id="por-que" className="t-headline">Por qué vender con CIC</h2>
            <dl className="mt-10">
              {beneficios.map((b) => (
                <div key={b.t} className="grid gap-x-8 gap-y-1 border-t border-line py-6 sm:grid-cols-[14rem_1fr]">
                  <dt className="text-[1.0625rem] font-semibold tracking-[-0.01em]">{b.t}</dt>
                  <dd className="text-muted">{b.d}</dd>
                </div>
              ))}
            </dl>
            <WhatsAppButton
              size="lg"
              className="mt-8"
              message={`Hola ${siteConfig.name}, quiero vender mi inmueble. ¿Me pueden ayudar?`}
              label="Prefiero hablar por WhatsApp"
            />
          </section>

          <section aria-labelledby="faq-title">
            <h2 id="faq-title" className="t-headline">Preguntas frecuentes</h2>
            <div className="mt-10 border-b border-line">
              {faqs.map((f) => (
                <details key={f.q} className="group border-t border-line">
                  <summary className="flex cursor-pointer list-none items-center justify-between gap-6 py-5 text-[1.0625rem] font-medium tracking-[-0.01em] [&::-webkit-details-marker]:hidden">
                    {f.q}
                    <ChevronDown className="h-5 w-5 shrink-0 text-muted transition-transform duration-300 group-open:rotate-180" aria-hidden />
                  </summary>
                  <p className="max-w-2xl pb-6 leading-relaxed text-muted">{f.a}</p>
                </details>
              ))}
            </div>
          </section>
        </div>
      </div>
      <div className="h-28" />
    </>
  );
}
