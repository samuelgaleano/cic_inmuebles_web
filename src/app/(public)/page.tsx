import Link from "next/link";
import {
  ArrowRight,
  ArrowUpRight,
  CalendarCheck,
  Home as HomeIcon,
  KeyRound,
  MapPinned,
  Search,
  ShieldCheck,
  Sparkles,
  TrendingUp,
} from "lucide-react";
import { buttonVariants } from "@/components/ui/button";
import { BrandMark } from "@/components/brand/brand-mark";
import { Reveal } from "@/components/ui/reveal";
import { PropertyGrid } from "@/components/public/property-grid";
import { WhatsAppButton } from "@/components/public/whatsapp-button";
import { getRepository } from "@/lib/data";
import {
  OPERATIONS,
  OPERATION_LABELS,
  PROPERTY_TYPES,
  PROPERTY_TYPE_LABELS,
} from "@/lib/domain";
import { siteConfig } from "@/lib/config/site";

export default async function HomePage() {
  const repo = getRepository();
  let destacados: Awaited<ReturnType<typeof repo.properties.listPublic>> = [];
  let recientes: typeof destacados = [];
  let total = 0;
  let ciudades = 0;
  try {
    const [dest, todos] = await Promise.all([
      repo.properties.listPublic({ destacado: true }),
      repo.properties.listPublic(),
    ]);
    destacados = dest.slice(0, 3);
    recientes = todos.slice(0, 6);
    total = todos.length;
    ciudades = new Set(todos.map((p) => p.ubicacion.ciudad)).size;
  } catch (err) {
    console.error("[home] no se pudo cargar el catálogo:", err);
  }

  const stats = [
    { value: total > 0 ? `${total}+` : "—", label: "Inmuebles en catálogo" },
    { value: ciudades > 0 ? `${ciudades}` : "—", label: ciudades === 1 ? "Ciudad" : "Ciudades" },
    { value: "24h", label: "Respuesta promedio" },
    { value: "100%", label: "Acompañamiento" },
  ];

  return (
    <>
      {/* ───────────────────────── Hero ───────────────────────── */}
      <section className="relative -mt-[4.5rem] overflow-hidden bg-ink pt-[4.5rem] text-white">
        <div
          className="absolute inset-0 opacity-20"
          style={{
            backgroundImage:
              "url('https://images.unsplash.com/photo-1600585154340-be6161a56a0c?auto=format&fit=crop&w=2000&q=70')",
            backgroundSize: "cover",
            backgroundPosition: "center",
          }}
        />
        <div className="absolute inset-0 bg-gradient-to-br from-ink via-ink/95 to-brand-950/80" />
        <div className="absolute inset-0 bg-aurora" />
        <div className="pointer-events-none absolute inset-0 bg-grain opacity-[0.04]" />

        {/* Bloques flotantes (eco del logo) */}
        <BrandMark className="animate-float pointer-events-none absolute right-[6%] top-24 hidden h-44 w-44 text-brand-500/25 lg:block" />

        <div className="relative mx-auto max-w-6xl px-4 py-20 sm:px-6 lg:px-8 lg:py-28">
          <span className="animate-rise inline-flex items-center gap-2 rounded-full border border-white/15 bg-white/5 px-3.5 py-1.5 text-xs font-semibold uppercase tracking-[0.18em] text-brand-300 backdrop-blur">
            <Sparkles className="h-3.5 w-3.5" /> Finca raíz en {siteConfig.city}
          </span>

          <h1
            className="animate-rise text-balance mt-6 max-w-3xl text-4xl font-extrabold leading-[1.05] tracking-tight sm:text-5xl lg:text-6xl"
            style={{ animationDelay: "80ms" }}
          >
            Tu próximo <span className="text-brand-400">hogar</span>,
            <br className="hidden sm:block" /> sin complicaciones.
          </h1>

          <p
            className="animate-rise mt-5 max-w-xl text-lg leading-relaxed text-white/70"
            style={{ animationDelay: "160ms" }}
          >
            Explora inmuebles seleccionados, agenda una visita en segundos y recibe
            acompañamiento real en cada paso de la compra, venta o arriendo.
          </p>

          {/* Buscador (GET → catálogo) */}
          <form
            action="/inmuebles"
            method="get"
            className="animate-rise mt-9 max-w-3xl rounded-[1.4rem] border border-white/10 bg-white/10 p-1.5 backdrop-blur-md"
            style={{ animationDelay: "240ms" }}
          >
            <div className="flex flex-col gap-2 rounded-[1.05rem] bg-white p-2 sm:flex-row sm:items-center">
              <div className="relative flex-1">
                <Search className="pointer-events-none absolute left-3.5 top-1/2 h-4 w-4 -translate-y-1/2 text-muted" />
                <input
                  name="q"
                  placeholder="Ciudad, barrio o código…"
                  aria-label="Buscar inmuebles"
                  className="h-12 w-full rounded-xl bg-transparent pl-10 pr-3 text-ink placeholder:text-muted focus:outline-none"
                />
              </div>
              <select
                name="operacion"
                aria-label="Operación"
                className="h-12 rounded-xl border border-line bg-surface px-3 text-sm text-ink-soft focus:outline-none focus:ring-2 focus:ring-brand-300 sm:w-36"
                defaultValue=""
              >
                <option value="">Operación</option>
                {OPERATIONS.map((o) => (
                  <option key={o} value={o}>{OPERATION_LABELS[o]}</option>
                ))}
              </select>
              <select
                name="tipo"
                aria-label="Tipo de inmueble"
                className="h-12 rounded-xl border border-line bg-surface px-3 text-sm text-ink-soft focus:outline-none focus:ring-2 focus:ring-brand-300 sm:w-36"
                defaultValue=""
              >
                <option value="">Tipo</option>
                {PROPERTY_TYPES.map((t) => (
                  <option key={t} value={t}>{PROPERTY_TYPE_LABELS[t]}</option>
                ))}
              </select>
              <button type="submit" className={buttonVariants({ variant: "primary", size: "lg", className: "shrink-0" })}>
                Buscar
              </button>
            </div>
          </form>

          {/* Accesos rápidos */}
          <div className="animate-rise mt-5 flex flex-wrap items-center gap-2" style={{ animationDelay: "320ms" }}>
            <span className="text-sm text-white/50">Populares:</span>
            {[
              { label: "Apartamentos", href: "/inmuebles?tipo=apartamento" },
              { label: "Casas", href: "/inmuebles?tipo=casa" },
              { label: "En arriendo", href: "/inmuebles?operacion=arriendo" },
              { label: "En venta", href: "/inmuebles?operacion=venta" },
            ].map((chip) => (
              <Link
                key={chip.label}
                href={chip.href}
                className="rounded-full border border-white/15 bg-white/5 px-3.5 py-1.5 text-sm font-medium text-white/80 transition-colors hover:border-brand-400/50 hover:bg-brand-500/10 hover:text-white"
              >
                {chip.label}
              </Link>
            ))}
          </div>

          {/* Stats */}
          <dl className="animate-rise mt-12 grid max-w-3xl grid-cols-2 gap-x-6 gap-y-6 border-t border-white/10 pt-8 sm:grid-cols-4" style={{ animationDelay: "400ms" }}>
            {stats.map((s) => (
              <div key={s.label}>
                <dt className="font-display text-3xl font-extrabold tracking-tight text-white">{s.value}</dt>
                <dd className="mt-1 text-sm text-white/55">{s.label}</dd>
              </div>
            ))}
          </dl>
        </div>
      </section>

      {/* ─────────────────── Propuesta de valor ─────────────────── */}
      <section className="mx-auto max-w-6xl px-4 py-20 sm:px-6 lg:px-8">
        <Reveal className="max-w-2xl">
          <p className="text-xs font-semibold uppercase tracking-[0.2em] text-brand-600">Por qué CIC</p>
          <h2 className="mt-3 text-3xl font-bold tracking-tight text-ink sm:text-4xl">
            Una inmobiliaria pensada para que decidas con tranquilidad.
          </h2>
        </Reveal>
        <div className="mt-12 grid gap-5 sm:grid-cols-3">
          {[
            { icon: ShieldCheck, title: "Inmuebles verificados", desc: "Cada propiedad con información detallada, fotos reales y estado actualizado al día." },
            { icon: CalendarCheck, title: "Agenda en segundos", desc: "Solicita una visita cuando quieras, sin trámites ni llamadas eternas." },
            { icon: TrendingUp, title: "Vende sin estrés", desc: "Publicamos, promocionamos y gestionamos tu inmueble por ti, de principio a fin." },
          ].map((f, i) => (
            <Reveal key={f.title} delay={i * 90}>
              <div className="group h-full rounded-[1.4rem] border border-line bg-white p-1.5 transition-all duration-500 ease-[cubic-bezier(0.16,1,0.3,1)] hover:-translate-y-1 hover:shadow-[0_28px_50px_-28px_rgba(11,26,21,0.3)]">
                <div className="h-full rounded-[1.05rem] bg-surface p-6">
                  <span className="flex h-12 w-12 items-center justify-center rounded-2xl bg-brand-600 text-white shadow-[0_10px_24px_-10px_rgba(7,162,118,0.7)] transition-transform duration-500 group-hover:scale-105">
                    <f.icon className="h-6 w-6" />
                  </span>
                  <h3 className="mt-5 text-lg font-bold text-ink">{f.title}</h3>
                  <p className="mt-2 text-sm leading-relaxed text-muted">{f.desc}</p>
                </div>
              </div>
            </Reveal>
          ))}
        </div>
      </section>

      {/* ───────────────────────── Destacados ───────────────────────── */}
      {destacados.length > 0 && (
        <section className="mx-auto max-w-6xl px-4 pb-6 sm:px-6 lg:px-8">
          <Reveal>
            <div className="flex items-end justify-between gap-4">
              <div>
                <p className="text-xs font-semibold uppercase tracking-[0.2em] text-brand-600">Selección CIC</p>
                <h2 className="mt-2 text-3xl font-bold tracking-tight text-ink">Inmuebles destacados</h2>
              </div>
              <Link href="/inmuebles" className="hidden shrink-0 items-center gap-1 text-sm font-semibold text-brand-700 hover:gap-2 transition-all sm:flex">
                Ver todos <ArrowRight className="h-4 w-4" />
              </Link>
            </div>
          </Reveal>
          <div className="mt-8">
            <PropertyGrid properties={destacados} />
          </div>
        </section>
      )}

      {/* ─────────────────── Cómo funciona (secuencia real) ─────────────────── */}
      <section className="mx-auto max-w-6xl px-4 py-20 sm:px-6 lg:px-8">
        <Reveal className="max-w-2xl">
          <p className="text-xs font-semibold uppercase tracking-[0.2em] text-brand-600">Cómo funciona</p>
          <h2 className="mt-3 text-3xl font-bold tracking-tight text-ink sm:text-4xl">De la búsqueda a las llaves, en tres pasos.</h2>
        </Reveal>
        <div className="mt-12 grid gap-5 md:grid-cols-3">
          {[
            { n: "01", icon: MapPinned, title: "Explora", desc: "Filtra por ciudad, precio y características hasta encontrar el inmueble que encaja contigo." },
            { n: "02", icon: CalendarCheck, title: "Agenda", desc: "Reserva tu visita en segundos. Coordinamos el horario que mejor te funcione." },
            { n: "03", icon: KeyRound, title: "Cierra", desc: "Te acompañamos en la negociación y el papeleo hasta recibir las llaves." },
          ].map((step, i) => (
            <Reveal key={step.n} delay={i * 90}>
              <div className="relative h-full rounded-[1.4rem] border border-line bg-white p-7">
                <span className="font-display text-5xl font-extrabold tracking-tight text-brand-100">{step.n}</span>
                <span className="absolute right-6 top-7 flex h-11 w-11 items-center justify-center rounded-2xl bg-brand-50 text-brand-700">
                  <step.icon className="h-5 w-5" />
                </span>
                <h3 className="mt-4 text-lg font-bold text-ink">{step.title}</h3>
                <p className="mt-2 text-sm leading-relaxed text-muted">{step.desc}</p>
              </div>
            </Reveal>
          ))}
        </div>
      </section>

      {/* ───────────────────────── Recientes ───────────────────────── */}
      <section className="mx-auto max-w-6xl px-4 pb-20 sm:px-6 lg:px-8">
        <Reveal>
          <div className="flex items-end justify-between gap-4">
            <h2 className="text-3xl font-bold tracking-tight text-ink">Inmuebles disponibles</h2>
            <Link href="/inmuebles" className="flex shrink-0 items-center gap-1 text-sm font-semibold text-brand-700 hover:gap-2 transition-all">
              Catálogo <ArrowRight className="h-4 w-4" />
            </Link>
          </div>
        </Reveal>
        <div className="mt-8">
          <PropertyGrid properties={recientes} />
        </div>
      </section>

      {/* ─────────────────── CTA Vendedores ─────────────────── */}
      <section className="px-4 pb-20 sm:px-6 lg:px-8">
        <div className="relative mx-auto max-w-6xl overflow-hidden rounded-[2rem] bg-ink px-6 py-16 text-white sm:px-12">
          <div className="absolute inset-0 bg-aurora" />
          <BrandMark className="pointer-events-none absolute -right-8 -top-10 h-56 w-56 text-brand-500/15" />
          <div className="relative grid items-center gap-8 lg:grid-cols-[1.4fr_1fr]">
            <div>
              <span className="inline-flex items-center gap-2 rounded-full border border-white/15 bg-white/5 px-3.5 py-1.5 text-xs font-semibold uppercase tracking-[0.18em] text-brand-300">
                <HomeIcon className="h-3.5 w-3.5" /> Para propietarios
              </span>
              <h2 className="mt-5 max-w-xl text-3xl font-bold tracking-tight sm:text-4xl">
                ¿Tienes un inmueble para vender o arrendar?
              </h2>
              <p className="mt-4 max-w-lg leading-relaxed text-white/65">
                Nos encargamos de todo: fotos profesionales, publicación, visitas y negociación.
                Déjanos tus datos y te contactamos hoy mismo.
              </p>
            </div>
            <div className="flex flex-col gap-3 lg:items-end">
              <Link
                href="/vender"
                className={buttonVariants({ variant: "primary", size: "lg", className: "w-full justify-center sm:w-auto" })}
              >
                Publicar mi inmueble
                <span className="flex h-5 w-5 items-center justify-center rounded-full bg-white/20 transition-transform duration-300 group-hover:translate-x-0.5 group-hover:-translate-y-0.5">
                  <ArrowUpRight className="h-3 w-3" />
                </span>
              </Link>
              <WhatsAppButton
                size="lg"
                message={`Hola ${siteConfig.name}, tengo un inmueble que quiero vender/arrendar y me gustaría más información.`}
                label="Hablar por WhatsApp"
              />
            </div>
          </div>
        </div>
      </section>
    </>
  );
}
