import Link from "next/link";
import {
  ArrowRight,
  ArrowUpRight,
  ChevronDown,
  CalendarCheck,
  Home as HomeIcon,
  KeyRound,
  MapPinned,
  ShieldCheck,
  Sparkles,
  TrendingUp,
} from "lucide-react";
import { buttonVariants } from "@/components/ui/button";
import { BrandMark } from "@/components/brand/brand-mark";
import { Reveal } from "@/components/ui/reveal";
import { WhatsAppButton } from "@/components/public/whatsapp-button";
import { HeroPov } from "@/components/public/hero-pov";
import { HeroSellCta } from "@/components/public/hero-sell-cta";
import { PortfolioExpand } from "@/components/public/portfolio-expand";
import { getRepository } from "@/lib/data";
import { getCoverMedia, PROPERTY_TYPE_LABELS } from "@/lib/domain";
import { formatPrice } from "@/lib/utils/format";
import { siteConfig } from "@/lib/config/site";

export default async function HomePage() {
  const repo = getRepository();
  let vitrina: Awaited<ReturnType<typeof repo.properties.listPublic>> = [];
  let total = 0;
  let ciudades = 0;
  try {
    // Disponibles primero, luego en proceso y vendidos (orden del repositorio).
    const todos = await repo.properties.listPublic();
    vitrina = todos.slice(0, 12);
    total = todos.length;
    ciudades = new Set(todos.map((p) => p.ubicacion.ciudad)).size;
  } catch (err) {
    console.error("[home] no se pudo cargar el catálogo:", err);
  }

  // Fondo fijo del hero: imagen de marca optimizada (local, sin dependencias).
  const heroBg = "/hero.jpg";

  const items = vitrina.map((p) => ({
    id: p.id,
    slug: p.slug,
    titulo: p.titulo,
    precio: formatPrice(p.precio),
    tipo: PROPERTY_TYPE_LABELS[p.tipo],
    sector: p.ubicacion.sector,
    estado: p.estado,
    cover: getCoverMedia(p)?.url,
    descripcion: p.descripcion,
    habitaciones: p.caracteristicas.habitaciones,
    banos: p.caracteristicas.banos,
    area: p.caracteristicas.area,
    parqueaderos: p.caracteristicas.parqueaderos,
  }));

  const stats = [
    { value: total > 0 ? `${total}` : "—", label: "Inmuebles seleccionados" },
    { value: ciudades > 0 ? `${ciudades}` : "—", label: ciudades === 1 ? "Ciudad" : "Ciudades" },
    { value: "100%", label: "Enfocados en venta" },
    { value: "WhatsApp", label: "Respuesta directa" },
  ];

  return (
    <>
      {/* ─────────── Hero POV: entras al inmueble al deslizar ─────────── */}
      <section className="-mt-[4.5rem] text-white">
        <HeroPov bg={heroBg}>
          <div className="mx-auto flex max-w-4xl flex-col items-center px-4 text-center sm:px-6">
            <span className="animate-rise inline-flex items-center gap-2 rounded-full border border-white/20 bg-ink/40 px-3.5 py-1.5 text-xs font-semibold uppercase tracking-[0.2em] text-brand-300 backdrop-blur">
              <Sparkles className="h-3.5 w-3.5" /> Inmobiliaria boutique · {siteConfig.city}
            </span>

            <h1
              className="animate-rise text-balance mt-6 max-w-3xl font-display text-4xl font-extrabold leading-[1.06] tracking-tight [text-shadow:0_2px_28px_rgba(6,20,16,0.55)] sm:text-6xl lg:text-7xl"
              style={{ animationDelay: "80ms" }}
            >
              Pocos inmuebles. <span className="text-brand-400">Los correctos.</span>
            </h1>

            <p
              className="animate-rise mt-5 max-w-xl text-lg leading-relaxed text-white/80 [text-shadow:0_1px_16px_rgba(6,20,16,0.55)]"
              style={{ animationDelay: "160ms" }}
            >
              Un portafolio corto, visitado y verificado por nosotros. Sin ruido:
              solo propiedades que valen tu tiempo.
            </p>

            <div className="animate-rise mt-8 flex flex-wrap items-center justify-center gap-3" style={{ animationDelay: "240ms" }}>
              <a href="#portafolio" className={buttonVariants({ variant: "primary", size: "lg" })}>
                Ver el portafolio
                <ChevronDown className="h-4 w-4 transition-transform duration-300 group-hover:translate-y-0.5" />
              </a>
              <HeroSellCta />
            </div>

            <div className="animate-rise mt-10 flex flex-wrap items-center justify-center gap-x-10 gap-y-3 text-sm text-white/60" style={{ animationDelay: "320ms" }}>
              {stats.map((s) => (
                <span key={s.label}>
                  <strong className="font-display font-extrabold text-white">{s.value}</strong> {s.label.toLowerCase()}
                </span>
              ))}
            </div>

            <span className="animate-rise mt-12 inline-flex flex-col items-center gap-1 text-xs font-semibold uppercase tracking-[0.2em] text-white/50" style={{ animationDelay: "400ms" }}>
              Desliza para entrar
              <ChevronDown className="h-5 w-5 animate-bounce text-brand-300" />
            </span>
          </div>
        </HeroPov>
      </section>

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
              <div className="group relative h-full rounded-[1.4rem] border border-line bg-white p-7 transition-all duration-500 ease-[cubic-bezier(0.16,1,0.3,1)] hover:-translate-y-1 hover:border-brand-200 hover:shadow-[0_28px_50px_-28px_rgba(11,26,21,0.3)]">
                <span className="font-display text-5xl font-extrabold tracking-tight text-brand-100 transition-colors duration-500 group-hover:text-brand-200">{step.n}</span>
                <span className="absolute right-6 top-7 flex h-11 w-11 items-center justify-center rounded-2xl bg-brand-50 text-brand-700 transition-transform duration-500 group-hover:scale-110">
                  <step.icon className="h-5 w-5" />
                </span>
                <h3 className="mt-4 text-lg font-bold text-ink">{step.title}</h3>
                <p className="mt-2 text-sm leading-relaxed text-muted">{step.desc}</p>
              </div>
            </Reveal>
          ))}
        </div>
      </section>

      {/* ─────────── El portafolio: vertical y desplegable ─────────── */}
      <section id="portafolio" className="scroll-mt-24 bg-surface py-20">
        <div className="mx-auto max-w-6xl px-4 sm:px-6 lg:px-8">
          <Reveal>
            <div className="flex items-end justify-between gap-4">
              <div>
                <p className="text-xs font-semibold uppercase tracking-[0.2em] text-brand-600">El portafolio</p>
                <h2 className="mt-2 text-3xl font-bold tracking-tight text-ink sm:text-4xl">Disponibles ahora.</h2>
                <p className="mt-2 hidden text-sm text-muted lg:block">Pasa el cursor sobre cada inmueble para verlo en grande.</p>
              </div>
              <Link href="/inmuebles" className="hidden shrink-0 items-center gap-1 text-sm font-semibold text-brand-700 transition-all hover:gap-2 sm:flex">
                Ver con filtros <ArrowRight className="h-4 w-4" />
              </Link>
            </div>
          </Reveal>

          <div className="mt-10">
            {vitrina.length > 0 ? (
              <PortfolioExpand items={items} />
            ) : (
              <p className="rounded-2xl border border-dashed border-line bg-white px-6 py-10 text-center text-muted">
                Estamos preparando el portafolio. Escríbenos por WhatsApp y te mostramos lo disponible.
              </p>
            )}
          </div>
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
                ¿Tienes un inmueble para vender?
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
                message={`Hola ${siteConfig.name}, tengo un inmueble que quiero vender y me gustaría más información.`}
                label="Hablar por WhatsApp"
              />
            </div>
          </div>
        </div>
      </section>
    </>
  );
}
