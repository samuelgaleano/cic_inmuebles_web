"use client";

import { useActionState, useEffect, useId, useRef } from "react";
import { CheckCircle2, Loader2, MessageCircle } from "lucide-react";
import { createLeadAction, type LeadFormState } from "@/lib/actions/leads";
import { buttonVariants } from "@/components/ui/button";
import type { LeadIntent, LeadType } from "@/lib/domain";
import { cn } from "@/lib/utils/cn";

const initialState: LeadFormState = { status: "idle" };

// 16 px: por debajo de eso iOS Safari hace zoom al enfocar el campo. Borde de 3,4:1 (WCAG 1.4.11).
const campo =
  "w-full rounded-[var(--radius-field)] border border-field bg-white px-4 text-base text-ink transition-[border-color,box-shadow] duration-200 focus:border-brand-700 focus:outline-none focus:ring-4 focus:ring-brand-700/15 aria-[invalid=true]:border-rose-600";
const etiqueta = "mb-1.5 block text-[14px] font-medium text-ink";

interface LeadFormProps {
  tipo: LeadType;
  intencion?: LeadIntent;
  propertyId?: string;
  propertySlug?: string;
  variant?: "comprador" | "vendedor";
  submitLabel?: string;
  /** Preferencia de visita ya elegida (día y franja): viaja oculta, estructurada. */
  preferencia?: string;
  /** El día y la franja se eligen aparte (chips): no mostrar el campo de texto libre. */
  sinPreferenciaLibre?: boolean;
  className?: string;
}

