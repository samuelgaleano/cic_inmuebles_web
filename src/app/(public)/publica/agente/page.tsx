import type { Metadata } from "next";
import Link from "next/link";
import { ArrowLeft, Check, ChevronDown, MessageCircle } from "lucide-react";
import { PlanCheckout } from "@/components/public/plan-checkout";
import { PagoResultado, type PagoEstadoVisible } from "@/components/public/pago-resultado";
import { JsonLd } from "@/components/seo/json-ld";
import { COMERCIO_EN_PASARELA, getPlan, PLANS, type Plan, type PlanGrupo } from "@/lib/config/plans";
import { isWompiConfigured, planIdFromReference } from "@/lib/integrations/wompi";
import { confirmFromRedirect } from "@/lib/pagos/process";
import { getPagosStore, isPagosStoreConfigured } from "@/lib/pagos/store";
import { getServiciosStore } from "@/lib/servicios/store";
import { servicioDeToken } from "@/lib/servicios/token";
import { buttonVariants } from "@/components/ui/button";
import { formatPrice } from "@/lib/utils/format";
import { siteConfig, whatsappLink } from "@/lib/config/site";
import { cn } from "@/lib/utils/cn";

type SearchParams = Promise<{ pago?: string; ref?: string; id?: string; renovar?: string }>;

/** Datos del servicio que se renueva, tomados del enlace firmado del correo. */
interface Renovacion {
  planId: string;
  nombre: string;
  email: string;
  telefono: string;
  /** El mismo token del correo: liga el pago al servicio que se renueva. */
  token: string;
}

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
  openGraph: {
    title: "Planes para agentes e inmobiliarias | CIC Inmuebles",
    description: "Publicación por inmueble o paquetes de espacios, con pago en línea seguro.",
    url: `${siteConfig.url}/publica/agente`,
    images: [siteConfig.ogImage],
  },
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
// Lo de los avisos de vencimiento solo se afirma cuando ese registro funciona.
function preguntas(avisosActivos: boolean) {
  return [
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
      a: "Te contactamos al correo o teléfono que dejaste en la pasarela para pedirte las fotos y los datos del inmueble. Creamos la ficha, la activamos y te enviamos el enlace publicado. La vigencia del plan empieza el día en que publicamos tu inmueble, no el día del pago.",
    },
    {
      q: "¿El plan se renueva o se cobra solo?",
      a: avisosActivos
        ? "No. Cada pago es único: no guardamos tu tarjeta ni hacemos cobros automáticos. Te escribimos por correo 7 días y 1 día antes del vencimiento con un enlace para renovar en un paso; si no renuevas, la publicación se desactiva al vencer."
        : "No. Cada pago es único: no guardamos tu tarjeta ni hacemos cobros automáticos. Para seguir publicado al terminar la vigencia, vuelves a pagar el plan.",
    },
    {
      q: "¿Cómo puedo pagar?",
      a: `En línea con Wompi: tarjetas de crédito y débito, PSE, Nequi y los demás medios disponibles en la pasarela. En la pasarela verás el comercio «${COMERCIO_EN_PASARELA}», la cuenta con la que CIC Inmuebles recibe sus pagos. Al terminar vuelves a esta página con el resultado del pago.`,
    },
    {
      q: "¿Los pagos son reembolsables?",
      a: "Los pagos de publicación no son reembolsables una vez creada y activada la ficha. Si pagaste y todavía no hemos creado la ficha, escríbenos y lo revisamos.",
    },
  ];
}

