"use client";

import { useActionState, useEffect, useId } from "react";
import { CheckCircle2, Loader2, MessageCircle } from "lucide-react";
import { createLeadAction, type LeadFormState } from "@/lib/actions/leads";
import type { LeadIntent, LeadType } from "@/lib/domain";

const initialState: LeadFormState = { status: "idle" };

const inputClass =
  "h-11 w-full rounded-xl border border-line bg-surface px-3.5 text-sm text-ink transition-colors focus:border-brand-500 focus:bg-white focus:outline-none focus:ring-2 focus:ring-brand-200 aria-[invalid=true]:border-rose-400";

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

  // Click-to-chat: al registrar el lead, abrimos WhatsApp con el mensaje listo.
  useEffect(() => {
    if (state.status === "success" && state.whatsappUrl) {
      window.open(state.whatsappUrl, "_blank", "noopener,noreferrer");
    }
  }, [state]);

  if (state.status === "success") {
    return (
      <div role="status" className="flex flex-col items-center gap-3 rounded-xl border border-emerald-200 bg-emerald-50 p-6 text-center">
        <CheckCircle2 className="h-10 w-10 text-emerald-600" />
        <p className="font-semibold text-emerald-900">{state.message}</p>
        <p className="text-sm text-emerald-700">
          Continúa la conversación por WhatsApp para coordinar más rápido.
        </p>
        {state.whatsappUrl && (
          <a
            href={state.whatsappUrl}
            target="_blank"
            rel="noopener noreferrer"
            className="mt-1 inline-flex h-12 items-center justify-center gap-2 rounded-lg bg-[#25D366] px-6 font-semibold text-white hover:bg-[#1ebe5d]"
          >
            <MessageCircle className="h-5 w-5" /> Continuar en WhatsApp
          </a>
        )}
      </div>
    );
  }

  const isSeller = variant === "vendedor";
  const err = (field: string) => state.errors?.[field];

  return (
    <form action={formAction} className="space-y-3" aria-describedby={`${formId}-status`}>
      <input type="hidden" name="tipo" value={tipo} />
      <input type="hidden" name="fuente" value="web" />
      {intencion && <input type="hidden" name="intencion" value={intencion} />}
      {propertyId && <input type="hidden" name="propertyId" value={propertyId} />}
      {propertySlug && <input type="hidden" name="propertySlug" value={propertySlug} />}
      {/* Honeypot anti-spam (oculto) */}
      <input type="text" name="website" tabIndex={-1} autoComplete="off" className="hidden" aria-hidden="true" />

      <div>
        <label htmlFor={`${formId}-nombre`} className="mb-1.5 block text-sm font-medium text-ink-soft">
          Nombre <span className="text-rose-500">*</span>
        </label>
        <input
          id={`${formId}-nombre`}
          name="nombre"
          autoComplete="name"
          placeholder="Tu nombre"
          className={inputClass}
          required
          aria-invalid={Boolean(err("nombre"))}
          aria-describedby={err("nombre") ? `${formId}-nombre-err` : undefined}
        />
        {err("nombre") && (
          <p id={`${formId}-nombre-err`} className="mt-1 text-xs text-rose-600">{err("nombre")}</p>
        )}
      </div>

      <div className="grid gap-3 sm:grid-cols-2">
        <div>
          <label htmlFor={`${formId}-tel`} className="mb-1.5 block text-sm font-medium text-ink-soft">
            WhatsApp / teléfono <span className="text-rose-500">*</span>
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
            aria-invalid={Boolean(err("telefono"))}
            aria-describedby={err("telefono") ? `${formId}-tel-err` : undefined}
          />
          {err("telefono") && (
            <p id={`${formId}-tel-err`} className="mt-1 text-xs text-rose-600">{err("telefono")}</p>
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
            aria-invalid={Boolean(err("email"))}
            aria-describedby={err("email") ? `${formId}-email-err` : undefined}
          />
          {err("email") && (
            <p id={`${formId}-email-err`} className="mt-1 text-xs text-rose-600">{err("email")}</p>
          )}
        </div>
      </div>

      {isSeller && (
        <div className="grid gap-3 sm:grid-cols-2">
          <div>
            <label htmlFor={`${formId}-ciudad`} className="mb-1.5 block text-sm font-medium text-ink-soft">Ciudad del inmueble</label>
            <input id={`${formId}-ciudad`} name="ciudad" autoComplete="address-level2" placeholder="Ciudad" className={inputClass} />
          </div>
          <div>
            <label htmlFor={`${formId}-tipoInmueble`} className="mb-1.5 block text-sm font-medium text-ink-soft">Tipo de inmueble</label>
            <input id={`${formId}-tipoInmueble`} name="tipoInmueble" placeholder="Apto, casa, lote..." className={inputClass} />
          </div>
        </div>
      )}

      {!isSeller && intencion === "visita" && (
        <div>
          <label htmlFor={`${formId}-pref`} className="mb-1.5 block text-sm font-medium text-ink-soft">
            ¿Qué día/hora te gustaría visitarlo? (opcional)
          </label>
          <input id={`${formId}-pref`} name="preferencia" placeholder="Ej. sábado en la mañana" className={inputClass} />
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
          placeholder={isSeller ? "Cuéntanos sobre tu inmueble" : "¿En qué te ayudamos?"}
          className="w-full rounded-xl border border-line bg-surface px-3.5 py-2.5 text-sm text-ink transition-colors focus:border-brand-500 focus:bg-white focus:outline-none focus:ring-2 focus:ring-brand-200"
        />
      </div>

      <p id={`${formId}-status`} aria-live="polite" className="min-h-0">
        {state.status === "error" && state.message && (
          <span className="text-sm text-rose-600">{state.message}</span>
        )}
      </p>

      <button
        type="submit"
        disabled={isPending}
        className="inline-flex h-12 w-full items-center justify-center gap-2 rounded-xl bg-brand-700 px-6 font-semibold text-white shadow-[0_10px_26px_-10px_rgba(4,125,91,0.8)] transition-all duration-300 ease-[cubic-bezier(0.16,1,0.3,1)] hover:bg-brand-800 active:scale-[0.98] disabled:opacity-60"
      >
        {isPending && <Loader2 className="h-4 w-4 animate-spin" aria-hidden="true" />}
        {submitLabel ?? (isSeller ? "Quiero vender mi inmueble" : "Enviar y abrir WhatsApp")}
      </button>
      <p className="text-center text-xs text-slate-400">
        Al enviar, registramos tu solicitud y abrimos WhatsApp para contactarte. No compartimos tus datos.
      </p>
    </form>
  );
}