export function LeadForm({
  tipo,
  intencion,
  propertyId,
  propertySlug,
  variant = "comprador",
  submitLabel,
  preferencia,
  sinPreferenciaLibre,
  className,
}: LeadFormProps) {
  const [state, formAction, isPending] = useActionState(createLeadAction, initialState);
  const formId = useId();
  const formRef = useRef<HTMLFormElement>(null);
  const successRef = useRef<HTMLDivElement>(null);

  // Click-to-chat: al registrar el lead, abrimos WhatsApp con el mensaje listo.
  // Si el navegador bloquea la ventana, el botón "Continuar en WhatsApp" queda
  // como respaldo y el foco aterriza en la confirmación para que se lea.
  useEffect(() => {
    if (state.status === "success") {
      if (state.whatsappUrl) window.open(state.whatsappUrl, "_blank", "noopener,noreferrer");
      successRef.current?.focus();
    }
  }, [state]);

  // Tras un error, el foco va al primer campo marcado: el mensaje general ya lo
  // anuncia la región viva, pero el usuario necesita saber CUÁL corregir.
  useEffect(() => {
    if (state.status !== "error") return;
    const first = formRef.current?.querySelector<HTMLElement>('[aria-invalid="true"]');
    (first ?? formRef.current?.querySelector<HTMLElement>("input:not([type=hidden])"))?.focus();
  }, [state]);

  if (state.status === "success") {
    return (
      <div
        ref={successRef}
        tabIndex={-1}
        role="status"
        className="rounded-[var(--radius-card)] bg-surface p-6 text-center focus:outline-none"
      >
        <CheckCircle2 className="mx-auto h-9 w-9 text-brand-700" aria-hidden />
        <p className="mt-3 text-[1.125rem] font-semibold tracking-[-0.01em]">{state.message}</p>
        <p className="mt-1 text-[15px] text-muted">
          Un asesor te contacta para confirmar. Si quieres, adelanta la conversación por WhatsApp.
        </p>
        {state.whatsappUrl && (
          <a
            href={state.whatsappUrl}
            target="_blank"
            rel="noopener noreferrer"
            className={buttonVariants({ variant: "whatsapp", size: "lg", className: "mt-5" })}
          >
            <MessageCircle className="h-5 w-5" aria-hidden /> Continuar en WhatsApp
          </a>
        )}
      </div>
    );
  }

  const isSeller = variant === "vendedor";
  const err = (field: string) => state.errors?.[field];
  const val = (field: keyof NonNullable<LeadFormState["values"]>) => state.values?.[field];

  return (
    <form ref={formRef} action={formAction} className={cn("space-y-4", className)}>
      <input type="hidden" name="tipo" value={tipo} />
      <input type="hidden" name="fuente" value="web" />
      {intencion && <input type="hidden" name="intencion" value={intencion} />}
      {propertyId && <input type="hidden" name="propertyId" value={propertyId} />}
      {propertySlug && <input type="hidden" name="propertySlug" value={propertySlug} />}
      {preferencia && <input type="hidden" name="preferencia" value={preferencia} />}
      {/* Honeypot anti-spam (oculto) */}
      <input type="text" name="website" tabIndex={-1} autoComplete="off" className="hidden" aria-hidden="true" />

      <div>
        <label htmlFor={`${formId}-nombre`} className={etiqueta}>Nombre</label>
        <input
          id={`${formId}-nombre`}
          name="nombre"
          autoComplete="name"
          className={cn(campo, "h-12")}
          required
          maxLength={120}
          defaultValue={val("nombre")}
          aria-invalid={Boolean(err("nombre"))}
          aria-describedby={err("nombre") ? `${formId}-nombre-err` : undefined}
        />
        {err("nombre") && (
          <p id={`${formId}-nombre-err`} className="mt-1.5 text-[13px] font-medium text-rose-700">{err("nombre")}</p>
        )}
      </div>

      <div className="grid gap-4 sm:grid-cols-2">
        <div>
          <label htmlFor={`${formId}-tel`} className={etiqueta}>WhatsApp o teléfono</label>
          <input
            id={`${formId}-tel`}
            name="telefono"
            type="tel"
            inputMode="tel"
            autoComplete="tel"
            placeholder="300 123 4567"
            className={cn(campo, "tnum h-12")}
            required
            maxLength={20}
            defaultValue={val("telefono")}
            aria-invalid={Boolean(err("telefono"))}
            aria-describedby={err("telefono") ? `${formId}-tel-err` : undefined}
          />
          {err("telefono") && (
            <p id={`${formId}-tel-err`} className="mt-1.5 text-[13px] font-medium text-rose-700">{err("telefono")}</p>
          )}
        </div>
        <div>
          <label htmlFor={`${formId}-email`} className={etiqueta}>
            Correo <span className="font-normal text-muted">(opcional)</span>
          </label>
          <input
            id={`${formId}-email`}
            name="email"
            type="email"
            autoComplete="email"
            className={cn(campo, "h-12")}
            maxLength={160}
            defaultValue={val("email")}
            aria-invalid={Boolean(err("email"))}
            aria-describedby={err("email") ? `${formId}-email-err` : undefined}
          />
          {err("email") && (
            <p id={`${formId}-email-err`} className="mt-1.5 text-[13px] font-medium text-rose-700">{err("email")}</p>
          )}
        </div>
      </div>

      {isSeller && (
        <div className="grid gap-4 sm:grid-cols-2">
          <div>
            <label htmlFor={`${formId}-ciudad`} className={etiqueta}>Ciudad del inmueble</label>
            <input
              id={`${formId}-ciudad`}
              name="ciudad"
              autoComplete="address-level2"
              className={cn(campo, "h-12")}
              maxLength={120}
              defaultValue={val("ciudad")}
            />
          </div>
          <div>
            <label htmlFor={`${formId}-tipoInmueble`} className={etiqueta}>Tipo de inmueble</label>
            <input
              id={`${formId}-tipoInmueble`}
              name="tipoInmueble"
              placeholder="Apartamento, casa, lote…"
              className={cn(campo, "h-12")}
              maxLength={120}
              defaultValue={val("tipoInmueble")}
            />
          </div>
        </div>
      )}

      {!isSeller && intencion === "visita" && !preferencia && !sinPreferenciaLibre && (
        <div>
          <label htmlFor={`${formId}-pref`} className={etiqueta}>
            ¿Qué día y hora te gustaría visitarlo? <span className="font-normal text-muted">(opcional)</span>
          </label>
          <input
            id={`${formId}-pref`}
            name="preferencia"
            placeholder="Ej. sábado en la mañana"
            className={cn(campo, "h-12")}
            maxLength={200}
            defaultValue={val("preferencia")}
          />
        </div>
      )}

      <div>
        <label htmlFor={`${formId}-msg`} className={etiqueta}>
          Mensaje <span className="font-normal text-muted">(opcional)</span>
        </label>
        <textarea
          id={`${formId}-msg`}
          name="mensaje"
          rows={isSeller ? 3 : 2}
          maxLength={1000}
          defaultValue={val("mensaje")}
          placeholder={isSeller ? "Cuéntanos sobre tu inmueble" : "¿En qué te ayudamos?"}
          className={cn(campo, "py-3")}
        />
      </div>

      <p id={`${formId}-status`} aria-live="polite" className="min-h-0">
        {state.status === "error" && state.message && (
          <span className="text-[14px] font-medium text-rose-700">{state.message}</span>
        )}
      </p>
      {/* Si lo que falló fue guardar la solicitud, el visitante no se queda sin salida. */}
      {state.status === "error" && state.whatsappUrl && (
        <a
          href={state.whatsappUrl}
          target="_blank"
          rel="noopener noreferrer"
          className={buttonVariants({ variant: "whatsapp", size: "md", className: "w-full" })}
        >
          <MessageCircle className="h-5 w-5" aria-hidden /> Escribir por WhatsApp
        </a>
      )}

      <button
        type="submit"
        disabled={isPending}
        aria-busy={isPending}
        className={buttonVariants({ variant: "primary", size: "lg", className: "w-full" })}
      >
        {isPending && <Loader2 className="h-4 w-4 animate-spin" aria-hidden="true" />}
        {isPending ? "Enviando…" : (submitLabel ?? (isSeller ? "Quiero vender mi inmueble" : "Enviar y abrir WhatsApp"))}
      </button>
      <p className="text-center text-[13px] leading-snug text-muted">
        Al enviar, registramos tu solicitud y abrimos WhatsApp para contactarte. No compartimos tus datos.
      </p>
    </form>
  );
}
