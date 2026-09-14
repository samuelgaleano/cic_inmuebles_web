"use client";

import { useActionState, useEffect, useId, useRef } from "react";
import { CheckCircle2, Loader2, MessageCircle } from "lucide-react";
import { createLeadAction, type LeadFormState } from "@/lib/actions/leads";
import { buttonVariants } from "@/components/ui/button";
import type { LeadIntent, LeadType } from "@/lib/domain";

const initialState: LeadFormState = { status: "idle" };

// 16px en móvil: por debajo de eso iOS Safari hace zoom al enfocar el campo.
const inputClass =
  "h-11 w-full rounded-xl border border-line bg-surface px-3.5 text-base text-ink transition-colors focus:border-brand-500 focus:bg-white focus:outline-none focus:ring-2 focus:ring-brand-200 aria-[invalid=true]:border-rose-400 aria-[invalid=true]:bg-rose-50/40 sm:text-sm";

interface LeadFormProps {
  tipo: LeadType;
  intencion?: LeadIntent;
  propertyId?: string;
  propertySlug?: string;
  variant?: "comprador" | "vendedor";
  submitLabel?: string;
}

export function LeadForm({
  tipo,
  intencion,
  propertyId,
  propertySlug,
  variant = "comprador",
  submitLabel,
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
        className="flex flex-col items-center gap-3 rounded-2xl border border-brand-200 bg-brand-50 p-6 text-center focus:outline-none"
      >
        <span className="flex h-12 w-12 items-center justify-center rounded-full bg-white text-brand-700 shadow-[0_10px_24px_-12px_rgba(4,125,91,0.5)]">
          <CheckCircle2 className="h-7 w-7" />
        </span>
        <p className="font-semibold text-brand-900">{state.message}</p>
        <p className="text-sm text-brand-800">
          Continúa la conversación por WhatsApp para coordinar más rápido.
        </p>
        {state.whatsappUrl && (
          <a
            href={state.whatsappUrl}
            target="_blank"
            rel="noopener noreferrer"
            className={buttonVariants({ variant: "whatsapp", size: "lg", className: "mt-1" })}
          >
            <MessageCircle className="h-5 w-5" /> Continuar en WhatsApp
          </a>
        )}
      </div>
    );
  }

  const isSeller = variant === "vendedor";
  const err = (field: string) => state.errors?.[field];
  const val = (field: keyof NonNullable<LeadFormState["values"]>) => state.values?.[field];

  return (
    <form ref={formRef} action={formAction} className="space-y-3">
      <input type="hidden" name="tipo" value={tipo} />
      <input type="hidden" name="fuente" value="web" />
      {intencion && <input type="hidden" name="intencion" value={intencion} />}
      {propertyId && <input type="hidden" name="propertyId" value={propertyId} />}
      {propertySlug && <input type="hidden" name="propertySlug" value={propertySlug} />}
      {/* Honeypot anti-spam (oculto) */}
      <input type="text" name="website" tabIndex={-1} autoComplete="off" className="hidden" aria-hidden="true" />

      <div>
        <label htmlFor={`${formId}-nombre`} className="mb-1.5 block text-sm font-medium text-ink-soft">
          Nombre <span className="text-rose-600">*</span>
        </label>
        <input
          id={`${formId}-nombre`}
          name="nombre"
          autoComplete="name"
          placeholder="Tu nombre"
          className={inputClass}
          required
          maxLength={120}
          defaultValue={val("nombre")}
          aria-invalid={Boolean(err("nombre"))}
          aria-describedby={err("nombre") ? `${formId}-nombre-err` : undefined}
        />
        {err("nombre") && (
          <p id={`${formId}-nombre-err`} className="mt-1 text-xs font-medium text-rose-700">{err("nombre")}</p>
        )}
      </div>

      <div className="grid gap-3 sm:grid-cols-2">
        <div>
          <label htmlFor={`${formId}-tel`} className="mb-1.5 block text-sm font-medium text-ink-soft">
            WhatsApp / teléfono <span className="text-rose-600">*</span>
          </label>
          <input
            id={`${formId}-tel`}
            name="telefono"
            type="tel"
            inputMode="tel"
            autoComplete="tel"
            placeholder="Ej. 300 123 4567"
            className={inputClass}
            required
            maxLength={20}
            defaultValue={val("telefono")}
            aria-invalid={Boolean(err("telefono"))}
            aria-describedby={err("telefono") ? `${formId}-tel-err` : undefined}
          />
          {err("telefono") && (
            <p id={`${formId}-tel-err`} className="mt-1 text-xs font-medium text-rose-700">{err("telefono")}</p>
          )}
        </div>
        <div>
          <label htmlFor={`${formId}-email`} className="mb-1.5 block text-sm font-medium text-ink-soft">
            Correo (opcional)
          </label>
          <input
            id={`${formId}-email`}
            name="email"
            type="email"
            autoComplete="email"
            placeholder="tucorreo@ejemplo.com"
            className={inputClass}
            maxLength={160}
            defaultValue={val("email")}
            aria-invalid={Boolean(err("email"))}
            aria-describedby={err("email") ? `${formId}-email-err` : undefined}
          />
          {err("email") && (
            <p id={`${formId}-email-err`} className="mt-1 text-xs font-medium text-rose-700">{err("email")}</p>
          )}
        </div>
      </div>

      {isSeller && (
        <div className="grid gap-3 sm:grid-cols-2">
          <div>
            <label htmlFor={`${formId}-ciudad`} className="mb-1.5 block text-sm font-medium text-ink-soft">Ciudad del inmueble</label>
            <input
              id={`${formId}-ciudad`}
              name="ciudad"
              autoComplete="address-level2"
              placeholder="Ciudad"
              className={inputClass}
              maxLength={120}
              defaultValue={val("ciudad")}
            />
          </div>
          <div>
            <label htmlFor={`${formId}-tipoInmueble`} className="mb-1.5 block text-sm font-medium text-ink-soft">Tipo de inmueble</label>
            <input
              id={`${formId}-tipoInmueble`}
              name="tipoInmueble"
              placeholder="Apto, casa, lote..."
              className={inputClass}
              maxLength={120}
              defaultValue={val("tipoInmueble")}
            />
          </div>
        </div>
      )}

      {!isSeller && intencion === "visita" && (
        <div>
          <label htmlFor={`${formId}-pref`} className="mb-1.5 block text-sm font-medium text-ink-soft">
            ¿Qué día/hora te gustaría visitarlo? (opcional)
          </label>
          <input
            id={`${formId}-pref`}
            name="preferencia"
            placeholder="Ej. sábado en la mañana"
            className={inputClass}
            maxLength={200}
            defaultValue={val("preferencia")}
          />
        </div>
      )}

      <div>
        <label htmlFor={`${formId}-msg`} className="mb-1.5 block text-sm font-medium text-ink-soft">
          Mensaje (opcional)
        </label>
        <textarea
          id={`${formId}-msg`}
          name="mensaje"
          rows={isSeller ? 3 : 2}
          maxLength={1000}
          defaultValue={val("mensaje")}
          placeholder={isSeller ? "Cuéntanos sobre tu inmueble" : "¿En qué te ayudamos?"}
          className="w-full rounded-xl border border-line bg-surface px-3.5 py-2.5 text-base text-ink transition-colors focus:border-brand-500 focus:bg-white focus:outline-none focus:ring-2 focus:ring-brand-200 sm:text-sm"
        />
      </div>

      <p id={`${formId}-status`} aria-live="polite" className="min-h-0">
        {state.status === "error" && state.message && (
          <span className="text-sm font-medium text-rose-700">{state.message}</span>
        )}
      </p>

      <button
        type="submit"
        disabled={isPending}
        aria-busy={isPending}
        className={buttonVariants({ variant: "primary", size: "lg", className: "w-full" })}
      >
        {isPending && <Loader2 className="h-4 w-4 animate-spin" aria-hidden="true" />}
        {isPending ? "Enviando…" : (submitLabel ?? (isSeller ? "Quiero vender mi inmueble" : "Enviar y abrir WhatsApp"))}
      </button>
      <p className="text-center text-xs text-muted">
        Al enviar, registramos tu solicitud y abrimos WhatsApp para contactarte. No compartimos tus datos.
      </p>
    </form>
  );
}
