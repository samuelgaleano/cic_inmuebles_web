"use client";

import { registrarPrimerContactoAction } from "@/lib/actions/admin-leads";

/**
 * Enlace de WhatsApp o de llamada del panel. Al pulsarlo, además de abrir el chat o el marcador, deja la hora de
 * la primera respuesta en el lead (o en los leads de la persona del CRM). La acción va aparte y sin esperar:
 * si falla, el enlace se abre igual.
 */
export function EnlaceContacto({
  href,
  leadId,
  contactoId,
  className,
  children,
  "aria-label": ariaLabel,
  nuevaPestana = true,
}: {
  href: string;
  leadId?: string;
  contactoId?: string;
  className?: string;
  children: React.ReactNode;
  "aria-label"?: string;
  nuevaPestana?: boolean;
}) {
  return (
    <a
      href={href}
      {...(nuevaPestana ? { target: "_blank", rel: "noopener noreferrer" } : {})}
      aria-label={ariaLabel}
      className={className}
      onClick={() => {
        if (leadId || contactoId) void registrarPrimerContactoAction({ leadId, contactoId }).catch(() => undefined);
      }}
    >
      {children}
    </a>
  );
}
