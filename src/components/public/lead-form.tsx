"use client";

import { useActionState } from "react";
import { CheckCircle2, Loader2 } from "lucide-react";
import { createLeadAction, type LeadFormState } from "@/lib/actions/leads";
import type { LeadIntent, LeadType } from "@/lib/domain";

const initialState: LeadFormState = { status: "idle" };

const inputClass =
  "h-11 w-full rounded-lg border border-slate-300 px-3 text-sm focus:border-brand-500 focus:outline-none focus:ring-2 focus:ring-brand-200";

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

  if (state.status === "success") {
    return (
      <div className="flex flex-col items-center gap-2 rounded-xl border border-emerald-200 bg-emerald-50 p-6 text-center">
        <CheckCircle2 className="h-10 w-10 text-emerald-600" />
        <p className="font-semibold text-emerald-900">{state.message}</p>
        <p className="text-sm text-emerald-700">Revisaremos tu solicitud y te escribiremos muy pronto.</p>
      </div>
    );
  }

  const isSeller = variant === "vendedor";

  return (
    <form action={formAction} className="space-y-3">
      <input type="hidden" name="tipo" value={tipo} />
      <input type="hidden" name="fuente" value="web" />
      {intencion && <input type="hidden" name="intencion" value={intencion} />}
      {propertyId && <input type="hidden" name="propertyId" value={propertyId} />}
      {propertySlug && <input type="hidden" name="propertySlug" value={propertySlug} />}
      {/* Honeypot anti-spam (oculto) */}
      <input
        type="text"
        name="website"
        tabIndex={-1}
        autoComplete="off"
        className="hidden"
        aria-hidden="true"
      />

      <div>
        <input name="nombre" placeholder="Tu nombre *" className={inputClass} required />
        {state.errors?.nombre && <p className="mt-1 text-xs text-rose-600">{state.errors.nombre}</p>}
      </div>

      <div className="grid gap-3 sm:grid-cols-2">
        <div>
          <input
            name="telefono"
            type="tel"
            inputMode="tel"
            placeholder="WhatsApp / teléfono *"
            className={inputClass}
            required
          />
          {state.errors?.telefono && (
            <p className="mt-1 text-xs text-rose-600">{state.errors.telefono}</p>
          )}
        </div>
        <div>
          <input name="email" type="email" placeholder="Correo (opcional)" className={inputClass} />
          {state.errors?.email && <p className="mt-1 text-xs text-rose-600">{state.errors.email}</p>}
        </div>
      </div>

      {isSeller && (
        <div className="grid gap-3 sm:grid-cols-2">
          <input name="ciudad" placeholder="Ciudad del inmueble" className={inputClass} />
          <input name="tipoInmueble" placeholder="Tipo (apto, casa, lote...)" className={inputClass} />
        </div>
      )}

      {!isSeller && intencion === "visita" && (
        <input
          name="preferencia"
          placeholder="¿Qué día/hora te gustaría visitarlo? (opcional)"
          className={inputClass}
        />
      )}

      <textarea
        name="mensaje"
        rows={isSeller ? 3 : 2}
        placeholder={isSeller ? "Cuéntanos sobre tu inmueble (opcional)" : "Mensaje (opcional)"}
        className="w-full rounded-lg border border-slate-300 px-3 py-2 text-sm focus:border-brand-500 focus:outline-none focus:ring-2 focus:ring-brand-200"
      />

      {state.status === "error" && state.message && (
        <p className="text-sm text-rose-600">{state.message}</p>
      )}

      <button
        type="submit"
        disabled={isPending}
        className="inline-flex h-12 w-full items-center justify-center gap-2 rounded-lg bg-accent-500 px-6 font-semibold text-brand-950 transition-colors hover:bg-accent-600 disabled:opacity-60"
      >
        {isPending && <Loader2 className="h-4 w-4 animate-spin" />}
        {submitLabel ?? (isSeller ? "Quiero vender mi inmueble" : "Enviar solicitud")}
      </button>
      <p className="text-center text-xs text-slate-400">
        Al enviar aceptas ser contactado por CIC Inmuebles. No compartimos tus datos.
      </p>
    </form>
  );
}
