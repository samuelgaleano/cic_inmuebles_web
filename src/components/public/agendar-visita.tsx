"use client";

import { useMemo, useState, useSyncExternalStore } from "react";
import { MessageCircle } from "lucide-react";
import { buttonVariants } from "@/components/ui/button";
import { siteConfig, whatsappLink } from "@/lib/config/site";
import { componerPreferencia, FRANJAS, proximosDias, type DiaVisita, type FranjaId } from "@/lib/ficha/visitas";
import { cn } from "@/lib/utils/cn";
import { LeadForm } from "./lead-form";

type Modo = "visita" | "info";

/**
 * Tarjeta de contacto de la ficha. "Agendar visita" deja elegir un día (los
 * próximos 10) y una franja; esa preferencia viaja estructurada al equipo y en
 * el mensaje de WhatsApp. No es una reserva: el asesor confirma el horario.
 */
export function AgendarVisita({
  propertyId,
  propertySlug,
  titulo,
  codigo,
  url,
  precio,
  vendido = false,
}: {
  propertyId: string;
  propertySlug: string;
  titulo: string;
  codigo: string;
  url: string;
  precio: string;
  /** Ya se vendió: no hay visita que agendar, solo pedir información de opciones parecidas. */
  vendido?: boolean;
}) {
  const [modoElegido, setModo] = useState<Modo>("visita");
  const modo: Modo = vendido ? "info" : modoElegido;
  const [dia, setDia] = useState<DiaVisita | undefined>();
  const [franja, setFranja] = useState<FranjaId | undefined>();

  // El calendario se calcula en el navegador: así "mañana" es el mañana real del visitante aunque la
  // página venga de la caché del servidor. useSyncExternalStore da "" en el servidor y la hora actual
  // (cubo de una hora) en el cliente, sin descuadrar la hidratación.
  const horaActual = useSyncExternalStore(
    () => () => {},
    () => String(Math.floor(Date.now() / 3_600_000)),
    () => "",
  );
  const dias = useMemo(() => (horaActual ? proximosDias(new Date(Number(horaActual) * 3_600_000), 10) : []), [horaActual]);

  const preferencia = useMemo(() => componerPreferencia(dia, franja), [dia, franja]);

  const mensajeWhatsapp =
    `Hola ${siteConfig.name}, me interesa «${titulo}» (${codigo}).` +
    (modo === "visita" && preferencia ? ` Me gustaría visitarlo: ${preferencia}.` : "") +
    ` ${url}`;

  return (
    <section id="visita" aria-labelledby="visita-titulo" className="scroll-mt-24 rounded-[var(--radius-card)] border border-line bg-white p-6">
      <h2 id="visita-titulo" className="text-[1.375rem] font-semibold tracking-[-0.02em]">
        {vendido ? "Ya se vendió" : "¿Te interesa?"}
      </h2>
      <p className="tnum mt-1 text-[15px] text-muted">
        {vendido ? "Pídenos opciones parecidas y te avisamos cuando llegue una." : `${titulo} · ${precio}`}
      </p>

      {!vendido && <div role="tablist" aria-label="Qué quieres hacer" className="mt-5 grid grid-cols-2 rounded-full bg-surface p-1">
        {(
          [
            ["visita", "Agendar visita"],
            ["info", "Pedir información"],
          ] as const
        ).map(([id, etiqueta]) => (
          <button
            key={id}
            type="button"
            role="tab"
            aria-selected={modo === id}
            onClick={() => setModo(id)}
            className={cn(
              "h-10 rounded-full text-[14px] font-medium transition-colors duration-200",
              modo === id ? "bg-white text-ink shadow-[0_1px_2px_rgb(11_26_21/0.12)]" : "text-muted hover:text-ink",
            )}
          >
            {etiqueta}
          </button>
        ))}
      </div>}

      {modo === "visita" && (
        <div className="mt-6">
          <fieldset className="min-w-0">
            <legend className="text-[14px] font-medium">¿Qué día te queda bien?</legend>
            <div className="-mx-1 mt-3 flex gap-2 overflow-x-auto px-1 pb-1 [scrollbar-width:none] [&::-webkit-scrollbar]:hidden">
              {dias.length === 0
                ? Array.from({ length: 5 }, (_, i) => <span key={i} className="h-[4.25rem] w-[3.75rem] shrink-0 rounded-2xl bg-surface" aria-hidden />)
                : dias.map((d) => {
                    const activo = dia?.iso === d.iso;
                    return (
                      <button
                        key={d.iso}
                        type="button"
                        aria-pressed={activo}
                        aria-label={d.largo}
                        onClick={() => setDia(activo ? undefined : d)}
                        className={cn(
                          "flex h-[4.25rem] w-[3.75rem] shrink-0 flex-col items-center justify-center rounded-2xl border transition-colors duration-200",
                          activo ? "border-ink bg-ink text-white" : "border-line-strong bg-white text-ink hover:border-ink",
                        )}
                      >
                        <span className={cn("text-[12px] capitalize", activo ? "text-white/75" : "text-muted")}>{d.corto}</span>
                        <span className="tnum text-[1.25rem] font-semibold leading-tight">{d.dia}</span>
                        <span className={cn("text-[11px] capitalize", activo ? "text-white/75" : "text-muted")}>{d.mes}</span>
                      </button>
                    );
                  })}
            </div>
          </fieldset>

          <fieldset className="mt-5 min-w-0">
            <legend className="text-[14px] font-medium">¿A qué hora?</legend>
            <div className="mt-3 flex flex-wrap gap-2">
              {FRANJAS.map((f) => (
                <button
                  key={f.id}
                  type="button"
                  aria-pressed={franja === f.id}
                  onClick={() => setFranja(franja === f.id ? undefined : f.id)}
                  className={cn(
                    "h-10 rounded-full border px-4 text-[14px] font-medium transition-colors duration-200",
                    franja === f.id ? "border-ink bg-ink text-white" : "border-line-strong bg-white text-ink hover:border-ink",
                  )}
                >
                  {f.etiqueta}
                </button>
              ))}
            </div>
          </fieldset>

          <p className="mt-4 min-h-5 text-[14px] text-brand-800" aria-live="polite">
            {preferencia ? <>Preferencia: <span className="font-medium">{preferencia}</span></> : ""}
          </p>
        </div>
      )}

      <div className="mt-5">
        {/* key: al cambiar de modo o de preferencia el formulario se reinicia con lo nuevo */}
        <LeadForm
          key={`${modo}-${preferencia}`}
          tipo="comprador"
          intencion={modo}
          propertyId={propertyId}
          propertySlug={propertySlug}
          preferencia={modo === "visita" ? preferencia || undefined : undefined}
          sinPreferenciaLibre
          submitLabel={modo === "visita" ? "Solicitar visita" : "Quiero más información"}
        />
        {modo === "visita" && (
          <p className="mt-3 text-center text-[13px] leading-snug text-muted">
            Es una solicitud, no una reserva: un asesor te confirma el horario por WhatsApp.
          </p>
        )}
      </div>

      <div className="mt-5 flex items-center gap-3">
        <span className="h-px flex-1 bg-line" />
        <span className="text-[13px] text-muted">o</span>
        <span className="h-px flex-1 bg-line" />
      </div>

      <a
        href={whatsappLink(mensajeWhatsapp)}
        target="_blank"
        rel="noopener noreferrer"
        className={buttonVariants({ variant: "outline", size: "lg", className: "mt-5 w-full" })}
      >
        <MessageCircle className="h-5 w-5 text-[#1a9e4f]" aria-hidden />
        Escribir por WhatsApp
      </a>
    </section>
  );
}
