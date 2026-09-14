import type { Metadata } from "next";
import Link from "next/link";
import { ArrowLeft, Camera, Check, MessageCircle, Sparkles } from "lucide-react";
import { PlanCheckout } from "@/components/public/plan-checkout";
import { PagoResultado, type PagoEstadoVisible } from "@/components/public/pago-resultado";
import { JsonLd } from "@/components/seo/json-ld";
import { getPlan, PLANS, type Plan, type PlanGrupo } from "@/lib/config/plans";
import { isWompiConfigured, planIdFromReference } from "@/lib/integrations/wompi";
import { confirmFromRedirect } from "@/lib/pagos/process";
import { isPagosStoreConfigured } from "@/lib/pagos/store";
import { buttonVariants } from "@/components/ui/button";
import { formatPrice } from "@/lib/utils/format";
import { siteConfig, whatsappLink } from "@/lib/config/site";
import { cn } from "@/lib/utils/cn";

type SearchParams = Promise<{ pago?: string; ref?: string; id?: string }>;

const ESTADOS_VISIBLES = new Set<string>(["APPROVED", "PENDING", "DECLINED", "VOIDED", "ERROR"]);
const esEstadoVisible = (s: string): s is PagoEstadoVisible => ESTADOS_VISIBLES.has(s);

// El precio sale de plans.ts (fuente única de verdad) para que la descripción
// no quede desactualizada al cambiar la tarifa.
const pagables = PLANS.filter((p) => p.audience === "agente" && p.mode === "pago");
const desdeCOP = Math.min(...pagables.map((p) => p.precioCOP));
const contenido = PLANS.find((p) => p.id === "contenido-profesional");

const METADATA_PLANES: Metadata = {
  title: "Planes para agentes e inmobiliarias",
  description:
    `Publica tus inmuebles en CIC: alianza por resultados desde ${formatPrice(desdeCOP)}, ` +
    "publicación independiente y paquetes mensuales o anuales para varios inmuebles. " +
    "Pago en línea seguro.",
  alternates: { canonical: "/publica/agente" },
};

export async function generateMetadata({ searchParams }: { searchParams: SearchParams }): Promise<Metadata> {
  const sp = await searchParams;
  if (sp.pago !== "procesado") return METADATA_PLANES;
  // La pantalla de retorno es personal y efímera: título propio y fuera del índice.
  return {
    title: "Estado de tu pago",
    robots: { index: false, follow: false },
    alternates: { canonical: "/publica/agente" },
  };
}

/** El eje de decisión: pagar por inmueble o por paquete de espacios. */
const GRUPOS: { id: PlanGrupo; titulo: string; descripcion: string }[] = [
  {
    id: "inmueble",
    titulo: "Por inmueble",
    descripcion:
      "Pagas una vez por cada inmueble que publiques. La diferencia está en quién atiende a los interesados.",
  },
  {
    id: "mensual",
    titulo: "Paquetes mensuales",
    descripcion:
      "Varios espacios activos a la vez; cuando vendes o retiras uno, lo reemplazas. Para inventario que rota.",
  },
  {
    id: "anual",
    titulo: "Paquetes anuales",
    descripcion: "Los mismos espacios durante 12 meses a una fracción del mensual. Precio especial de lanzamiento.",
  },
];

