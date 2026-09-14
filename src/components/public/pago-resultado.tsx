import Link from "next/link";
import { CheckCircle2, Clock, MessageCircle, RefreshCw, XCircle, type LucideIcon } from "lucide-react";
import { buttonVariants } from "@/components/ui/button";
import type { Plan } from "@/lib/config/plans";
import { siteConfig, whatsappLink } from "@/lib/config/site";
import { formatPrice } from "@/lib/utils/format";
import { cn } from "@/lib/utils/cn";

/**
 * Pantalla de retorno de la pasarela. Es una vista propia, no un aviso sobre
 * la página de planes: quien acaba de pagar necesita saber qué pasó, cuánto se
 * cobró, por qué plan, y qué viene ahora — no volver a ver los seis planes.
 */

export type PagoEstadoVisible = "APPROVED" | "PENDING" | "DECLINED" | "VOIDED" | "ERROR" | "DESCONOCIDO";

export interface PagoResultadoProps {
  estado: PagoEstadoVisible;
  plan?: Plan;
  amountInCents?: number;
  reference?: string;
  /** URL actual, para "Actualizar estado" (vuelve a consultar la API). */
  actualUrl: string;
}

type Tono = "ok" | "espera" | "error";

interface Contenido {
  tono: Tono;
  icono: LucideIcon;
  titulo: string;
  lead: string;
  pasosTitulo: string;
  pasos: string[];
}

const CONTENIDO: Record<PagoEstadoVisible, Contenido> = {
  APPROVED: {
    tono: "ok",
    icono: CheckCircle2,
    titulo: "Pago aprobado",
    lead: "Wompi confirmó tu pago y ya quedó registrado en CIC.",
    pasosTitulo: "Qué sigue",
    pasos: [
      "Te contactamos al correo o teléfono que dejaste en la pasarela.",
      "Nos envías las fotos y los datos del inmueble.",
      "Creamos la ficha, la activamos y te enviamos el enlace publicado.",
    ],
  },
  PENDING: {
    tono: "espera",
    icono: Clock,
    titulo: "Pago en proceso",
    lead: "Wompi aún está confirmando la transacción. No es necesario pagar de nuevo.",
    pasosTitulo: "Qué sigue",
    pasos: [
      "Tu banco o medio de pago confirma la transacción (PSE puede tardar unos minutos).",
      "Cuando quede aprobada, te contactamos para crear la ficha.",
      "Si en unas horas no tienes noticias, escríbenos con la referencia.",
    ],
  },
  DECLINED: {
    tono: "error",
    icono: XCircle,
    titulo: "Pago rechazado",
    lead: "El medio de pago rechazó la transacción. No se hizo ningún cobro.",
    pasosTitulo: "Qué puedes hacer",
    pasos: [
      "Intentar con otro medio: tarjeta, PSE o Nequi.",
      "Revisar el cupo o saldo y los datos de la tarjeta.",
      "Si el problema sigue, escríbenos y lo resolvemos por WhatsApp.",
    ],
  },
  VOIDED: {
    tono: "error",
    icono: XCircle,
    titulo: "Pago anulado",
    lead: "La transacción fue anulada y no quedó cobrada. Si no fuiste tú, escríbenos.",
    pasosTitulo: "Qué puedes hacer",
    pasos: [
      "Volver a los planes e intentar el pago de nuevo.",
      "Si no reconoces esta anulación, escríbenos con la referencia.",
    ],
  },
  ERROR: {
    tono: "error",
    icono: XCircle,
    titulo: "Error en el pago",
    lead: "La pasarela reportó un error y la transacción no se completó. No se hizo ningún cobro.",
    pasosTitulo: "Qué puedes hacer",
    pasos: [
      "Intentar de nuevo en un momento, con el mismo u otro medio de pago.",
      "Si el error se repite, escríbenos y te ayudamos a completarlo.",
    ],
  },
  DESCONOCIDO: {
    tono: "espera",
    icono: Clock,
    titulo: "Recibimos tu solicitud de pago",
    lead: "No pudimos confirmar la transacción en este momento. La verificamos en las próximas horas y te contactamos.",
    pasosTitulo: "Qué sigue",
    pasos: [
      "Guarda la referencia de esta página.",
      "Puedes actualizar el estado en unos minutos.",
      "Si pagaste y en unas horas no tienes noticias, escríbenos con la referencia.",
    ],
  },
};

const TONO: Record<Tono, { anillo: string; icono: string; borde: string }> = {
  ok: { anillo: "bg-brand-50", icono: "text-brand-700", borde: "border-brand-200" },
  espera: { anillo: "bg-amber-50", icono: "text-amber-700", borde: "border-amber-200" },
  error: { anillo: "bg-rose-50", icono: "text-rose-700", borde: "border-rose-200" },
};