function faqJsonLd(faqs: { q: string; a: string }[]) {
  return {
    "@context": "https://schema.org",
    "@type": "FAQPage",
    mainEntity: faqs.map((f) => ({
      "@type": "Question",
      name: f.q,
      acceptedAnswer: { "@type": "Answer", text: f.a },
    })),
  };
}

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
function equivalencia(plan: Plan): { porInmuebleMes: number; mensualAnual?: number; anual?: { precio: number; porInmuebleMes: number } } | null {
  if (!plan.espacios || !plan.grupo || plan.grupo === "inmueble") return null;
  const aCentenas = (n: number) => Math.round(n / 100) * 100; // "≈ $ 4.000", no "$ 3.998"
  if (plan.grupo === "mensual") {
    const anual = pagables.find((p) => p.grupo === "anual" && p.espacios === plan.espacios);
    return {
      porInmuebleMes: aCentenas(plan.precioCOP / plan.espacios),
      anual: anual ? { precio: anual.precioCOP, porInmuebleMes: aCentenas(anual.precioCOP / plan.espacios / 12) } : undefined,
    };
  }
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
    // Una renovación pagada desde el correo no vuelve a pedir fotos ni datos: su vigencia solo se extiende.
    let esRenovacion = false;
    if (retorno?.found && isPagosStoreConfigured()) {
      try {
        esRenovacion = Boolean((await getPagosStore().getReference(retorno.reference))?.renuevaServicioId);
      } catch {
        esRenovacion = false;
      }
    }

    return (
      <>
        <div className="wrap pt-8">
          <Link href="/publica/agente" className="link-arrow py-2 text-[15px]">
            <ArrowLeft className="h-4 w-4" aria-hidden="true" /> Volver a los planes
          </Link>
        </div>
        <div className="wrap pb-28 pt-8">
          <PagoResultado
            estado={estado}
            plan={plan}
            amountInCents={retorno?.found ? retorno.amountInCents : undefined}
            reference={reference}
            actualUrl={actualUrl}
            esRenovacion={esRenovacion}
          />
        </div>
      </>
    );
  }

  // Enlace de renovación del correo: abre el plan que vence con los datos precargados.
  let renovacion: Renovacion | null = null;
  if (typeof sp.renovar === "string") {
    const servicioId = servicioDeToken(sp.renovar);
    if (servicioId) {
      try {
        const s = await getServiciosStore().obtener(servicioId);
        if (s && getPlan(s.planId)?.mode === "pago") {
          renovacion = { planId: s.planId, nombre: s.clienteNombre ?? "", email: s.clienteEmail ?? "", telefono: s.clienteTelefono ?? "", token: sp.renovar };
        }
      } catch {
        renovacion = null; // sin la tabla o sin red, la página de planes funciona igual
      }
    }
  }

  // Los avisos de vencimiento solo se prometen si el registro de vigencias funciona (migración 0004).
  const avisosActivos = isPagosStoreConfigured() && (await getServiciosStore().disponible());
  const faqs = preguntas(avisosActivos);

  return (
    <>
      <JsonLd data={breadcrumbJsonLd} />
      <JsonLd data={faqJsonLd(faqs)} />

      <div className="wrap pt-8">
        <Link href="/publica" className="link-arrow py-2 text-[15px]">
          <ArrowLeft className="h-4 w-4" aria-hidden="true" /> Volver
        </Link>
      </div>

      <header className="wrap pb-12 pt-8 sm:pb-16 sm:pt-12">
        <p className="text-[15px] text-muted">Agentes e inmobiliarias</p>
        <h1 className="t-display mt-2 max-w-4xl">Publica tus inmuebles en CIC.</h1>
        <p className="t-lead mt-5 max-w-2xl">
          Elige cómo pagar: por cada inmueble o por un paquete de espacios que rotan. Pagas en línea una sola vez por periodo, sin cobros automáticos, y la vigencia empieza cuando publicamos tu inmueble. El contenido profesional se cotiza según el inmueble.
        </p>
        <nav aria-label="Tipos de plan" className="mt-8 flex flex-wrap gap-2">
          {GRUPOS.filter((g) => pagables.some((p) => p.grupo === g.id)).map((g) => (
            <a
              key={g.id}
              href={`#plan-${g.id}`}
              className="rounded-full border border-line bg-white px-4 py-2 text-[14px] font-medium text-ink-soft transition-colors hover:border-ink hover:text-ink"
            >
              {g.titulo}
            </a>
          ))}
        </nav>
        {renovacion && wompiOn && (
          <p className="mt-8 max-w-2xl rounded-[var(--radius-card)] bg-brand-50 px-5 py-4 text-[15px] text-brand-900">
            Renueva tu publicación: abrimos el plan «{getPlan(renovacion.planId)?.nombre}» con tus datos para que pagues en un paso.
          </p>
        )}
        {!wompiOn && (
          <p className="mt-8 max-w-2xl rounded-[var(--radius-card)] bg-surface px-5 py-4 text-[15px]">
            El pago en línea se activará en breve. Mientras tanto, escríbenos por WhatsApp y coordinamos la publicación.
          </p>
        )}
      </header>

      <div id="planes" className="wrap scroll-mt-24 space-y-24">
        {GRUPOS.map((g) => {
          const planes = pagables.filter((p) => p.grupo === g.id);
          if (planes.length === 0) return null;
          return (
            <section key={g.id} id={`plan-${g.id}`} aria-labelledby={`grupo-${g.id}`} className="grid scroll-mt-24 gap-8 lg:grid-cols-[minmax(0,1fr)_minmax(0,2.2fr)] lg:gap-14">
              <div className="lg:pt-2">
                <h2 id={`grupo-${g.id}`} className="t-title">{g.titulo}</h2>
                <p className="mt-3 max-w-xs text-[15px] leading-relaxed text-muted">{g.descripcion}</p>
              </div>
              <div className="grid gap-5 sm:grid-cols-2">
                {planes.map((plan) => (
                  <PlanCard
                    key={plan.id}
                    plan={plan}
                    wompiOn={wompiOn}
                    avisosActivos={avisosActivos}
                    renovacion={renovacion?.planId === plan.id ? renovacion : null}
                  />
                ))}
              </div>
            </section>
          );
        })}
      </div>

      {/* Contenido profesional: precio variable → banda propia a todo el ancho */}
      {contenido && (
        <section className="mt-28 bg-surface" aria-labelledby="contenido-titulo">
          <div className="wrap section-y grid items-center gap-10 lg:grid-cols-[1.5fr_1fr]">
            <div>
              <p className="text-[15px] text-muted">Contenido profesional</p>
              <h2 id="contenido-titulo" className="t-headline mt-2">{contenido.nombre}</h2>
              <p className="mt-4 max-w-xl leading-relaxed text-ink-soft">{contenido.resumen}</p>
              <ul className="mt-6 grid gap-x-8 sm:grid-cols-2">
                {contenido.incluye.map((f) => (
                  <li key={f} className="flex items-start gap-2.5 border-t border-line-strong/50 py-3 text-[15px] text-ink-soft">
                    <Check className="mt-0.5 h-4 w-4 flex-none text-brand-700" aria-hidden="true" />
                    <span>{f}</span>
                  </li>
                ))}
              </ul>
            </div>
            <div className="lg:text-right">
              <p className="text-[15px] text-muted">desde</p>
              <p className="tnum text-[2.5rem] font-semibold leading-tight tracking-[-0.03em] sm:text-[3rem]">{formatPrice(contenido.precioCOP)}</p>
              <p className="mt-1 text-[13px] text-muted">El precio final depende del inmueble.</p>
              <a
                href={whatsappLink(`Hola ${siteConfig.name}, quiero cotizar el "${contenido.nombre}" para mi inmueble.`)}
                target="_blank"
                rel="noopener noreferrer"
                className={buttonVariants({ variant: "outline", size: "lg", className: "mt-6" })}
              >
                <MessageCircle className="h-5 w-5" aria-hidden="true" /> Cotizar por WhatsApp
              </a>
            </div>
          </div>
        </section>
      )}

      {/* Preguntas frecuentes */}
      <section className="wrap section-y grid gap-8 lg:grid-cols-[minmax(0,1fr)_minmax(0,2.2fr)] lg:gap-14" aria-labelledby="faq-title">
        <div>
          <h2 id="faq-title" className="t-title">Preguntas frecuentes</h2>
          <p className="mt-3 max-w-xs text-[15px] leading-relaxed text-muted">
            Lo que suelen preguntar los agentes antes de contratar. Si falta la tuya,{" "}
            <Link href="/contacto" className="font-medium text-brand-700 underline underline-offset-4">
              escríbenos
            </Link>
            .
          </p>
        </div>
        <div className="border-b border-line">
          {faqs.map((f) => (
            <details key={f.q} className="group border-t border-line">
              <summary className="flex cursor-pointer list-none items-center justify-between gap-6 py-5 text-[1.0625rem] font-medium tracking-[-0.01em] [&::-webkit-details-marker]:hidden">
                {f.q}
                <ChevronDown className="h-5 w-5 shrink-0 text-muted transition-transform duration-300 group-open:rotate-180" aria-hidden />
              </summary>
              <p className="max-w-2xl pb-6 leading-relaxed text-muted">{f.a}</p>
            </details>
          ))}
        </div>
      </section>

      <p className="wrap pb-28 text-[14px] text-muted">
        Todos los planes funcionan mediante espacios activos y se rigen por las{" "}
        <Link href="/publica/condiciones" className="font-medium text-brand-700 underline underline-offset-4">
          condiciones de publicación
        </Link>
        .
      </p>
    </>
  );
}

