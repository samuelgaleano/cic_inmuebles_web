"use client";

import { useEffect, useEffectEvent, useId, useRef, useState } from "react";
import { preconnect } from "react-dom";
import { CreditCard, Loader2, ShieldCheck, X } from "lucide-react";
import { formatPrice } from "@/lib/utils/format";
import { buttonVariants } from "@/components/ui/button";
import { COMERCIO_EN_PASARELA } from "@/lib/config/plans";
import { CLAVE_DATOS, DATOS_VACIOS, esDatosPago, esperaDeSeguimiento, leerDatosGuardados, telefonoNacional, urlPaginaCompleta, type DatosComprador } from "./checkout-utils";

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
  "h-12 w-full rounded-[var(--radius-field)] border border-field bg-white px-4 text-base text-ink transition-[border-color,box-shadow] duration-200 focus:border-brand-700 focus:outline-none focus:ring-4 focus:ring-brand-700/15";

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

/**
 * La ventana de Wompi se monta en posición absoluta al inicio del documento, no de la pantalla:
 * si la persona pulsó «Contratar» con la página bajada, se abría fuera de la vista. Esto lleva la
 * página hasta la ventana en cuanto aparece y, cuando se cierra sin pagar, devuelve a la persona
 * al plan donde estaba. Devuelve una función para dejar de vigilar.
 */
function acompanarVentanaWompi(
  volverA: number,
  avisos: { alCerrar: () => void; noAbrio: () => void; terminado: () => boolean },
): () => void {
  let modal: HTMLElement | null = null;
  let observador: MutationObserver | null = null;
  let tocada = false; // si la persona ya desplazó por su cuenta, no se le mueve la página
  const ajustes: number[] = [];
  const ir = (top: number) => window.scrollTo({ top: Math.max(0, top), behavior: "instant" });
  // Al cerrar, Wompi no quita «waybox-display-block»: añade «waybox-modal-final-close», sube la página
  // al inicio y un segundo después oculta la ventana con `hidden` (sin sacarla del documento).
  const abierta = (m: HTMLElement) => m.isConnected && !m.hidden && !m.classList.contains("waybox-modal-final-close");
  const alInicio = () => {
    if (!modal || tocada || !abierta(modal)) return;
    const top = modal.getBoundingClientRect().top;
    if (top < 0 || top > 40) ir(top + window.scrollY - 12);
  };
  const marcar = () => {
    tocada = true;
  };
  const eventos = ["wheel", "touchmove", "keydown"] as const;

  const fin = () => {
    window.clearInterval(buscar);
    window.clearTimeout(rendirse);
    ajustes.forEach((t) => window.clearTimeout(t));
    eventos.forEach((e) => window.removeEventListener(e, marcar, true));
    observador?.disconnect();
  };
  eventos.forEach((e) => window.addEventListener(e, marcar, { capture: true, passive: true }));
  const buscar = window.setInterval(() => {
    // Puede quedar la ventana oculta de un intento anterior: se toma la que está abierta y visible.
    const m = [...document.querySelectorAll<HTMLElement>(".waybox-modal")].find((x) => abierta(x) && x.getBoundingClientRect().height > 0);
    if (!m) return;
    window.clearInterval(buscar);
    window.clearTimeout(rendirse); // ya apareció: se vigila hasta que se cierre, tarde lo que tarde
    modal = m;
    alInicio();
    // Wompi enfoca su primer campo y el navegador puede volver a mover la página: se corrige un rato.
    for (const ms of [150, 400, 800, 1500]) ajustes.push(window.setTimeout(alInicio, ms));
    let avisada = false;
    observador = new MutationObserver(() => {
      if (!modal || abierta(modal)) return;
      // Con un pago terminado Wompi cierra su ventana y, en la misma tarea, llama al callback que navega al
      // resultado: ahí no se mueve la página ni se dice «sin cobro» mientras carga la confirmación.
      if (avisos.terminado()) {
        fin();
        return;
      }
      ir(volverA); // en el cierre y otra vez al ocultarse, por si Wompi movió la página entre medias
      if (!avisada) {
        avisada = true;
        avisos.alCerrar();
      }
      if (modal.hidden || !modal.isConnected) fin();
    });
    observador.observe(m, { attributes: true, attributeFilter: ["class", "style", "hidden"] });
    observador.observe(document.body, { childList: true });
  }, 100);
  // Lo que Wompi toca al abrir (aria-hidden en los hijos de <body> y estilos del body) se anota para devolverlo
  // si su ventana nunca aparece y hay que retirarla a mano.
  const ocultosAntes = new Set([...document.body.children].filter((e) => e.hasAttribute("aria-hidden")));
  const estiloBody = document.body.getAttribute("style");
  // Si la ventana de Wompi no aparece, su velo oscuro queda encima de la página sin salida: se le pide a
  // Wompi que cierre (atiende Escape), se retira lo que quede y se devuelve la página como estaba.
  const rendirse = window.setTimeout(() => {
    fin();
    window.dispatchEvent(new KeyboardEvent("keydown", { key: "Escape", keyCode: 27, bubbles: true } as KeyboardEventInit));
    document.querySelectorAll<HTMLElement>(".waybox-backdrop, .waybox-preload-wrapper, .waybox-modal").forEach((e) => {
      if (!(e.classList.contains("waybox-modal") && abierta(e) && e.getBoundingClientRect().height > 0)) e.remove();
    });
    for (const hijo of document.body.children) if (!ocultosAntes.has(hijo)) hijo.removeAttribute("aria-hidden");
    if (estiloBody === null) document.body.removeAttribute("style");
    else document.body.setAttribute("style", estiloBody);
    avisos.noAbrio();
  }, 15000);
  return fin;
}

