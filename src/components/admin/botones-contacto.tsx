import { MessageCircle, Phone } from "lucide-react";
import { primerNombre } from "@/lib/crm/plantillas-whatsapp";
import { enlaceWhatsApp, normalizarTelefono } from "@/lib/utils/telefono";
import { EnlaceContacto } from "./enlace-contacto";

/** WhatsApp y llamar de una persona, en botones de 44 px (táctiles). Nada si no tiene un teléfono útil. */
export function BotonesContacto({ telefono, nombre, contactoId, leadId }: { telefono?: string; nombre: string; contactoId?: string; leadId?: string }) {
  if (!telefono) return null;
  const n = primerNombre(nombre);
  const wa = enlaceWhatsApp(telefono, `${n ? `Hola ${n}` : "Hola"}, te escribo de CIC Inmuebles.`);
  const tel = normalizarTelefono(telefono)?.e164;
  if (!wa && !tel) return null;
  const boton = "inline-flex h-11 w-11 shrink-0 items-center justify-center rounded-xl border border-line bg-white transition-colors";
  return (
    <span className="flex shrink-0 gap-2">
      {wa && (
        <EnlaceContacto href={wa} contactoId={contactoId} leadId={leadId} aria-label={`Escribir a ${nombre} por WhatsApp`} className={`${boton} text-emerald-700 hover:border-emerald-600 hover:bg-emerald-50`}>
          <MessageCircle className="h-5 w-5" aria-hidden />
        </EnlaceContacto>
      )}
      {tel && (
        <EnlaceContacto href={`tel:${tel}`} nuevaPestana={false} contactoId={contactoId} leadId={leadId} aria-label={`Llamar a ${nombre}`} className={`${boton} text-ink-soft hover:border-ink hover:text-ink`}>
          <Phone className="h-5 w-5" aria-hidden />
        </EnlaceContacto>
      )}
    </span>
  );
}