export function PagoResultado({ estado, plan, amountInCents, reference, actualUrl }: PagoResultadoProps) {
  const c = CONTENIDO[estado];
  const t = TONO[c.tono];
  const Icono = c.icono;
  const monto = amountInCents != null ? formatPrice(Math.round(amountInCents / 100)) : plan ? formatPrice(plan.precioCOP) : null;
  const refTxt = reference ? ` (ref. ${reference})` : "";
  const planTxt = plan ? ` el plan "${plan.nombre}"` : " un plan de publicación";

  const mensajeWa =
    estado === "APPROVED"
      ? `Hola ${siteConfig.name}, acabo de pagar${planTxt}${refTxt}. Quiero enviar los datos de mi inmueble.`
      : `Hola ${siteConfig.name}, hice un pago de publicación${refTxt} y tengo una duda.`;

  return (
    <section
      aria-labelledby="pago-titulo"
      className={cn(
        "animate-rise mx-auto max-w-2xl rounded-[1.6rem] border bg-white p-6 shadow-[0_24px_60px_-36px_rgba(11,26,21,0.35)] sm:p-8",
        t.borde,
      )}
    >
      <span className={cn("flex h-14 w-14 items-center justify-center rounded-full", t.anillo, t.icono)}>
        <Icono className="h-7 w-7" aria-hidden="true" />
      </span>
      <h1 id="pago-titulo" className="mt-5 text-balance text-3xl font-bold tracking-tight text-ink sm:text-4xl">
        {c.titulo}
      </h1>
      <p className="mt-3 text-lg leading-relaxed text-muted">{c.lead}</p>

      {(plan || monto || reference) && (
        <dl className="mt-6 grid gap-x-6 gap-y-3 rounded-2xl bg-surface px-5 py-4 text-sm sm:grid-cols-[auto_1fr] sm:gap-y-2">
          {plan && (
            <>
              <dt className="font-medium text-muted">Plan</dt>
              <dd className="font-semibold text-ink">
                {plan.nombre} <span className="font-normal text-muted">· {plan.periodo}</span>
              </dd>
            </>
          )}
          {monto && (
            <>
              <dt className="font-medium text-muted">{estado === "APPROVED" ? "Cobrado" : "Monto"}</dt>
              <dd className="font-semibold tabular-nums text-ink">{monto}</dd>
            </>
          )}
          {reference && (
            <>
              <dt className="font-medium text-muted">Referencia</dt>
              <dd>
                <code className="rounded-md bg-white px-1.5 py-0.5 font-mono text-[13px] text-ink-soft ring-1 ring-line">
                  {reference}
                </code>
              </dd>
            </>
          )}
        </dl>
      )}

      <h2 className="mt-8 text-base font-bold tracking-tight text-ink">{c.pasosTitulo}</h2>
      <ol className="mt-3 space-y-2.5">
        {c.pasos.map((paso, i) => (
          <li key={paso} className="flex gap-3 text-sm leading-relaxed text-ink-soft">
            <span
              className={cn(
                "flex h-6 w-6 flex-none items-center justify-center rounded-full text-xs font-bold tabular-nums",
                t.anillo,
                t.icono,
              )}
            >
              {i + 1}
            </span>
            <span className="pt-0.5">{paso}</span>
          </li>
        ))}
      </ol>

      <div className="mt-8 flex flex-col gap-3 sm:flex-row">
        {estado === "APPROVED" && (
          <>
            <a
              href={whatsappLink(mensajeWa)}
              target="_blank"
              rel="noopener noreferrer"
              className={buttonVariants({ variant: "whatsapp", size: "lg", className: "sm:flex-1" })}
            >
              <MessageCircle className="h-5 w-5" aria-hidden="true" /> Enviar los datos por WhatsApp
            </a>
            <Link href="/" className={buttonVariants({ variant: "outline", size: "lg" })}>
              Volver al inicio
            </Link>
          </>
        )}
        {(estado === "PENDING" || estado === "DESCONOCIDO") && (
          <>
            <Link href={actualUrl} className={buttonVariants({ variant: "primary", size: "lg", className: "sm:flex-1" })}>
              <RefreshCw className="h-4 w-4" aria-hidden="true" /> Actualizar estado
            </Link>
            <a
              href={whatsappLink(mensajeWa)}
              target="_blank"
              rel="noopener noreferrer"
              className={buttonVariants({ variant: "outline", size: "lg" })}
            >
              <MessageCircle className="h-4 w-4" aria-hidden="true" /> Escribir por WhatsApp
            </a>
          </>
        )}
        {(estado === "DECLINED" || estado === "VOIDED" || estado === "ERROR") && (
          <>
            <Link href="/publica/agente#planes" className={buttonVariants({ variant: "primary", size: "lg", className: "sm:flex-1" })}>
              <RefreshCw className="h-4 w-4" aria-hidden="true" /> Intentar de nuevo
            </Link>
            <a
              href={whatsappLink(mensajeWa)}
              target="_blank"
              rel="noopener noreferrer"
              className={buttonVariants({ variant: "outline", size: "lg" })}
            >
              <MessageCircle className="h-4 w-4" aria-hidden="true" /> Necesito ayuda
            </a>
          </>
        )}
      </div>
    </section>
  );
}
