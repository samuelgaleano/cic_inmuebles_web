import type { Metadata } from "next";
import { Mail, MapPin, Phone } from "lucide-react";
import { LeadForm } from "@/components/public/lead-form";
import { WhatsAppButton } from "@/components/public/whatsapp-button";
import { siteConfig } from "@/lib/config/site";

export const metadata: Metadata = {
  title: "Contacto",
  description: "Contáctanos. Resolvemos tus dudas sobre inmuebles, visitas y ventas.",
};

export default function ContactoPage() {
  return (
    <div className="mx-auto max-w-7xl px-4 py-12 sm:px-6 lg:px-8">
      <h1 className="text-4xl font-bold tracking-tight text-slate-900">Contáctanos</h1>
      <p className="mt-2 text-lg text-slate-600">
        Estamos para ayudarte. Escríbenos y te responderemos lo antes posible.
      </p>

      <div className="mt-10 grid gap-10 lg:grid-cols-2">
        <div className="space-y-4">
          <div className="flex items-start gap-3 rounded-xl border border-slate-200 bg-white p-5 shadow-sm">
            <span className="flex h-10 w-10 items-center justify-center rounded-lg bg-brand-50 text-brand-700">
              <Mail className="h-5 w-5" />
            </span>
            <div>
              <p className="font-semibold text-slate-900">Correo</p>
              <a href={`mailto:${siteConfig.email}`} className="text-sm text-brand-700 hover:underline">
                {siteConfig.email}
              </a>
            </div>
          </div>

          <div className="flex items-start gap-3 rounded-xl border border-slate-200 bg-white p-5 shadow-sm">
            <span className="flex h-10 w-10 items-center justify-center rounded-lg bg-brand-50 text-brand-700">
              <Phone className="h-5 w-5" />
            </span>
            <div>
              <p className="font-semibold text-slate-900">Teléfono</p>
              <p className="text-sm text-slate-600">{siteConfig.phoneDisplay}</p>
            </div>
          </div>

          <div className="flex items-start gap-3 rounded-xl border border-slate-200 bg-white p-5 shadow-sm">
            <span className="flex h-10 w-10 items-center justify-center rounded-lg bg-brand-50 text-brand-700">
              <MapPin className="h-5 w-5" />
            </span>
            <div>
              <p className="font-semibold text-slate-900">Cobertura</p>
              <p className="text-sm text-slate-600">{siteConfig.city}</p>
            </div>
          </div>

          <WhatsAppButton
            className="w-full"
            size="lg"
            message={`Hola ${siteConfig.name}, quiero más información.`}
            label="Escríbenos por WhatsApp"
          />
        </div>

        <div className="rounded-2xl border border-slate-200 bg-white p-6 shadow-sm">
          <h2 className="text-xl font-bold text-slate-900">Envíanos un mensaje</h2>
          <p className="mt-1 text-sm text-slate-500">Déjanos tus datos y te contactamos.</p>
          <div className="mt-5">
            <LeadForm tipo="comprador" intencion="info" submitLabel="Enviar mensaje" />
          </div>
        </div>
      </div>
    </div>
  );
}
