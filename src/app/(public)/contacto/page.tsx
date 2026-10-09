import type { Metadata } from "next";
import { LeadForm } from "@/components/public/lead-form";
import { WhatsAppButton } from "@/components/public/whatsapp-button";
import { siteConfig } from "@/lib/config/site";

export const metadata: Metadata = {
  title: "Contacto",
  description:
    "Contáctanos. Resolvemos tus dudas sobre inmuebles en venta, visitas y alianzas con agentes inmobiliarios.",
  alternates: { canonical: "/contacto" },
  openGraph: {
    title: "Contacto | CIC Inmuebles",
    description: "Resolvemos tus dudas sobre inmuebles en venta, visitas y alianzas con agentes inmobiliarios.",
    url: `${siteConfig.url}/contacto`,
    images: [siteConfig.ogImage],
  },
};

const canales = [
  { etiqueta: "Correo", valor: siteConfig.email, href: `mailto:${siteConfig.email}` },
  { etiqueta: "Teléfono", valor: siteConfig.phoneDisplay, href: `tel:${siteConfig.phone}` },
  { etiqueta: "Cobertura", valor: siteConfig.city },
];

export default function ContactoPage() {
  return (
    <>
      <header className="wrap pb-12 pt-14 sm:pb-16 sm:pt-20">
        <h1 className="t-display max-w-4xl">Hablemos.</h1>
        <p className="t-lead mt-5 max-w-2xl">Estamos para ayudarte. Escríbenos y te responderemos lo antes posible.</p>
      </header>

      <div className="wrap grid gap-14 lg:grid-cols-2 lg:gap-24">
        <div>
          <dl>
            {canales.map((c) => (
              <div key={c.etiqueta} className="grid gap-x-6 border-t border-line py-5 sm:grid-cols-[9rem_1fr]">
                <dt className="text-[15px] text-muted">{c.etiqueta}</dt>
                <dd className="tnum text-[1.125rem] font-medium tracking-[-0.01em]">
                  {c.href ? (
                    <a href={c.href} className="transition-colors hover:text-brand-700">
                      {c.valor}
                    </a>
                  ) : (
                    c.valor
                  )}
                </dd>
              </div>
            ))}
          </dl>
          <WhatsAppButton
            className="mt-8"
            size="lg"
            message={`Hola ${siteConfig.name}, quiero más información.`}
            label="Escríbenos por WhatsApp"
          />
        </div>

        <div className="rounded-[var(--radius-card)] border border-line bg-white p-6 sm:p-7">
          <h2 className="text-[1.375rem] font-semibold tracking-[-0.02em]">Envíanos un mensaje</h2>
          <p className="mt-1 text-[15px] text-muted">Déjanos tus datos y te contactamos.</p>
          <div className="mt-6">
            <LeadForm tipo="comprador" intencion="info" submitLabel="Enviar mensaje" />
          </div>
        </div>
      </div>
      <div className="h-28" />
    </>
  );
}
