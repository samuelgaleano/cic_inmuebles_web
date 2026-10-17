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
  const telefono = f.telefono.replace(/\D/g, "");
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
