"use client";

import { useEffect, useId, useRef, useState } from "react";
import { preconnect } from "react-dom";
import { CreditCard, Loader2, ShieldCheck, X } from "lucide-react";
import { formatPrice } from "@/lib/utils/format";
import { buttonVariants } from "@/components/ui/button";

type WidgetResult = { transaction?: { id?: string; status?: string } | null };

declare global {
  interface Window {
    WidgetCheckout?: new (opts: Record<string, unknown>) => { open: (cb?: (r: WidgetResult) => void) => void };
  }
}

const WIDGET_ORIGIN = "https://checkout.wompi.co";
const WIDGET_SRC = `${WIDGET_ORIGIN}/widget.js`;
// 16px en móvil: por debajo de eso iOS Safari hace zoom al enfocar el campo.
const inputClass =
  "h-11 w-full rounded-xl border border-line bg-surface px-3.5 text-base text-ink transition-colors focus:border-brand-500 focus:bg-white focus:outline-none focus:ring-2 focus:ring-brand-200 sm:text-sm";

type WidgetState = "idle" | "loading" | "ready" | "error";

// Una sola carga del script por página, compartida por los seis botones.
let widgetPromise: Promise<void> | null = null;
function loadWompiWidget(): Promise<void> {
  if (window.WidgetCheckout) return Promise.resolve();
  if (!widgetPromise) {
    widgetPromise = new Promise<void>((resolve, reject) => {
      const s = document.createElement("script");
      s.src = WIDGET_SRC;
      s.async = true;
      s.onload = () => (window.WidgetCheckout ? resolve() : reject(new Error("widget sin WidgetCheckout")));
      s.onerror = () => {
        s.remove();
        reject(new Error("widget no cargó"));
      };
      document.body.appendChild(s);
    }).catch((err) => {
      widgetPromise = null; // el siguiente intento inserta un script nuevo
      throw err;
    });
  }
  return widgetPromise;
}

/**
 * Estado del widget de Wompi para este botón. Solo se carga cuando hay
 * intención de pago (`wanted`): un tercero no entra antes de que alguien
 * toque "Contratar". Si el CDN falla, lo dice y permite reintentar.
 */
function useWompiWidget(wanted: boolean, attempt: number): [WidgetState, () => void] {
  const [state, setState] = useState<"idle" | "ready" | "error">("idle");
  useEffect(() => {
    if (!wanted) return;
    let cancelled = false;
    loadWompiWidget().then(
      () => !cancelled && setState("ready"),
      () => !cancelled && setState("error"),
    );
    return () => {
      cancelled = true;
    };
  }, [wanted, attempt]);
  const reset = () => setState("idle");
  return [wanted && state === "idle" ? "loading" : state, reset];
}

const FIELDS = [
  { key: "nombre", label: "Nombre completo", type: "text", autoComplete: "name", placeholder: "Como aparece en tu documento" },
  { key: "email", label: "Correo electrónico", type: "email", autoComplete: "email", placeholder: "Recibirás ahí el comprobante" },
  { key: "telefono", label: "Teléfono (WhatsApp)", type: "tel", autoComplete: "tel", placeholder: "Ej. 300 123 4567" },
] as const;

