import type { Metadata } from "next";
import Link from "next/link";
import { ArrowLeft, Check, CheckCircle2, MessageCircle, Sparkles } from "lucide-react";
import { PlanCheckout } from "@/components/public/plan-checkout";
import { JsonLd } from "@/components/seo/json-ld";
import { PLANS } from "@/lib/config/plans";
import { isWompiConfigured } from "@/lib/integrations/wompi";
import { formatPrice } from "@/lib/utils/format";
import { siteConfig, whatsappLink } from "@/lib/config/site";
import { cn } from "@/lib/utils/cn";

export const metadata: Metadata = {
  title: "Planes para agentes e inmobiliarias",
  description:
    "Publica tus inmuebles en CIC: alianza por resultados desde $10.000, publicación independiente y paquetes mensuales o anuales para varios inmuebles. Pago en línea seguro.",
  alternates: { canonical: "/publica/agente" },
};

export default async function AgentePlanesPage({
  searchParams,
}: {
  searchParams: Promise<{ pago?: string; ref?: string }>;
}) {
  const sp = await searchParams;
  const wompiOn = isWompiConfigured();
  const agentes = PLANS.filter((p) => p.audience === "agente");

  const jsonLd = {
    "@context": "https://schema.org",
    "@type": "BreadcrumbList",
    itemListElement: [
      { "@type": "ListItem", position: 1, name: "Inicio", item: siteConfig.url },
      { "@type": "ListItem", position: 2, name: "Publica tu inmueble", item: `${siteConfig.url}/publica` },
      { "@type": "ListItem", position: 3, name: "Agentes e inmobiliarias", item: `${siteConfig.url}/publica/agente` },
    ],
  };

  return (
    <div className="mx-auto max-w-6xl px-4 py-12 sm:px-6 lg:px-8 lg:py-16">
      <JsonLd data={jsonLd} />

      <Link href="/publica" className="inline-flex items-center gap-1.5 text-sm font-medium text-muted transition-colors hover:gap-2 hover:text-brand-700">
        <ArrowLeft className="h-4 w-4" /> Volver
      </Link>

      {/* Aviso de retorno desde la pasarela */}
      {sp.pago === "procesado" && (
        <div className="mt-5 flex items-start gap-3 rounded-2xl border border-emerald-200 bg-emerald-50 p-5 text-emerald-900">
          <CheckCircle2 className="mt-0.5 h-5 w-5 flex-none text-emerald-600" />
          <div>
            <p className="font-semibold">Recibimos tu pago</p>
            <p className="mt-1 text-sm text-emerald-800">
              Estamos confirmando la transacción con Wompi{sp.ref ? ` (ref. ${sp.ref})` : ""}. Te
              contactaremos para crear la ficha de tu inmueble. Si tienes dudas, escríbenos por WhatsApp.
            </p>
          </div>
        </div>
      )}

      <header className="mt-6 max-w-2xl">
        <span className="inline-flex items-center gap-2 rounded-full bg-brand-50 px-3.5 py-1.5 text-xs font-semibold uppercase tracking-[0.16em] text-brand-700">
          <Sparkles className="h-3.5 w-3.5" /> Agentes e inmobiliarias
        </span>
        <h1 className="mt-5 text-4xl font-bold tracking-tight text-ink sm:text-5xl">
          Publica tus inmuebles en CIC
        </h1>
        <p className="mt-4 text-lg leading-relaxed text-muted">
          Elige la modalidad que mejor se adapte a tu operación. Los planes con precio fijo se
          pagan en línea de forma segura; el contenido profesional se cotiza según el inmueble.
        </p>
      </header>

      {!wompiOn && (
        <p className="mt-6 rounded-xl border border-amber-200 bg-amber-50 px-4 py-3 text-sm text-amber-800">
          El pago en línea se activará en breve. Mientras tanto, escríbenos por WhatsApp y coordinamos la publicación.
        </p>
      )}

      <div className="mt-10 grid gap-5 md:grid-cols-2 lg:grid-cols-3">
        {agentes.map((plan) => (
          <article
            key={plan.id}
            className={cn(
              "relative flex flex-col rounded-[1.6rem] border bg-white p-6 transition-all duration-500 ease-[cubic-bezier(0.16,1,0.3,1)] hover:-translate-y-1 hover:shadow-[0_28px_50px_-28px_rgba(11,26,21,0.3)]",
              plan.destacado ? "border-brand-300 shadow-[0_20px_46px_-30px_rgba(7,162,118,0.5)]" : "border-line",
            )}
          >
            {plan.destacado && (
              <span className="absolute -top-3 left-6 rounded-full bg-brand-600 px-3 py-1 text-xs font-semibold text-white shadow">
                Más elegido
              </span>
            )}
            <h2 className="text-lg font-bold tracking-tight text-ink">{plan.nombre}</h2>
            <div className="mt-3 flex items-baseline gap-1.5">
              {plan.desde && <span className="text-sm font-medium text-muted">desde</span>}
              <span className="font-display text-3xl font-extrabold tracking-tight text-ink">{formatPrice(plan.precioCOP)}</span>
            </div>
            <p className="mt-0.5 text-xs font-medium text-muted">{plan.periodo}</p>
            <p className="mt-3 text-sm leading-relaxed text-ink-soft">{plan.resumen}</p>

            <ul className="mt-4 flex-1 space-y-2">
              {plan.incluye.map((f) => (
                <li key={f} className="flex items-start gap-2 text-sm text-ink-soft">
                  <Check className="mt-0.5 h-4 w-4 flex-none text-brand-600" />
                  <span>{f}</span>
                </li>
              ))}
            </ul>

            <div className="mt-6">
              {plan.mode === "pago" ? (
                wompiOn ? (
                  <PlanCheckout planId={plan.id} planNombre={plan.nombre} precioCOP={plan.precioCOP} />
                ) : (
                  <a
                    href={whatsappLink(`Hola ${siteConfig.name}, me interesa el plan "${plan.nombre}" (${formatPrice(plan.precioCOP)}). ¿Cómo lo contrato?`)}
                    target="_blank"
                    rel="noopener noreferrer"
                    className="inline-flex h-11 w-full items-center justify-center gap-2 rounded-xl bg-[#25D366] px-5 text-sm font-semibold text-white transition-colors hover:bg-[#1ebe5d]"
                  >
                    <MessageCircle className="h-4 w-4" /> Contratar por WhatsApp
                  </a>
                )
              ) : (
                /* Plan de precio variable → siempre por WhatsApp */
                <a
                  href={whatsappLink(`Hola ${siteConfig.name}, quiero cotizar el "${plan.nombre}" para mi inmueble.`)}
                  target="_blank"
                  rel="noopener noreferrer"
                  className="inline-flex h-11 w-full items-center justify-center gap-2 rounded-xl border border-line bg-white px-5 text-sm font-semibold text-ink transition-colors hover:border-brand-300 hover:bg-brand-50 hover:text-brand-800"
                >
                  <MessageCircle className="h-4 w-4" /> Cotizar por WhatsApp
                </a>
              )}
            </div>
          </article>
        ))}
      </div>

      <p className="mt-10 text-center text-sm text-muted">
        Todos los planes funcionan por espacios activos y se rigen por las condiciones de publicación.{" "}
        <Link href="/contacto" className="font-semibold text-brand-700 hover:underline">¿Dudas? Escríbenos</Link>.
      </p>
    </div>
  );
}
