"use client";

import { useActionState, useEffect, useId, useRef } from "react";
import { CheckCircle2, Loader2, MessageCircle } from "lucide-react";
import Link from "next/link";
import { buttonVariants } from "@/components/ui/button";
import { enviarDatosInmuebleAction } from "@/lib/actions/servicio-datos";
import { whatsappLink } from "@/lib/config/site";
import { PROPERTY_TYPE_LABELS, PROPERTY_TYPES } from "@/lib/domain/property";
import type { CampoDatos, DatosFormState } from "@/lib/servicios/datos";
import { cn } from "@/lib/utils/cn";

const initialState: DatosFormState = { status: "idle" };

const WHATSAPP = () => whatsappLink("Hola, ya pagué mi plan y quiero enviar los datos de mi inmueble.");

/** Si la pestaña quedó abierta durante un despliegue la acción ya no existe: se conserva lo escrito y queda WhatsApp. */
async function enviarConRespaldo(prev: DatosFormState, formData: FormData): Promise<DatosFormState> {
  try {
    return await enviarDatosInmuebleAction(prev, formData);
  } catch {
    const values: Partial<Record<CampoDatos, string>> = {};
    for (const [k, v] of formData.entries()) if (typeof v === "string" && v !== "" && k !== "t" && k !== "website") values[k as CampoDatos] = v;
    return { status: "error", message: "No pudimos enviar los datos: la página se actualizó mientras la llenabas. Recárgala y vuelve a enviar, o escríbenos por WhatsApp.", values };
  }
}

// Mismos campos que el formulario de leads: 16 px (sin zoom en iOS) y borde de 3,4:1.
const campo =
  "w-full rounded-[var(--radius-field)] border border-field bg-white px-4 text-base text-ink transition-[border-color,box-shadow] duration-200 focus:border-brand-700 focus:outline-none focus:ring-4 focus:ring-brand-700/15 aria-[invalid=true]:border-rose-600";
const etiqueta = "mb-1.5 block text-[14px] font-medium text-ink";

