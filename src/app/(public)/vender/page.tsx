import type { Metadata } from "next";
import { BadgeCheck, Camera, Handshake, Megaphone } from "lucide-react";
import { LeadForm } from "@/components/public/lead-form";
import { WhatsAppButton } from "@/components/public/whatsapp-button";
import { siteConfig } from "@/lib/config/site";

export const metadata: Metadata = {
  title: "Vende tu inmueble",
  description:
    "Publica tu apartamento, casa o lote con CIC Inmuebles. Nos encargamos de fotos, visitas y negociación.",
};

const benefits = [
  { icon: Megaphone, title: "Mayor exposición", desc: "Publicamos tu inmueble en nuestro catálogo y canales digitales." },
  { icon: Camera, title: "Presentación profesional", desc: "Fotos, descripción y ficha optimizada para vender más rápido." },
  { icon: Handshake, title: "Gestión completa", desc: "Atendemos interesados, coordinamos visitas y acompañamos la negociación." },
  { icon: BadgeCheck, title: "Acompañamiento legal", desc: "Te guiamos en la promesa de compraventa y el cierre." },
];

export default function VenderPage() {
  return (
    <div className="mx-auto max-w-7xl px-4 py-12 sm:px-6 lg:px-8">
      <div className="grid gap-10 lg:grid-cols-2">
        <div>
          <span className="inline-flex items-center gap-2 rounded-full bg-brand-50 px-3 py-1 text-sm font-medium text-brand-700">
            Para propietarios
          </span>
          <h1 className="mt-4 text-4xl font-bold tracking-tight text-slate-900">
            Vende o arrienda tu inmueble sin complicaciones
          </h1>
          <p className="mt-4 text-lg text-slate-600">
            Déjanos los datos de tu inmueble y un asesor te contactará. Nosotros nos
            encargamos del resto para que vendas de forma rápida y segura.
          </p>

          <div className="mt-8 grid gap-4 sm:grid-cols-2">
            {benefits.map((b) => (
              <div key={b.title} className="rounded-xl border border-slate-200 bg-white p-5 shadow-sm">
                <span className="flex h-10 w-10 items-center justify-center rounded-lg bg-brand-50 text-brand-700">
                  <b.icon className="h-5 w-5" />
                </span>
                <h3 className="mt-3 font-semibold text-slate-900">{b.title}</h3>
                <p className="mt-1 text-sm text-slate-600">{b.desc}</p>
              </div>
            ))}
          </div>

          <div className="mt-8">
            <WhatsAppButton
              size="lg"
              message={`Hola ${siteConfig.name}, quiero vender/arrendar mi inmueble. ¿Me pueden ayudar?`}
              label="Prefiero hablar por WhatsApp"
            />
          </div>
        </div>

        <div className="lg:pl-6">
          <div className="rounded-2xl border border-slate-200 bg-white p-6 shadow-sm lg:sticky lg:top-20">
            <h2 className="text-xl font-bold text-slate-900">Cuéntanos sobre tu inmueble</h2>
            <p className="mt-1 text-sm text-slate-500">
              Solo necesitamos lo básico para contactarte. Toma menos de un minuto.
            </p>
            <div className="mt-5">
              <LeadForm tipo="vendedor" variant="vendedor" submitLabel="Quiero vender mi inmueble" />
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}
