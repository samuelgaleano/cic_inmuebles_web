import type { Metadata } from "next";
import { Mail, MapPin, Phone } from "lucide-react";
import { LeadForm } from "@/components/public/lead-form";
import { WhatsAppButton } from "@/components/public/whatsapp-button";
import { siteConfig } from "@/lib/config/site";

export const metadata: Metadata = {
  title: "Contacto",
  description: "Contáctanos. Resolvemos tus dudas sobre inmuebles, visitas y ventas.",
};

const channels = [
  { icon: Mail, label: "Correo", value: siteConfig.email, href: `mailto:${siteConfig.email}` },
  { icon: Phone, label: "Teléfono", value: siteConfig.phoneDisplay, href: `tel:${siteConfig.phone}` },
  { icon: MapPin, label: "Cobertura", value: siteConfig.city },
];

export default function ContactoPage() {
  return (
    <div className="mx-auto max-w-6xl px-4 py-12 sm:px-6 lg:px-8 lg:py-16">
      <p className="text-xs font-semibold uppercase tracking-[0.2em] text-brand-600">Contacto</p>
      <h1 className="mt-2 text-4xl font-bold tracking-tight text-ink sm:text-5xl">Hablemos</h1>
      <p className="mt-3 max-w-xl text-lg leading-relaxed text-muted">
        Estamos para ayudarte. Escríbenos y te responderemos lo antes posible.
      </p>

      <div className="mt-10 grid gap-8 lg:grid-cols-2">
        <div className="space-y-4">
          {channels.map((ch) => (
            <div
              key={ch.label}
              className="flex items-start gap-4 rounded-2xl border border-line bg-white p-5 transition-colors hover:border-brand-200"
            >
              <span className="flex h-11 w-11 shrink-0 items-center justify-center rounded-xl bg-brand-50 text-brand-700">
                <ch.icon className="h-5 w-5" />
              </span>
              <div>
                <p className="font-semibold text-ink">{ch.label}</p>
                {ch.href ? (
                  <a href={ch.href} className="text-sm font-medium text-brand-700 hover:underline">
                    {ch.value}
                  </a>
                ) : (
                  <p className="text-sm text-muted">{ch.value}</p>
                )}
              </div>
            </div>
          ))}

          <WhatsAppButton
            className="w-full"
            size="lg"
            message={`Hola ${siteConfig.name}, quiero más información.`}
            label="Escríbenos por WhatsApp"
          />
        </div>

        <div className="rounded-[1.6rem] border border-line bg-white p-6 shadow-[0_20px_50px_-30px_rgba(11,26,21,0.4)] sm:p-7">
          <h2 className="text-xl font-bold tracking-tight text-ink">Envíanos un mensaje</h2>
          <p className="mt-1 text-sm text-muted">Déjanos tus datos y te contactamos.</p>
          <div className="mt-5">
            <LeadForm tipo="comprador" intencion="info" submitLabel="Enviar mensaje" />
          </div>
        </div>
      </div>
    </div>
  );
}