/**
 * Mientras dura el pago, esta página (que contiene la ventana de Wompi) le pregunta al servidor por el estado de la
 * referencia. Así el pago queda registrado y CIC recibe el aviso aunque quien paga cierre la ventana de Wompi sin
 * pulsar «Volver al comercio». No mueve ni interrumpe nada de lo que ve la persona. Devuelve cómo detenerlo.
 */
function seguirPago(reference: string): () => void {
  const inicio = Date.now();
  let timer: number | undefined;
  let detenido = false;
  const detener = () => {
    detenido = true;
    window.clearTimeout(timer);
  };
  const turno = async () => {
    if (detenido) return;
    try {
      const res = await fetch(`/api/pagos/wompi/estado?ref=${encodeURIComponent(reference)}`, { cache: "no-store" });
      const d = (await res.json().catch(() => null)) as { final?: boolean; estado?: string } | null;
      if (d?.final || d?.estado === "desconocida" || res.status === 503) return detener();
    } catch {
      // sin red por un momento: se reintenta en el siguiente turno
    }
    const espera = esperaDeSeguimiento(Date.now() - inicio);
    if (espera === null || detenido) return;
    timer = window.setTimeout(turno, espera);
  };
  timer = window.setTimeout(turno, 4_000);
  return detener;
}

const FIELDS = [
  { key: "nombre", label: "Nombre completo", type: "text", autoComplete: "name", placeholder: "Como aparece en tu documento" },
  { key: "email", label: "Correo electrónico", type: "email", autoComplete: "email", placeholder: "nombre@correo.com" },
  { key: "telefono", label: "Teléfono (WhatsApp)", type: "tel", autoComplete: "tel", placeholder: "Ej. 300 123 4567" },
] as const;

