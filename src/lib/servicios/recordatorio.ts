import { getPlan } from "@/lib/config/plans";
import { siteConfig } from "@/lib/config/site";
import { enlaceWhatsApp } from "@/lib/utils/telefono";
import { enlaceDeRenovacion, nombrePropio } from "./correos";
import { diasRestantes, fechaLarga, type Servicio } from "./vigencia";

/**
 * Recordatorio de renovación por WhatsApp desde /admin/vigencias. Lo envía una persona de CIC con un clic
 * (wa.me con el mensaje listo y el enlace firmado de renovación); no hay envío automático.
 */

/** Días antes del vencimiento desde los que se ofrece el botón (igual que el primer aviso por correo). */
export const DIAS_PARA_RECORDAR = 7;

/** Activo que vence en 7 días o menos, o ya vencido, con un vencimiento conocido. */
export function tocaRecordar(s: Pick<Servicio, "estado" | "venceAt">, ahora: Date): boolean {
  if (!s.venceAt || (s.estado !== "activo" && s.estado !== "vencido")) return false;
  return s.estado === "vencido" || diasRestantes(s.venceAt, ahora) <= DIAS_PARA_RECORDAR;
}

/** Texto del mensaje, con el enlace de renovación al final. */
export function mensajeRecordatorio(s: Servicio, ahora: Date): string {
  const nombre = nombrePropio(s);
  const plan = getPlan(s.planId);
  const que = plan?.espacios && !s.propertySlug ? "tu paquete" : "tu publicación";
  const vence = s.venceAt as string;
  const restan = diasRestantes(vence, ahora);
  const cuando =
    restan <= 0
      ? `venció el ${fechaLarga(vence)}`
      : restan === 1
        ? `vence en menos de 24 horas (${fechaLarga(vence)})`
        : `vence en ${restan} días, el ${fechaLarga(vence)}`;
  return [
    `Hola${nombre ? ` ${nombre}` : ""}, te escribimos de ${siteConfig.name}.`,
    `${que.charAt(0).toUpperCase()}${que.slice(1)} del plan «${plan?.nombre ?? s.planId}» ${cuando}.`,
    `Puedes renovar con un clic aquí: ${enlaceDeRenovacion(s)}`,
  ].join(" ");
}

/** Enlace wa.me listo para enviar, o null si no toca recordar o el servicio no tiene un teléfono con WhatsApp. */
export function enlaceRecordatorio(s: Servicio, ahora: Date): string | null {
  if (!s.clienteTelefono || !tocaRecordar(s, ahora)) return null;
  return enlaceWhatsApp(s.clienteTelefono, mensajeRecordatorio(s, ahora)) ?? null;
}