// Preguntas que frenan la contratación. Las respuestas salen de las condiciones
// de publicación y del flujo real de pago; formato citable por buscadores e IAs.
const faqs = [
  {
    q: "¿Qué es un espacio activo?",
    a: "Es un inmueble publicado a la vez. Cada plan incluye un número de espacios: uno en los planes por inmueble, cinco o diez en los paquetes. En los paquetes, si vendes o retiras un inmueble, publicas otro en su lugar sin pagar de nuevo mientras el plan esté vigente.",
  },
  {
    q: "¿Cuál es la diferencia entre la alianza y la publicación independiente?",
    a: "En la alianza por resultados CIC atiende a los interesados, coordina las visitas y acompaña el cierre; la comisión se comparte 50/50 según acuerdo previo. En la publicación independiente tú atiendes a los interesados y conservas tu comisión completa.",
  },
  {
    q: "¿Qué pasa después de pagar?",
    a: "Te contactamos al correo o teléfono que dejaste en la pasarela para pedirte las fotos y los datos del inmueble. Creamos la ficha, la activamos y te enviamos el enlace publicado.",
  },
  {
    q: "¿Cómo puedo pagar?",
    a: "En línea con Wompi: tarjetas de crédito y débito, PSE, Nequi y los demás medios disponibles en la pasarela. Al terminar vuelves a esta página con el resultado del pago.",
  },
  {
    q: "¿Los pagos son reembolsables?",
    a: "Los pagos de publicación no son reembolsables una vez creada y activada la ficha. Si pagaste y todavía no hemos creado la ficha, escríbenos y lo revisamos.",
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

const breadcrumbJsonLd = {
  "@context": "https://schema.org",
  "@type": "BreadcrumbList",
  itemListElement: [
    { "@type": "ListItem", position: 1, name: "Inicio", item: siteConfig.url },
    { "@type": "ListItem", position: 2, name: "Publica tu inmueble", item: `${siteConfig.url}/publica` },
    { "@type": "ListItem", position: 3, name: "Agentes e inmobiliarias", item: `${siteConfig.url}/publica/agente` },
  ],
};

/** Costo por inmueble al mes, derivado del precio: la ayuda real para comparar paquetes. */
function equivalencia(plan: Plan): { porInmuebleMes: number; mensualAnual?: number } | null {
  if (!plan.espacios || !plan.grupo || plan.grupo === "inmueble") return null;
  const aCentenas = (n: number) => Math.round(n / 100) * 100; // "≈ $ 4.000", no "$ 3.998"
  if (plan.grupo === "mensual") return { porInmuebleMes: aCentenas(plan.precioCOP / plan.espacios) };
  const mensual = pagables.find((p) => p.grupo === "mensual" && p.espacios === plan.espacios);
  return {
    porInmuebleMes: aCentenas(plan.precioCOP / plan.espacios / 12),
    mensualAnual: mensual ? mensual.precioCOP * 12 : undefined,
  };
}

export default async function AgentePlanesPage({ searchParams }: { searchParams: SearchParams }) {
  const sp = await searchParams;
  const wompiOn = isWompiConfigured();

  // Retorno del widget: Wompi agrega ?id=<transacción>. Se confirma con la API
  // (fuente de verdad) y se muestra el estado real; la notificación al negocio
  // es idempotente, así que recargar esta página no duplica avisos.
  if (sp.pago === "procesado") {
    const retorno =
      sp.id && sp.ref && wompiOn && isPagosStoreConfigured() ? await confirmFromRedirect(sp.id, sp.ref) : null;
    // Un status nuevo de Wompi que no conozcamos se trata como "en proceso": nunca como aprobado.
    const estado: PagoEstadoVisible = !retorno?.found ? "DESCONOCIDO" : esEstadoVisible(retorno.status) ? retorno.status : "PENDING";
    const reference = retorno?.found ? retorno.reference : sp.ref;
    const planId = reference ? planIdFromReference(reference) : undefined;
    const plan = planId ? getPlan(planId) : undefined;
    const actualUrl = `/publica/agente?pago=procesado${sp.ref ? `&ref=${encodeURIComponent(sp.ref)}` : ""}${sp.id ? `&id=${encodeURIComponent(sp.id)}` : ""}`;

    return (
      <div className="mx-auto max-w-6xl px-4 py-12 sm:px-6 lg:px-8 lg:py-16">
        <Link
          href="/publica/agente"
          className="inline-flex items-center gap-1.5 py-2 text-sm font-medium text-muted transition-colors hover:gap-2 hover:text-brand-700"
        >
          <ArrowLeft className="h-4 w-4" aria-hidden="true" /> Volver a los planes
        </Link>
        <div className="mt-6">
          <PagoResultado
            estado={estado}
            plan={plan}
            amountInCents={retorno?.found ? retorno.amountInCents : undefined}
            reference={reference}
            actualUrl={actualUrl}
          />
        </div>
      </div>
    );
  }

  return (
    <div className="mx-auto max-w-6xl px-4 py-12 sm:px-6 lg:px-8 lg:py-16">
      <JsonLd data={breadcrumbJsonLd} />
      <JsonLd data={faqJsonLd} />

      <Link
        href="/publica"
        className="inline-flex items-center gap-1.5 py-2 text-sm font-medium text-muted transition-colors hover:gap-2 hover:text-brand-700"
      >
        <ArrowLeft className="h-4 w-4" aria-hidden="true" /> Volver
      </Link>

      <header className="mt-4 max-w-2xl">
        <span className="inline-flex items-center gap-2 rounded-full bg-brand-50 px-3.5 py-1.5 text-xs font-semibold uppercase tracking-[0.16em] text-brand-700">
          <Sparkles className="h-3.5 w-3.5" aria-hidden="true" /> Agentes e inmobiliarias
        </span>
        <h1 className="mt-5 text-balance text-4xl font-bold tracking-tight text-ink sm:text-5xl">
          Publica tus inmuebles en CIC
        </h1>
        <p className="mt-4 text-lg leading-relaxed text-muted">
          Primero decide cómo quieres pagar: por cada inmueble o por un paquete de espacios que
          rotan. Los planes con precio fijo se pagan en línea; el contenido profesional se cotiza
          según el inmueble.
        </p>
      </header>

      {!wompiOn && (
        <p className="mt-6 rounded-xl border border-amber-200 bg-amber-50 px-4 py-3 text-sm text-amber-900">
          El pago en línea se activará en breve. Mientras tanto, escríbenos por WhatsApp y coordinamos la publicación.
        </p>
      )}

      <div id="planes" className="mt-12 space-y-14 scroll-mt-24">
        {GRUPOS.map((g) => {
          const planes = pagables.filter((p) => p.grupo === g.id);
          if (planes.length === 0) return null;
          return (
            <section key={g.id} aria-labelledby={`grupo-${g.id}`} className="grid gap-6 lg:grid-cols-[minmax(0,1fr)_minmax(0,2fr)] lg:gap-10">
              <div className="lg:pt-2">
                <h2 id={`grupo-${g.id}`} className="text-2xl font-bold tracking-tight text-ink">
                  {g.titulo}
                </h2>
                <p className="mt-2 max-w-sm text-sm leading-relaxed text-muted">{g.descripcion}</p>
              </div>
              <div className="grid gap-5 sm:grid-cols-2">
                {planes.map((plan) => (
                  <PlanCard key={plan.id} plan={plan} wompiOn={wompiOn} />
                ))}
              </div>
            </section>
          );
        })}
      </div>

      {/* Contenido profesional: precio variable → banda propia a todo el ancho */}
      {contenido && (
        <div className="mt-14 grid items-center gap-6 rounded-[1.6rem] border border-line bg-surface p-6 sm:p-8 lg:grid-cols-[1.5fr_1fr]">
          <div>
            <span className="inline-flex items-center gap-2 rounded-full bg-white px-3 py-1 text-xs font-semibold uppercase tracking-[0.14em] text-brand-700">
              <Camera className="h-3.5 w-3.5" aria-hidden="true" /> Contenido profesional
            </span>
            <h2 className="mt-3 text-2xl font-bold tracking-tight text-ink">{contenido.nombre}</h2>
            <p className="mt-2 text-sm leading-relaxed text-ink-soft">{contenido.resumen}</p>
            <ul className="mt-4 grid gap-2 sm:grid-cols-2">
              {contenido.incluye.map((f) => (
                <li key={f} className="flex items-start gap-2 text-sm text-ink-soft">
                  <Check className="mt-0.5 h-4 w-4 flex-none text-brand-600" aria-hidden="true" />
                  <span>{f}</span>
                </li>
              ))}
            </ul>
          </div>
          <div className="text-center lg:text-right">
            <p className="text-sm text-muted">desde</p>
            <p className="font-display text-4xl font-extrabold tracking-tight text-ink">{formatPrice(contenido.precioCOP)}</p>
            <p className="mt-1 text-xs text-muted">El precio final depende del inmueble.</p>
            <a
              href={whatsappLink(`Hola ${siteConfig.name}, quiero cotizar el "${contenido.nombre}" para mi inmueble.`)}
              target="_blank"
              rel="noopener noreferrer"
              className={buttonVariants({ variant: "outline", size: "md", className: "mt-4 w-full justify-center lg:w-auto" })}
            >
              <MessageCircle className="h-4 w-4" aria-hidden="true" /> Cotizar por WhatsApp
            </a>
          </div>
        </div>
      )}

      {/* Preguntas frecuentes */}
      <section className="mt-16 grid gap-6 lg:grid-cols-[minmax(0,1fr)_minmax(0,2fr)] lg:gap-10" aria-labelledby="faq-title">
        <div>
          <h2 id="faq-title" className="text-2xl font-bold tracking-tight text-ink">
            Preguntas frecuentes
          </h2>
          <p className="mt-2 max-w-sm text-sm leading-relaxed text-muted">
            Lo que suelen preguntar los agentes antes de contratar. Si falta la tuya,{" "}
            <Link href="/contacto" className="font-semibold text-brand-700 hover:underline">
              escríbenos
            </Link>
            .
          </p>
        </div>
        <div className="space-y-4">
          {faqs.map((f) => (
            <div key={f.q} className="rounded-2xl border border-line bg-white p-5">
              <h3 className="font-bold text-ink">{f.q}</h3>
              <p className="mt-2 text-sm leading-relaxed text-muted">{f.a}</p>
            </div>
          ))}
        </div>
      </section>

      <p className="mt-12 text-center text-sm text-muted">
        Todos los planes funcionan mediante espacios activos y se rigen por las{" "}
        <Link href="/publica/condiciones" className="font-semibold text-brand-700 hover:underline">
          condiciones de publicación
        </Link>
        .
      </p>
    </div>
  );
}

function PlanCard({ plan, wompiOn }: { plan: Plan; wompiOn: boolean }) {
  const eq = equivalencia(plan);
  return (
    <article
      className={cn(
        "relative flex flex-col rounded-[1.6rem] border bg-white p-6 transition-all duration-500 ease-[cubic-bezier(0.16,1,0.3,1)] hover:-translate-y-1 hover:shadow-[0_28px_50px_-28px_rgba(11,26,21,0.3)]",
        plan.destacado ? "border-brand-300 shadow-[0_20px_46px_-30px_rgba(7,162,118,0.5)]" : "border-line",
      )}
    >
      {plan.destacado && (
        <span className="absolute -top-3 left-6 rounded-full bg-brand-700 px-3 py-1 text-xs font-semibold text-white shadow">
          Más elegido
        </span>
      )}
      <h3 className="text-lg font-bold tracking-tight text-ink">{plan.nombre}</h3>
      <p className="mt-3 font-display text-3xl font-extrabold tracking-tight text-ink">{formatPrice(plan.precioCOP)}</p>
      <p className="mt-0.5 text-xs font-medium text-muted">{plan.periodo}</p>
      {eq && (
        <p className="mt-2 text-xs leading-relaxed text-ink-soft">
          ≈ <span className="font-semibold tabular-nums">{formatPrice(eq.porInmuebleMes)}</span> por inmueble al mes
          {eq.mensualAnual != null && (
            <span className="text-muted"> · frente a {formatPrice(eq.mensualAnual)} pagando mes a mes</span>
          )}
        </p>
      )}
      <p className="mt-3 text-sm leading-relaxed text-ink-soft">{plan.resumen}</p>

      <ul className="mt-4 flex-1 space-y-2">
        {plan.incluye.map((f) => (
          <li key={f} className="flex items-start gap-2 text-sm text-ink-soft">
            <Check className="mt-0.5 h-4 w-4 flex-none text-brand-600" aria-hidden="true" />
            <span>{f}</span>
          </li>
        ))}
      </ul>

      <div className="mt-6">
        {wompiOn ? (
          <PlanCheckout planId={plan.id} planNombre={plan.nombre} precioCOP={plan.precioCOP} />
        ) : (
          <a
            href={whatsappLink(`Hola ${siteConfig.name}, me interesa el plan "${plan.nombre}" (${formatPrice(plan.precioCOP)}). ¿Cómo lo contrato?`)}
            target="_blank"
            rel="noopener noreferrer"
            className={buttonVariants({ variant: "whatsapp", size: "md", className: "w-full justify-center" })}
          >
            <MessageCircle className="h-4 w-4" aria-hidden="true" /> Contratar por WhatsApp
          </a>
        )}
      </div>
    </article>
  );
}
