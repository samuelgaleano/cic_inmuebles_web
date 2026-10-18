/**
 * Piezas puras del modal de contratación: se prueban sin navegador.
 */

export type DatosComprador = { nombre: string; email: string; telefono: string };

export type DatosPago = {
  currency: string;
  amountInCents: number;
  reference: string;
  publicKey: string;
  signature: string;
  redirectUrl: string;
};

/**
 * Teléfono colombiano sin prefijo de país: Wompi guarda «573012679392» y la pasarela ya agrega +57 por su cuenta,
 * así que sin esto quedaría «+57 57 301…». Solo se quita el 57 cuando sobra (12 dígitos que empiezan en 57).
 */
export function telefonoNacional(t: string): string {
  const d = t.replace(/\D/g, "");
  return d.length === 12 && d.startsWith("57") ? d.slice(2) : d;
}

export const DATOS_VACIOS: DatosComprador = { nombre: "", email: "", telefono: "" };

/** Clave de sessionStorage: los datos sirven para cambiar de plan sin reescribirlos y se borran al cerrar la pestaña. */
export const CLAVE_DATOS = "cic-checkout-datos";

/** Lee los datos guardados; cualquier cosa rara (JSON roto, tipos distintos, textos enormes) se descarta. */
export function leerDatosGuardados(crudo: string | null): DatosComprador | null {
  if (!crudo) return null;
  try {
    const d = JSON.parse(crudo) as Record<string, unknown>;
    const campo = (v: unknown) => (typeof v === "string" ? v.slice(0, 120) : "");
    const datos = { nombre: campo(d?.nombre), email: campo(d?.email), telefono: campo(d?.telefono) };
    return datos.nombre || datos.email || datos.telefono ? datos : null;
  } catch {
    return null;
  }
}

// Web Checkout de Wompi (página completa, https://docs.wompi.co/docs/colombia/widget-checkout-web/):
// mismos datos y misma firma de integridad que ya entrega el servidor, sin ventana flotante.
export function urlPaginaCompleta(d: DatosPago, f: DatosComprador): string {
  const telefono = telefonoNacional(f.telefono);
  const q = new URLSearchParams({
    "public-key": d.publicKey,
    currency: d.currency,
    "amount-in-cents": String(d.amountInCents),
    reference: d.reference,
    "signature:integrity": d.signature,
    "redirect-url": d.redirectUrl,
    "customer-data:email": f.email,
    "customer-data:full-name": f.nombre,
  });
  // Sin teléfono el servicio quedaba sin WhatsApp de contacto en el panel de vigencias.
  if (telefono) {
    q.set("customer-data:phone-number", telefono);
    q.set("customer-data:phone-number-prefix", "+57");
  }
  return `https://checkout.wompi.co/p/?${q.toString()}`;
}

/**
 * Cada cuánto consulta la página el estado de un pago en curso: cada 5 s los primeros 2 minutos, cada 10 s
 * hasta los 5 y cada 20 s hasta los 20 (Nequi y PSE pueden tardar). Pasado ese tiempo se deja de consultar:
 * la conciliación diaria y el botón «Volver al comercio» siguen cubriendo el caso.
 */
export const SEGUIMIENTO_MAX_MS = 20 * 60_000;
export function esperaDeSeguimiento(transcurridoMs: number): number | null {
  if (transcurridoMs >= SEGUIMIENTO_MAX_MS) return null;
  if (transcurridoMs < 2 * 60_000) return 5_000;
  if (transcurridoMs < 5 * 60_000) return 10_000;
  return 20_000;
}

/** Una respuesta del servidor sirve para abrir la pasarela solo si trae todo lo necesario. */
export function esDatosPago(d: unknown): d is DatosPago {
  if (!d || typeof d !== "object") return false;
  const x = d as Record<string, unknown>;
  return (
    typeof x.publicKey === "string" &&
    typeof x.reference === "string" &&
    typeof x.signature === "string" &&
    typeof x.redirectUrl === "string" &&
    typeof x.currency === "string" &&
    typeof x.amountInCents === "number"
  );
}
