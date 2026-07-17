"use client";

import { useEffect, useRef, useState } from "react";
import { CreditCard, Loader2, X } from "lucide-react";
import { formatPrice } from "@/lib/utils/format";
import { buttonVariants } from "@/components/ui/button";
import { cn } from "@/lib/utils/cn";

declare global {
  interface Window {
    WidgetCheckout?: new (opts: Record<string, unknown>) => { open: (cb?: (r: unknown) => void) => void };
  }
}

const WIDGET_SRC = "https://checkout.wompi.co/widget.js";
const inputClass =
  "h-11 w-full rounded-xl border border-line bg-surface px-3.5 text-sm text-ink transition-colors focus:border-brand-500 focus:bg-white focus:outline-none focus:ring-2 focus:ring-brand-200";

/** Carga el widget de Wompi una sola vez. */
function useWompiWidget() {
  // Inicializador perezoso: si el widget ya está cargado, arranca en true
  // (evita un setState síncrono dentro del effect).
  const [ready, setReady] = useState(() => typeof window !== "undefined" && Boolean(window.WidgetCheckout));
  useEffect(() => {
    if (ready) return;
    let s = document.querySelector<HTMLScriptElement>(`script[src="${WIDGET_SRC}"]`);
    const onLoad = () => setReady(Boolean(window.WidgetCheckout));
    if (!s) {
      s = document.createElement("script");
      s.src = WIDGET_SRC;
      s.async = true;
      s.addEventListener("load", onLoad);
      document.body.appendChild(s);
    } else {
      s.addEventListener("load", onLoad);
    }
    return () => s?.removeEventListener("load", onLoad);
  }, [ready]);
  return ready;
}

export function PlanCheckout({
  planId,
  planNombre,
  precioCOP,
}: {
  planId: string;
  planNombre: string;
  precioCOP: number;
}) {
  const widgetReady = useWompiWidget();
  const [open, setOpen] = useState(false);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [form, setForm] = useState({ nombre: "", email: "", telefono: "" });
  const dialogRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    if (!open) return;
    const onKey = (e: KeyboardEvent) => e.key === "Escape" && setOpen(false);
    document.addEventListener("keydown", onKey);
    dialogRef.current?.querySelector<HTMLInputElement>("input")?.focus();
    return () => document.removeEventListener("keydown", onKey);
  }, [open]);

  const pay = async (e: React.FormEvent) => {
    e.preventDefault();
    setLoading(true);
    setError(null);
    try {
      const res = await fetch("/api/pagos/wompi", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ planId, ...form }),
      });
      const data = await res.json();
      if (!res.ok || !data.ok) {
        setError(data.error ?? "No se pudo iniciar el pago.");
        setLoading(false);
        return;
      }
      if (!widgetReady || !window.WidgetCheckout) {
        setError("La pasarela no cargó. Revisa tu conexión e inténtalo de nuevo.");
        setLoading(false);
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
      checkout.open(() => {
        setLoading(false);
        setOpen(false);
      });
    } catch {
      setError("Ocurrió un error al conectar con la pasarela.");
      setLoading(false);
    }
  };

  const set = (k: keyof typeof form) => (e: React.ChangeEvent<HTMLInputElement>) =>
    setForm((f) => ({ ...f, [k]: e.target.value }));

  return (
    <>
      <button
        type="button"
        onClick={() => setOpen(true)}
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
          aria-label={`Contratar ${planNombre}`}
          onClick={(e) => e.target === e.currentTarget && setOpen(false)}
        >
          <div
            ref={dialogRef}
            className="w-full max-w-md rounded-t-[1.6rem] border border-line bg-white p-6 shadow-2xl sm:rounded-[1.6rem]"
          >
            <div className="flex items-start justify-between gap-3">
              <div>
                <p className="text-xs font-semibold uppercase tracking-[0.16em] text-brand-600">Contratar plan</p>
                <h3 className="mt-1 text-lg font-bold text-ink">{planNombre}</h3>
                <p className="mt-0.5 font-display text-2xl font-extrabold text-ink">{formatPrice(precioCOP)}</p>
              </div>
              <button
                type="button"
                onClick={() => setOpen(false)}
                aria-label="Cerrar"
                className="flex h-9 w-9 items-center justify-center rounded-full text-muted transition-colors hover:bg-surface hover:text-ink"
              >
                <X className="h-5 w-5" />
              </button>
            </div>

            <form onSubmit={pay} className="mt-5 space-y-3">
              <input required placeholder="Nombre completo" value={form.nombre} onChange={set("nombre")} className={inputClass} autoComplete="name" />
              <input required type="email" placeholder="Correo electrónico" value={form.email} onChange={set("email")} className={inputClass} autoComplete="email" />
              <input required type="tel" placeholder="Teléfono (WhatsApp)" value={form.telefono} onChange={set("telefono")} className={inputClass} autoComplete="tel" />

              {error && <p className="rounded-lg bg-rose-50 px-3 py-2 text-sm text-rose-700">{error}</p>}

              <button
                type="submit"
                disabled={loading}
                className={buttonVariants({ variant: "primary", size: "lg", className: "w-full justify-center" })}
              >
                {loading ? <Loader2 className="h-4 w-4 animate-spin" /> : <CreditCard className="h-4 w-4" />}
                {loading ? "Abriendo pasarela…" : `Pagar ${formatPrice(precioCOP)}`}
              </button>
              <p className="text-center text-xs text-muted">
                Pago seguro con Wompi (tarjetas, Nequi, PSE). Serás redirigido para completar la transacción.
              </p>
            </form>
          </div>
        </div>
      )}
    </>
  );
}

export function PlanCheckoutInactive({ precioCOP }: { precioCOP: number }) {
  return (
    <span className={cn("inline-flex h-11 w-full items-center justify-center rounded-xl border border-dashed border-line text-sm text-muted")}>
      Pago no disponible ({formatPrice(precioCOP)})
    </span>
  );
}