export function PlanCheckout({
  planId,
  planNombre,
  precioCOP,
  renovacion,
  avisosActivos = false,
}: {
  planId: string;
  planNombre: string;
  precioCOP: number;
  /** Viene del enlace de renovación del correo: abre el pago con los datos ya escritos y lo liga al servicio. */
  renovacion?: DatosComprador & { token: string };
  /** true si el registro de vigencias funciona: solo entonces se prometen avisos por correo. */
  avisosActivos?: boolean;
}) {
  const [open, setOpen] = useState(Boolean(renovacion));
  const [wanted, setWanted] = useState(false);
  const [attempt, setAttempt] = useState(0);
  const [widget, resetWidget] = useWompiWidget(wanted || open, attempt);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [notice, setNotice] = useState<string | null>(null);
  const [lenta, setLenta] = useState(false);
  const [cerrada, setCerrada] = useState<string | null>(null);
  const [form, setForm] = useState<DatosComprador>(() =>
    renovacion ? { nombre: renovacion.nombre, email: renovacion.email, telefono: telefonoNacional(renovacion.telefono) } : DATOS_VACIOS,
  );
  const dialogRef = useRef<HTMLDivElement>(null);
  const triggerRef = useRef<HTMLButtonElement>(null);
  const intentoRef = useRef<AbortController | null>(null);
  const vigiaRef = useRef<(() => void) | null>(null);
  const seguimientoRef = useRef<(() => void) | null>(null);
  const uid = useId();

  // Al desmontar no quedan temporizadores ni observadores vivos.
  useEffect(
    () => () => {
      vigiaRef.current?.();
      seguimientoRef.current?.();
    },
    [],
  );

  // Intención de pago: al pasar el cursor o enfocar el botón ya preconectamos
  // y empezamos a bajar el widget, así "Pagar" está listo cuando se llega a él.
  const warm = () => {
    if (wanted) return;
    preconnect(WIDGET_ORIGIN);
    setWanted(true);
  };

  const abrir = () => {
    warm();
    setCerrada(null);
    if (!renovacion) {
      try {
        const guardados = leerDatosGuardados(window.sessionStorage.getItem(CLAVE_DATOS));
        if (guardados) setForm(guardados);
      } catch {
        // sin almacenamiento (modo privado estricto): se escribe de nuevo, nada más
      }
    }
    setOpen(true);
  };

  // Cerrar siempre se puede y cancela de verdad: si la preparación del pago sigue en curso, se aborta
  // y la pasarela ya no se abre después por su cuenta.
  const close = () => {
    intentoRef.current?.abort();
    intentoRef.current = null;
    setLoading(false);
    setLenta(false);
    setOpen(false);
    setError(null);
    setNotice(null);
  };
  const cerrarDesdeTeclado = useEffectEvent(close);

  // Bloqueo de scroll + foco inicial + Escape + trampa de foco + foco de vuelta al botón.
  useEffect(() => {
    if (!open) return;
    const trigger = triggerRef.current;
    const prevOverflow = document.body.style.overflow;
    document.body.style.overflow = "hidden";
    dialogRef.current?.querySelector<HTMLInputElement>("input")?.focus();

    const onKey = (e: KeyboardEvent) => {
      if (e.key === "Escape") {
        cerrarDesdeTeclado(); // cerrar no genera ningún cobro
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
      // Sin desplazar la página: si el foco la mueve, la ventana de Wompi (posición absoluta) queda fuera de la vista.
      trigger?.focus({ preventScroll: true });
    };
  }, [open]);

  const setLoadingState = (v: boolean) => {
    setLoading(v);
    if (!v) setLenta(false);
  };

  // Si la pasarela tarda en abrir, la persona no se queda esperando sin saber qué hacer.
  useEffect(() => {
    if (!loading) return;
    const id = setTimeout(() => setLenta(true), 10000);
    return () => clearTimeout(id);
  }, [loading]);

  const formRef = useRef<HTMLFormElement>(null);

  const pay = async (e: React.FormEvent, modo: "ventana" | "pagina" = "ventana") => {
    e.preventDefault();
    if (modo === "ventana" && (widget !== "ready" || !window.WidgetCheckout)) return;
    intentoRef.current?.abort();
    const intento = new AbortController();
    intentoRef.current = intento;
    setLoadingState(true);
    setError(null);
    setNotice(null);
    try {
      const res = await fetch("/api/pagos/wompi", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(renovacion ? { planId, renovar: renovacion.token } : { planId }),
        signal: intento.signal,
      });
      const data: unknown = await res.json().catch(() => ({}));
      if (intento.signal.aborted) return; // la persona canceló mientras esperaba
      if (!res.ok || !esDatosPago(data)) {
        const msg = (data as { error?: unknown } | null)?.error;
        setError(typeof msg === "string" ? msg : "No pudimos iniciar el pago. Inténtalo de nuevo en un momento.");
        setLoadingState(false);
        return;
      }
      if (modo === "pagina") {
        window.location.assign(urlPaginaCompleta(data, form));
        return;
      }
      const checkout = new window.WidgetCheckout!({
        currency: data.currency,
        amountInCents: data.amountInCents,
        reference: data.reference,
        publicKey: data.publicKey,
        signature: { integrity: data.signature },
        redirectUrl: data.redirectUrl,
        customerData: {
          email: form.email,
          fullName: form.nombre,
          phoneNumber: telefonoNacional(form.telefono),
          phoneNumberPrefix: "+57",
        },
      });
      // La ventana de Wompi va en posición absoluta dentro de la página: cuando su contenido es más
      // alto que la pantalla, se llega al botón «Continuar» desplazando la página. Por eso este modal
      // se cierra antes de abrirla: su bloqueo de desplazamiento y su trampa de foco lo impedían.
      setLoadingState(false);
      setOpen(false);
      intentoRef.current = null;
      const volverA = window.scrollY;
      // Un cuadro de espera para que se libere el bloqueo de desplazamiento antes de que Wompi se coloque.
      await new Promise((r) => requestAnimationFrame(() => r(null)));
      let conTransaccion = false;
      vigiaRef.current?.();
      vigiaRef.current = acompanarVentanaWompi(volverA, {
        terminado: () => conTransaccion,
        alCerrar: () => {
          setCerrada("Cerraste la pasarela sin pagar: no se hizo ningún cobro. Puedes intentarlo de nuevo o elegir otro plan.");
          triggerRef.current?.focus({ preventScroll: true });
        },
        noAbrio: () => {
          setNotice("La ventana de pago no terminó de cargar. No se hizo ningún cobro. Prueba con «Abrir el pago en pantalla completa».");
          setOpen(true);
        },
      });
      // Registro del pago sin depender de «Volver al comercio»: se consulta el estado mientras dure.
      seguimientoRef.current?.();
      seguimientoRef.current = seguirPago(data.reference);
      checkout.open((result) => {
        const txId = result?.transaction?.id;
        // Wompi redirige por su cuenta al terminar; si la ventana se cerró antes, se lleva a la confirmación.
        if (txId) {
          conTransaccion = true;
          window.location.assign(`${data.redirectUrl}&id=${encodeURIComponent(txId)}`);
        }
      });
    } catch {
      if (intento.signal.aborted) return;
      setError("No pudimos conectar con la pasarela. Revisa tu conexión e inténtalo de nuevo.");
      setLoadingState(false);
    }
  };

  const set = (k: keyof DatosComprador) => (e: React.ChangeEvent<HTMLInputElement>) => {
    const nuevo = { ...form, [k]: e.target.value };
    setForm(nuevo);
    try {
      window.sessionStorage.setItem(CLAVE_DATOS, JSON.stringify(nuevo)); // para cambiar de plan sin reescribir
    } catch {
      // sin almacenamiento disponible: no pasa nada
    }
  };

  const canPay = widget === "ready" && !loading;
  const titleId = `${uid}-titulo`;

  return (
    <>
      <button
        ref={triggerRef}
        type="button"
        onClick={abrir}
        onPointerEnter={warm}
        onFocus={warm}
        className={buttonVariants({ variant: "primary", size: "md", className: "w-full justify-center" })}
      >
        <CreditCard className="h-4 w-4" />
        {renovacion ? "Renovar" : "Contratar"} por {formatPrice(precioCOP)}
      </button>
      {/* Siempre montada: así el lector de pantalla anuncia el aviso cuando aparece. */}
      <p role="status" className={cerrada ? "mt-2 text-center text-[13px] leading-snug text-ink-soft" : "sr-only"}>
        {cerrada ?? ""}
      </p>

      {open && (
        <div
          className="fixed inset-0 z-[100] flex items-end justify-center bg-ink/55 p-0 sm:items-center sm:p-4"
          role="dialog"
          aria-modal="true"
          aria-labelledby={titleId}
          onClick={(e) => e.target === e.currentTarget && close()}
        >
          <div
            ref={dialogRef}
            className="max-h-[92dvh] w-full max-w-md overflow-y-auto rounded-t-[var(--radius-tile)] bg-white p-6 sm:rounded-[var(--radius-tile)] sm:p-8"
          >
            <div className="flex items-start justify-between gap-3">
              <div>
                <h3 id={titleId} className="text-[1.25rem] font-semibold tracking-[-0.02em]">
                  {renovacion ? "Renovar" : "Contratar"} {planNombre}
                </h3>
                <p className="tnum mt-1 text-[1.75rem] font-semibold tracking-[-0.03em]">{formatPrice(precioCOP)}</p>
              </div>
              <button
                type="button"
                onClick={close}
                aria-label="Cerrar"
                className="-mr-2 -mt-2 flex h-10 w-10 flex-none items-center justify-center rounded-full text-muted transition-colors hover:bg-surface hover:text-ink"
              >
                <X className="h-5 w-5" />
              </button>
            </div>

            <form ref={formRef} onSubmit={(e) => pay(e, "ventana")} className="mt-6 space-y-4">
              {FIELDS.map((f) => (
                <div key={f.key}>
                  <label htmlFor={`${uid}-${f.key}`} className="mb-1.5 block text-[14px] font-medium text-ink">
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
                Con estos datos prellenamos la pasarela y te contactamos después del pago
                {avisosActivos ? "; también te avisamos por correo antes de que venza tu publicación" : ""}. Más detalles en la{" "}
                <a href="/privacidad" target="_blank" rel="noopener" className="underline underline-offset-2">política de datos</a>.
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
              {loading && lenta && (
                <p role="status" className="rounded-xl bg-amber-50 px-3.5 py-2.5 text-sm text-amber-900">
                  <span className="font-medium">La pasarela está tardando en abrir.</span> No se ha cobrado nada. Puedes esperar un poco más o{" "}
                  <button type="button" onClick={close} className="font-semibold underline underline-offset-2 hover:text-amber-950">
                    cancelar y volver a intentarlo
                  </button>
                  .
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
              <p className="text-center text-xs leading-relaxed text-muted">
                ¿Prefieres pagar en una página aparte?{" "}
                <button
                  type="button"
                  disabled={loading}
                  onClick={(e) => {
                    if (formRef.current?.reportValidity()) void pay(e, "pagina");
                  }}
                  className="font-semibold text-brand-700 underline underline-offset-2 hover:text-brand-800 disabled:opacity-50"
                >
                  Abrir el pago en pantalla completa
                </button>
                .
              </p>
              <p className="flex items-start justify-center gap-1.5 text-center text-xs leading-relaxed text-muted">
                <ShieldCheck className="mt-0.5 h-3.5 w-3.5 flex-none text-brand-700" aria-hidden="true" />
                <span>
                  Pago seguro con Wompi: tarjetas, PSE y Nequi. En la pasarela verás el comercio «{COMERCIO_EN_PASARELA}», la cuenta con la que CIC Inmuebles recibe sus pagos. Al terminar pulsa «Volver al comercio» para ver el resultado; si cierras la ventana antes, tu pago igual queda registrado y te escribimos.
                </span>
              </p>
              <p className="text-center text-xs leading-relaxed text-muted">
                Al pagar aceptas las{" "}
                <a href="/publica/condiciones" target="_blank" rel="noopener" className="underline underline-offset-2">
                  condiciones de publicación
                </a>
                .
              </p>
            </form>
          </div>
        </div>
      )}
    </>
  );
}