export function DatosInmuebleForm({ token }: { token: string }) {
  const [state, formAction, isPending] = useActionState(enviarConRespaldo, initialState);
  const id = useId();
  const formRef = useRef<HTMLFormElement>(null);
  const okRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    if (state.status === "success") okRef.current?.focus();
    if (state.status !== "error") return;
    const primero = formRef.current?.querySelector<HTMLElement>('[aria-invalid="true"]');
    primero?.focus();
  }, [state]);

  if (state.status === "success") {
    return (
      <div ref={okRef} tabIndex={-1} role="status" className="rounded-[var(--radius-card)] bg-surface p-6 text-center focus:outline-none">
        <CheckCircle2 className="mx-auto h-9 w-9 text-brand-700" aria-hidden />
        <p className="mt-3 text-[1.125rem] font-semibold tracking-[-0.01em]">¡Listo!</p>
        <p className="mt-1 text-[15px] text-muted">{state.message}</p>
        <a href={WHATSAPP()} target="_blank" rel="noopener noreferrer" className={buttonVariants({ variant: "whatsapp", size: "lg", className: "mt-5" })}>
          <MessageCircle className="h-5 w-5" aria-hidden /> Enviar las fotos por WhatsApp
        </a>
      </div>
    );
  }

  const err = (k: CampoDatos) => state.errors?.[k];
  const val = (k: CampoDatos) => state.values?.[k];
  const describir = (k: CampoDatos) => (err(k) ? `${id}-${k}-err` : undefined);
  const error = (k: CampoDatos) =>
    err(k) ? (
      <p id={`${id}-${k}-err`} className="mt-1.5 text-[13px] font-medium text-rose-700">
        {err(k)}
      </p>
    ) : null;

  return (
    <form ref={formRef} action={formAction} noValidate className="space-y-4">
      <input type="hidden" name="t" value={token} />
      {/* Honeypot anti-spam (oculto) */}
      <input type="text" name="website" tabIndex={-1} autoComplete="off" className="hidden" aria-hidden="true" />

      <div className="grid gap-4 sm:grid-cols-2">
        <div>
          <label htmlFor={`${id}-tipo`} className={etiqueta}>Tipo de inmueble</label>
          <select
            id={`${id}-tipo`}
            name="tipo"
            required
            defaultValue={val("tipo") ?? ""}
            className={cn(campo, "h-12")}
            aria-invalid={Boolean(err("tipo"))}
            aria-describedby={describir("tipo")}
          >
            <option value="" disabled>
              Elige uno
            </option>
            {PROPERTY_TYPES.map((t) => (
              <option key={t} value={t}>
                {PROPERTY_TYPE_LABELS[t]}
              </option>
            ))}
          </select>
          {error("tipo")}
        </div>
        <div>
          <label htmlFor={`${id}-precio`} className={etiqueta}>
            Precio <span className="font-normal text-muted">(opcional)</span>
          </label>
          <input
            id={`${id}-precio`}
            name="precio"
            inputMode="numeric"
            placeholder="350.000.000"
            maxLength={24}
            defaultValue={val("precio")}
            className={cn(campo, "tnum h-12")}
            aria-invalid={Boolean(err("precio"))}
            aria-describedby={describir("precio")}
          />
          {error("precio")}
        </div>
      </div>

      <div className="grid gap-4 sm:grid-cols-2">
        <div>
          <label htmlFor={`${id}-ciudad`} className={etiqueta}>Ciudad o municipio</label>
          <input
            id={`${id}-ciudad`}
            name="ciudad"
            required
            autoComplete="address-level2"
            maxLength={80}
            defaultValue={val("ciudad")}
            className={cn(campo, "h-12")}
            aria-invalid={Boolean(err("ciudad"))}
            aria-describedby={describir("ciudad")}
          />
          {error("ciudad")}
        </div>
        <div>
          <label htmlFor={`${id}-sector`} className={etiqueta}>
            Barrio o sector <span className="font-normal text-muted">(opcional)</span>
          </label>
          <input id={`${id}-sector`} name="sector" maxLength={80} defaultValue={val("sector")} className={cn(campo, "h-12")} />
        </div>
      </div>

      <div>
        <label htmlFor={`${id}-descripcion`} className={etiqueta}>
          Descripción corta <span className="font-normal text-muted">(opcional)</span>
        </label>
        <textarea
          id={`${id}-descripcion`}
          name="descripcion"
          rows={3}
          maxLength={600}
          placeholder="Área, habitaciones, baños, parqueadero y lo que lo hace especial"
          defaultValue={val("descripcion")}
          className={cn(campo, "py-3")}
        />
      </div>

      <fieldset className="space-y-4 rounded-[var(--radius-card)] border border-line p-4">
        <legend className="px-1 text-[14px] font-semibold text-ink">Contacto que aparecerá en la ficha</legend>
        <div className="grid gap-4 sm:grid-cols-2">
          <div>
            <label htmlFor={`${id}-nombre`} className={etiqueta}>Nombre</label>
            <input
              id={`${id}-nombre`}
              name="contactoNombre"
              required
              autoComplete="name"
              maxLength={120}
              defaultValue={val("contactoNombre")}
              className={cn(campo, "h-12")}
              aria-invalid={Boolean(err("contactoNombre"))}
              aria-describedby={describir("contactoNombre")}
            />
            {error("contactoNombre")}
          </div>
          <div>
            <label htmlFor={`${id}-wa`} className={etiqueta}>WhatsApp</label>
            <input
              id={`${id}-wa`}
              name="contactoWhatsapp"
              type="tel"
              inputMode="tel"
              required
              autoComplete="tel"
              placeholder="300 123 4567"
              maxLength={24}
              defaultValue={val("contactoWhatsapp")}
              className={cn(campo, "tnum h-12")}
              aria-invalid={Boolean(err("contactoWhatsapp"))}
              aria-describedby={describir("contactoWhatsapp")}
            />
            {error("contactoWhatsapp")}
          </div>
        </div>
      </fieldset>

      <p aria-live="polite" className="min-h-0">
        {state.status === "error" && state.message && <span className="text-[14px] font-medium text-rose-700">{state.message}</span>}
      </p>
      {/* Si el problema no es un campo mal escrito (enlace vencido, base caída), la persona no se queda sin salida. */}
      {state.status === "error" && !state.errors && (
        <a href={WHATSAPP()} target="_blank" rel="noopener noreferrer" className={buttonVariants({ variant: "whatsapp", size: "md", className: "w-full" })}>
          <MessageCircle className="h-5 w-5" aria-hidden /> Escribir por WhatsApp
        </a>
      )}

      <button type="submit" disabled={isPending} aria-busy={isPending} className={buttonVariants({ variant: "primary", size: "lg", className: "w-full" })}>
        {isPending && <Loader2 className="h-4 w-4 animate-spin" aria-hidden="true" />}
        {isPending ? "Enviando…" : "Enviar los datos"}
      </button>
      <p className="text-center text-[13px] leading-snug text-muted">
        El nombre y el WhatsApp que dejes aquí son los que verán los interesados en la ficha. Al enviar aceptas la{" "}
        <Link href="/privacidad" className="font-medium text-ink-soft underline underline-offset-2 hover:text-brand-700">
          política de tratamiento de datos
        </Link>
        .
      </p>
    </form>
  );
}
