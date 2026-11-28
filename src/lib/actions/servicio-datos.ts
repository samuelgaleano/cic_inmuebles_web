"use server";

import { sendPagosAlert } from "@/lib/notifications/payment";
import { recibirDatosDeServicio, type DatosFormState } from "@/lib/servicios/datos";
import { getServiciosStore } from "@/lib/servicios/store";

/**
 * Acción pública del formulario posterior al pago (/publica/agente/datos). No pide sesión: la
 * autorización es el token firmado del correo, que se vuelve a verificar aquí en cada envío (la acción
 * se puede invocar con un POST sin pasar por la página). Validación, honeypot y tope de envíos en
 * src/lib/servicios/datos.ts.
 */
export async function enviarDatosInmuebleAction(_prev: DatosFormState, formData: FormData): Promise<DatosFormState> {
  return recibirDatosDeServicio(Object.fromEntries(formData.entries()), {
    store: getServiciosStore(),
    alertar: sendPagosAlert,
    ahora: () => new Date(),
  });
}
