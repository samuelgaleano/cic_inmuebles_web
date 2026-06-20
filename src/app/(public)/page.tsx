import Link from "next/link";
import {
  ArrowRight,
  CalendarCheck,
  Home as HomeIcon,
  ShieldCheck,
  Sparkles,
  TrendingUp,
} from "lucide-react";
import { buttonVariants } from "@/components/ui/button";
import { PropertyGrid } from "@/components/public/property-grid";
import { WhatsAppButton } from "@/components/public/whatsapp-button";
import { getRepository } from "@/lib/data";
import { siteConfig } from "@/lib/config/site";

export default async function HomePage() {
  const repo = getRepository();
  const destacados = (await repo.properties.listPublic({ destacado: true })).slice(0, 3);
  const recientes = (await repo.properties.listPublic()).slice(0, 6);

  return (
    <>
      {/* Hero */}
      <section className="relative overflow-hidden bg-brand-950 text-white">
        <div
          className="absolute inset-0 opacity-25"
          style={{
            backgroundImage:
              "url('https://images.unsplash.com/photo-1560518883-ce09059eeffa?auto=format&fit=crop&w=2000&q=70')",
            backgroundSize: "cover",
            backgroundPosition: "center",
          }}
        />
        <div className="absolute inset-0 bg-gradient-to-r from-brand-950 via-brand-950/90 to-brand-900/60" />
        <div className="relative mx-auto max-w-7xl px-4 py-20 sm:px-6 lg:px-8 lg:py-28">
          <span className="inline-flex items-center gap-2 rounded-full bg-white/10 px-3 py-1 text-sm font-medium text-accent-400">
            <Sparkles className="h-4 w-4" /> Inmobiliaria CIC
          </span>
          <h1 className="mt-4 max-w-2xl text-4xl font-bold leading-tight tracking-tight sm:text-5xl">
            {siteConfig.tagline}
          </h1>
          <p className="mt-4 max-w-xl text-lg text-slate-200">
            Explora nuestro catálogo de apartamentos y casas, agenda una visita en segundos y
            recibe acompañamiento en cada paso.
          </p>

          {/* Búsqueda rápida */}
          <form action="/inmuebles" className="mt-8 flex max-w-xl gap-2">
            <input
              name="q"
              placeholder="¿Dónde quieres vivir? Ciudad, barrio..."
              className="h-12 flex-1 rounded-lg border-0 px-4 text-slate-900 placeholder:text-slate-400 focus:outline-none focus:ring-2 focus:ring-accent-400"
            />
            <button
              type="submit"
              className={buttonVariants({ variant: "accent", size: "lg" })}
            >
              Buscar
            </button>
          </form>

          <div className="mt-6 flex flex-wrap gap-3">
            <Link href="/inmuebles" className={buttonVariants({ variant: "primary", size: "lg" })}>
              Ver todos los inmuebles <ArrowRight className="h-4 w-4" />
            </Link>
            <Link
              href="/vender"
              className={buttonVariants({
                variant: "outline",
                size: "lg",
                className: "border-white/30 bg-white/5 text-white hover:bg-white/10",
              })}
            >
              Vende tu inmueble
            </Link>
          </div>
        </div>
      </section>

      {/* Propuesta de valor */}
      <section className="mx-auto max-w-7xl px-4 py-14 sm:px-6 lg:px-8">
        <div className="grid gap-6 sm:grid-cols-3">
          {[
            { icon: ShieldCheck, title: "Inmuebles verificados", desc: "Cada propiedad con información detallada y estado actualizado." },
            { icon: CalendarCheck, title: "Agenda fácil", desc: "Solicita una visita en segundos, sin trámites complicados." },
            { icon: TrendingUp, title: "Vende sin estrés", desc: "Publicamos y gestionamos tu inmueble por ti." },
          ].map((f) => (
            <div key={f.title} className="rounded-xl border border-slate-200 bg-white p-6 shadow-sm">
              <span className="flex h-11 w-11 items-center justify-center rounded-lg bg-brand-50 text-brand-700">
                <f.icon className="h-6 w-6" />
              </span>
              <h3 className="mt-4 font-semibold text-slate-900">{f.title}</h3>
              <p className="mt-1 text-sm text-slate-600">{f.desc}</p>
            </div>
          ))}
        </div>
      </section>

      {/* Destacados */}
      {destacados.length > 0 && (
        <section className="mx-auto max-w-7xl px-4 pb-6 sm:px-6 lg:px-8">
          <div className="flex items-end justify-between">
            <div>
              <h2 className="text-2xl font-bold tracking-tight text-slate-900">Destacados</h2>
              <p className="text-slate-600">Una selección de nuestros mejores inmuebles.</p>
            </div>
            <Link href="/inmuebles" className="hidden text-sm font-medium text-brand-700 hover:underline sm:block">
              Ver todos
            </Link>
          </div>
          <div className="mt-6">
            <PropertyGrid properties={destacados} />
          </div>
        </section>
      )}

      {/* Recientes */}
      <section className="mx-auto max-w-7xl px-4 py-10 sm:px-6 lg:px-8">
        <div className="flex items-end justify-between">
          <h2 className="text-2xl font-bold tracking-tight text-slate-900">Inmuebles disponibles</h2>
          <Link href="/inmuebles" className="text-sm font-medium text-brand-700 hover:underline">
            Ver catálogo completo
          </Link>
        </div>
        <div className="mt-6">
          <PropertyGrid properties={recientes} />
        </div>
      </section>

      {/* CTA Vendedores */}
      <section className="bg-brand-900 text-white">
        <div className="mx-auto grid max-w-7xl items-center gap-6 px-4 py-14 sm:px-6 lg:grid-cols-2 lg:px-8">
          <div>
            <span className="inline-flex items-center gap-2 rounded-full bg-white/10 px-3 py-1 text-sm font-medium text-accent-400">
              <HomeIcon className="h-4 w-4" /> Para propietarios
            </span>
            <h2 className="mt-3 text-3xl font-bold tracking-tight">
              ¿Tienes un inmueble que quieres vender o arrendar?
            </h2>
            <p className="mt-3 max-w-lg text-slate-200">
              Nosotros nos encargamos de todo: publicación, fotos, visitas y negociación.
              Déjanos tus datos y te contactamos.
            </p>
          </div>
          <div className="flex flex-col gap-3 sm:flex-row lg:justify-end">
            <Link href="/vender" className={buttonVariants({ variant: "accent", size: "lg" })}>
              Publicar mi inmueble <ArrowRight className="h-4 w-4" />
            </Link>
            <WhatsAppButton
              size="lg"
              message={`Hola ${siteConfig.name}, tengo un inmueble que quiero vender/arrendar y me gustaría más información.`}
              label="Hablar por WhatsApp"
            />
          </div>
        </div>
      </section>
    </>
  );
}