export function PlanCheckout({
  planId,
  planNombre,
  precioCOP,
}: {
  planId: string;
  planNombre: string;
  precioCOP: number;
}) {
  const [open, setOpen] = useState(false);
  const [wanted, setWanted] = useState(false);
  const [attempt, setAttempt] = useState(0);
  const [widget, resetWidget] = useWompiWidget(wanted || open, attempt);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [notice, setNotice] = useState<string | null>(null);
  const [form, setForm] = useState({ nombre: "", email: "", telefono: "" });
  const dialogRef = useRef<HTMLDivElement>(null);
  const triggerRef = useRef<HTMLButtonElement>(null);
  const loadingRef = useRef(false);
  const uid = useId();

  // Intención de pago: al pasar el cursor o enfocar el botón ya preconectamos
  // y empezamos a bajar el widget, así "Pagar" está listo cuando se llega a él.
  const warm = () => {
    if (wanted) return;
    preconnect(WIDGET_ORIGIN);
    setWanted(true);
  };

  const close = () => {
    setOpen(false);
    setError(null);
    setNotice(null);
  };

  // Bloqueo de scroll + foco inicial + Escape + trampa de foco + foco de vuelta al botón.
  useEffect(() => {
    if (!open) return;
    const trigger = triggerRef.current;
    const prevOverflow = document.body.style.overflow;
    document.body.style.overflow = "hidden";
    dialogRef.current?.querySelector<HTMLInputElement>("input")?.focus();

    const onKey = (e: KeyboardEvent) => {
      if (e.key === "Escape") {
        // Con la pasarela abriéndose no se cierra: evita dejar un pago a medias sin aviso.
        if (!loadingRef.current) {
          setOpen(false);
          setError(null);
          setNotice(null);
        }
        return;
      }
      if (e.key !== "Tab") return;
      const focusables = dialogRef.current?.querySelectorAll<HTMLElement>(
        'a[href], button:not([disabled]), input, [tabindex]:not([tabindex="-1"])',
      );
      if (!focusables || focusables.length === 0) return;
      const first = focusables[0];
      const last = focusables[focusables.length - 1];
      if (e.shiftKey && document.activeElement === first) {
        e.preventDefault();
        last.focus();
      } else if (!e.shiftKey && document.activeElement === last) {
        e.preventDefault();
        first.focus();
      }
    };
    document.addEventListener("keydown", onKey);
    return () => {
      document.removeEventListener("keydown", onKey);
      document.body.style.overflow = prevOverflow;
      trigger?.focus();
    };
  }, [open]);

  const setLoadingState = (v: boolean) => {
    loadingRef.current = v;
    setLoading(v);
  };

  const pay = async (e: React.FormEvent) => {
    e.preventDefault();
    if (widget !== "ready" || !window.WidgetCheckout) return;
    setLoadingState(true);
    setError(null);
    setNotice(null);
    try {
      const res = await fetch("/api/pagos/wompi", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ planId }),
      });
      const data = await res.json().catch(() => ({}));
      if (!res.ok || !data.ok) {
        setError(data.error ?? "No pudimos iniciar el pago. Inténtalo de nuevo en un momento.");
        setLoadingState(false);
        return;
      }
      const checkout = new window.WidgetCheckout({
        currency: data.currency,
        amountInCents: data.amountInCents,
        reference: data.reference,
        publicKey: data.publicKey,
        signature: { integrity: data.signature },
        redirectUrl: data.redirectUrl,
        customerData: {
          email: form.email,
          fullName: form.nombre,
          phoneNumber: form.telefono,
          phoneNumberPrefix: "+57",
        },
      });
      checkout.open((result) => {
        setLoadingState(false);
        const txId = result?.transaction?.id;
        if (txId) {
          // Wompi redirige por su cuenta al terminar; si la ventana se cerró
          // antes de que lo hiciera, llevamos al usuario a la confirmación.
          window.location.assign(`${data.redirectUrl}&id=${encodeURIComponent(txId)}`);
          return;
        }
        setNotice("Cerraste la pasarela sin completar el pago. No se hizo ningún cobro; puedes intentarlo cuando quieras.");
      });
    } catch {
      setError("No pudimos conectar con la pasarela. Revisa tu conexión e inténtalo de nuevo.");
      setLoadingState(false);
    }
  };

  const set = (k: keyof typeof form) => (e: React.ChangeEvent<HTMLInputElement>) =>
    setForm((f) => ({ ...f, [k]: e.target.value }));

  const canPay = widget === "ready" && !loading;
  const titleId = `${uid}-titulo`;

  return (
    <>
      <button
        ref={triggerRef}
        type="button"
        onClick={() => {
          warm();
          setOpen(true);
        }}
        onPointerEnter={warm}
        onFocus={warm}
        className={buttonVariants({ variant: "primary", size: "md", className: "w-full justify-center" })}
      >
        <CreditCard className="h-4 w-4" />
        Contratar por {formatPrice(precioCOP)}
      </button>

      {open && (
        <div
          className="fixed inset-0 z-[100] flex items-end justify-center bg-ink/50 p-0 backdrop-blur-sm sm:items-center sm:p-4"
          role="dialog"
          aria-modal="true"
          aria-labelledby={titleId}
          onClick={(e) => e.target === e.currentTarget && !loading && close()}
        >
          <div
            ref={dialogRef}
            className="max-h-[92vh] w-full max-w-md overflow-y-auto rounded-t-[1.6rem] border border-line bg-white p-6 shadow-2xl sm:rounded-[1.6rem]"
          >
            <div className="flex items-start justify-between gap-3">
              <div>
                <h3 id={titleId} className="text-lg font-bold tracking-tight text-ink">
                  Contratar {planNombre}
                </h3>
                <p className="mt-1 font-display text-2xl font-extrabold tracking-tight text-ink">{formatPrice(precioCOP)}</p>
              </div>
              <button
                type="button"
                onClick={close}
                disabled={loading}
                aria-label="Cerrar"
                className="-mr-2 -mt-2 flex h-10 w-10 flex-none items-center justify-center rounded-full text-muted transition-colors hover:bg-surface hover:text-ink focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-brand-500 focus-visible:ring-offset-2 disabled:opacity-50"
              >
                <X className="h-5 w-5" />
              </button>
            </div>

            <form onSubmit={pay} className="mt-5 space-y-3">
              {FIELDS.map((f) => (
                <div key={f.key}>
                  <label htmlFor={`${uid}-${f.key}`} className="mb-1.5 block text-sm font-medium text-ink-soft">
                    {f.label}
                  </label>
                  <input
                    id={`${uid}-${f.key}`}
                    required
                    type={f.type}
                    inputMode={f.type === "tel" ? "tel" : undefined}
                    placeholder={f.placeholder}
                    value={form[f.key]}
                    onChange={set(f.key)}
                    className={inputClass}
                    autoComplete={f.autoComplete}
                    maxLength={120}
                  />
                </div>
              ))}
              <p className="text-xs leading-relaxed text-muted">
                Con estos datos prellenamos la pasarela y te contactamos después del pago.
              </p>

              {error && (
                <p role="alert" className="rounded-xl bg-rose-50 px-3.5 py-2.5 text-sm font-medium text-rose-700">
                  {error}
                </p>
              )}
              {notice && (
                <p role="status" className="rounded-xl bg-amber-50 px-3.5 py-2.5 text-sm text-amber-900">
                  {notice}
                </p>
              )}
              {widget === "error" && (
                <p role="alert" className="rounded-xl bg-rose-50 px-3.5 py-2.5 text-sm text-rose-700">
                  <span className="font-medium">La pasarela no cargó.</span> Revisa tu conexión y{" "}
                  <button
                    type="button"
                    onClick={() => {
                      resetWidget();
                      setAttempt((n) => n + 1);
                    }}
                    className="font-semibold underline underline-offset-2 hover:text-rose-900"
                  >
                    vuelve a intentarlo
                  </button>
                  .
                </p>
              )}

              <button
                type="submit"
                disabled={!canPay}
                aria-busy={loading || widget === "loading"}
                className={buttonVariants({ variant: "primary", size: "lg", className: "w-full justify-center" })}
              >
                {loading || widget === "loading" ? (
                  <Loader2 className="h-4 w-4 animate-spin" aria-hidden="true" />
                ) : (
                  <CreditCard className="h-4 w-4" aria-hidden="true" />
                )}
                {loading
                  ? "Abriendo pasarela…"
                  : widget === "ready"
                    ? `Pagar ${formatPrice(precioCOP)}`
                    : widget === "error"
                      ? "Pasarela no disponible"
                      : "Cargando pasarela…"}
              </button>
              <p className="flex items-start justify-center gap-1.5 text-center text-xs leading-relaxed text-muted">
                <ShieldCheck className="mt-0.5 h-3.5 w-3.5 flex-none text-brand-700" aria-hidden="true" />
                <span>
                  Pago seguro con Wompi: tarjetas, PSE y Nequi. Al terminar vuelves aquí con el resultado.
                </span>
              </p>
            </form>
          </div>
        </div>
      )}
    </>
  );
}
