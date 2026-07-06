import Link from "next/link";
import {
  ArrowRight,
  ArrowUpRight,
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
import { SafeImage } from "@/components/ui/safe-image";
import { getRepository } from "@/lib/data";
import { getCoverMedia, PROPERTY_TYPE_LABELS } from "@/lib/domain";
import { StatusBadge } from "@/components/ui/status-badge";
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

  const stats = [
    { value: total > 0 ? `${total}` : "—", label: "Inmuebles seleccionados" },
    { value: ciudades > 0 ? `${ciudades}` : "—", label: ciudades === 1 ? "Ciudad" : "Ciudades" },
    { value: "100%", label: "Enfocados en venta" },
    { value: "WhatsApp", label: "Respuesta directa" },
  ];

  return (
    <>
      {/* ─────────── Hero + Vitrina: el catálogo es el protagonista ─────────── */}
      <section className="relative -mt-[4.5rem] overflow-hidden bg-ink pt-[4.5rem] text-white">
        <div className="absolute inset-0 bg-gradient-to-br from-ink via-ink/95 to-brand-950/80" />
        <div className="absolute inset-0 bg-aurora" />
        <div className="pointer-events-none absolute inset-0 bg-grain opacity-[0.04]" />
        <BrandMark className="animate-float pointer-events-none absolute right-[4%] top-20 hidden h-36 w-36 text-brand-500/20 lg:block" />

        <div className="relative mx-auto max-w-6xl px-4 pt-14 sm:px-6 lg:px-8 lg:pt-20">
          <span className="animate-rise inline-flex items-center gap-2 rounded-full border border-white/15 bg-white/5 px-3.5 py-1.5 text-xs font-semibold uppercase tracking-[0.18em] text-brand-300 backdrop-blur">
            <Sparkles className="h-3.5 w-3.5" /> Finca raíz en {siteConfig.city}
          </span>

          <div className="mt-6 flex flex-wrap items-end justify-between gap-6">
            <h1
              className="animate-rise text-balance max-w-2xl font-display text-4xl font-extrabold leading-[1.06] tracking-tight sm:text-6xl"
              style={{ animationDelay: "80ms" }}
            >
              Pocos inmuebles.
              <br />
              <span className="text-brand-400">Los correctos.</span>
            </h1>
            <p
              className="animate-rise max-w-sm text-base leading-relaxed text-white/65 sm:pb-2"
              style={{ animationDelay: "160ms" }}
            >
              Un catálogo corto y verificado, en venta directa. Míralo completo aquí abajo:
              sin buscar, sin perderse.
            </p>
          </div>
        </div>

        {/* La vitrina: todos los inmuebles, ordenados y numerados */}
        {vitrina.length > 0 ? (
          <div
            className="animate-rise relative mt-10 flex snap-x snap-mandatory gap-5 overflow-x-auto pb-5 pl-4 pr-4 [scrollbar-width:none] sm:pl-6 sm:pr-6 lg:pl-[max(2rem,calc((100vw-72rem)/2+2rem))] [&::-webkit-scrollbar]:hidden"
            style={{ animationDelay: "240ms" }}
          >
            {vitrina.map((p, i) => {
              const cover = getCoverMedia(p);
              return (
                <Link
                  key={p.id}
                  href={`/inmuebles/${p.slug}`}
                  className="group relative aspect-[3/4] w-[75vw] max-w-[330px] shrink-0 snap-start overflow-hidden rounded-[1.6rem] border border-white/10 bg-white/[0.04] transition-transform duration-500 ease-[cubic-bezier(0.16,1,0.3,1)] hover:-translate-y-1.5 sm:w-[330px]"
                >
                  {cover ? (
                    <SafeImage
                      src={cover.url}
                      alt={cover.alt ?? p.titulo}
                      fill
                      sizes="(max-width: 640px) 75vw, 330px"
                      className="object-cover transition-transform duration-700 ease-[cubic-bezier(0.16,1,0.3,1)] group-hover:scale-[1.05]"
                    />
                  ) : (
                    <div className="flex h-full items-center justify-center text-sm text-white/40">
                      Fotos próximamente
                    </div>
                  )}
                  <div className="absolute inset-0 bg-gradient-to-t from-ink/85 via-ink/10 to-transparent" />
                  <span className="absolute left-4 top-4 font-mono text-sm font-semibold tracking-widest text-white/70">
                    {String(i + 1).padStart(2, "0")}
                  </span>
                  {p.estado !== "disponible" && (
                    <span className="absolute right-4 top-4">
                      <StatusBadge status={p.estado} />
                    </span>
                  )}
                  <div className="absolute inset-x-0 bottom-0 p-5">
                    <p className="text-xs font-semibold uppercase tracking-[0.16em] text-brand-300">
                      {PROPERTY_TYPE_LABELS[p.tipo]}
                      {p.ubicacion.sector ? ` · ${p.ubicacion.sector}` : ""}
                    </p>
                    <h3 className="mt-1.5 line-clamp-2 font-display text-xl font-bold leading-snug text-white">
                      {p.titulo}
                    </h3>
                    <p className="mt-2 font-display text-2xl font-extrabold tracking-tight text-white">
                      {formatPrice(p.precio)}
                    </p>
                  </div>
                </Link>
              );
            })}
            {/* Cierre de la vitrina: invitación directa */}
            <Link
              href="/inmuebles"
              className="group flex aspect-[3/4] w-[60vw] max-w-[240px] shrink-0 snap-start flex-col items-center justify-center gap-3 rounded-[1.6rem] border border-dashed border-white/20 text-white/70 transition-colors hover:border-brand-400/60 hover:text-white"
            >
              <span className="flex h-12 w-12 items-center justify-center rounded-full bg-white/10 transition-transform duration-300 group-hover:scale-110">
                <ArrowRight className="h-5 w-5" />
              </span>
              <span className="px-6 text-center text-sm font-semibold">Ver el catálogo con filtros</span>
            </Link>
          </div>
        ) : (
          <div className="relative mx-auto mt-10 max-w-6xl px-4 sm:px-6 lg:px-8">
            <p className="rounded-2xl border border-dashed border-white/15 px-6 py-10 text-center text-white/55">
              Estamos preparando la vitrina. Escríbenos por WhatsApp y te mostramos lo disponible.
            </p>
          </div>
        )}

        <div className="relative mx-auto max-w-6xl px-4 pb-14 sm:px-6 lg:px-8">
          <dl className="animate-rise grid grid-cols-2 gap-x-6 gap-y-5 border-t border-white/10 pt-7 sm:grid-cols-4" style={{ animationDelay: "320ms" }}>
            {stats.map((s) => (
              <div key={s.label}>
                <dt className="font-display text-2xl font-extrabold tracking-tight text-white sm:text-3xl">{s.value}</dt>
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