function PlanCard({
  plan,
  wompiOn,
  avisosActivos,
  renovacion,
}: {
  plan: Plan;
  wompiOn: boolean;
  avisosActivos: boolean;
  renovacion: Renovacion | null;
}) {
  const eq = equivalencia(plan);
  return (
    <article
      className={cn(
        "relative flex flex-col rounded-[var(--radius-card)] border bg-white p-6",
        plan.destacado ? "border-ink" : "border-line",
      )}
    >
      {plan.destacado && <p className="mb-3 text-[13px] font-semibold text-brand-700">Recomendado</p>}
      <h3 className="text-[1.125rem] font-semibold tracking-[-0.01em]">{plan.nombre}</h3>
      <p className="tnum mt-3 text-[2rem] font-semibold leading-none tracking-[-0.03em]">{formatPrice(plan.precioCOP)}</p>
      <p className="mt-1.5 text-[13px] text-muted">{plan.periodo}</p>
      {eq && (
        <p className="mt-3 text-[13px] leading-relaxed text-ink-soft">
          ≈ <span className="tnum font-semibold">{formatPrice(eq.porInmuebleMes)}</span> por inmueble al mes
          {eq.mensualAnual != null && (
            <span className="text-muted"> · frente a {formatPrice(eq.mensualAnual)} pagando mes a mes</span>
          )}
        </p>
      )}
      {eq?.anual && (
        <p className="mt-1.5 text-[13px] leading-relaxed text-muted">
          o{" "}
          <a href="#plan-anual" className="font-medium text-brand-700 underline underline-offset-2">
            {formatPrice(eq.anual.precio)} al año
          </a>{" "}
          (≈ <span className="tnum">{formatPrice(eq.anual.porInmuebleMes)}</span> por inmueble al mes)
        </p>
      )}
      <p className="mt-4 text-[15px] leading-relaxed text-ink-soft">{plan.resumen}</p>

      <ul className="mt-5 flex-1">
        {plan.incluye.map((f) => (
          <li key={f} className="flex items-start gap-2.5 border-t border-line py-2.5 text-[14px] leading-snug text-ink-soft">
            <Check className="mt-0.5 h-4 w-4 flex-none text-brand-700" aria-hidden="true" />
            <span>{f}</span>
          </li>
        ))}
      </ul>

      <div className="mt-6">
        {wompiOn ? (
          <PlanCheckout
            planId={plan.id}
            planNombre={plan.nombre}
            precioCOP={plan.precioCOP}
            avisosActivos={avisosActivos}
            renovacion={renovacion ? { nombre: renovacion.nombre, email: renovacion.email, telefono: renovacion.telefono, token: renovacion.token } : undefined}
          />
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
