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
    <div className="mx-auto max-w-6xl px-4 py-12 sm:px-6 lg:px-8 lg:py-16">
      <div className="grid gap-10 lg:grid-cols-2">
        <div>
          <span className="inline-flex items-center gap-2 rounded-full bg-brand-50 px-3.5 py-1.5 text-xs font-semibold uppercase tracking-[0.16em] text-brand-700">
            Para propietarios
          </span>
          <h1 className="mt-5 text-4xl font-bold tracking-tight text-ink sm:text-5xl">
            Vende o arrienda sin complicaciones
          </h1>
          <p className="mt-4 text-lg leading-relaxed text-muted">
            Déjanos los datos de tu inmueble y un asesor te contactará. Nosotros nos
            encargamos del resto para que vendas de forma rápida y segura.
          </p>

          <div className="mt-8 grid gap-4 sm:grid-cols-2">
            {benefits.map((b) => (
              <div
                key={b.title}
                className="group rounded-2xl border border-line bg-white p-5 transition-all duration-500 ease-[cubic-bezier(0.16,1,0.3,1)] hover:-translate-y-1 hover:shadow-[0_24px_44px_-28px_rgba(11,26,21,0.3)]"
              >
                <span className="flex h-11 w-11 items-center justify-center rounded-xl bg-brand-600 text-white shadow-[0_10px_24px_-12px_rgba(7,162,118,0.7)]">
                  <b.icon className="h-5 w-5" />
                </span>
                <h3 className="mt-4 font-bold text-ink">{b.title}</h3>
                <p className="mt-1 text-sm leading-relaxed text-muted">{b.desc}</p>
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
          <div className="rounded-[1.6rem] border border-line bg-white p-6 shadow-[0_20px_50px_-30px_rgba(11,26,21,0.4)] lg:sticky lg:top-24 sm:p-7">
            <h2 className="text-xl font-bold tracking-tight text-ink">Cuéntanos sobre tu inmueble</h2>
            <p className="mt-1 text-sm text-muted">
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
