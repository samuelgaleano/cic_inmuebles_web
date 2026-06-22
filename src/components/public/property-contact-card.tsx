"use client";

import { useState } from "react";
import { CalendarCheck, Info } from "lucide-react";
import { cn } from "@/lib/utils/cn";
import { LeadForm } from "./lead-form";
import { WhatsAppButton } from "./whatsapp-button";

type Tab = "visita" | "info";

export function PropertyContactCard({
  propertyId,
  propertySlug,
  title,
  whatsappMessage,
}: {
  propertyId: string;
  propertySlug: string;
  title: string;
  whatsappMessage: string;
}) {
  const [tab, setTab] = useState<Tab>("visita");

  return (
    <div className="rounded-[1.4rem] border border-line bg-white p-6 shadow-[0_10px_40px_-28px_rgba(11,26,21,0.35)]">
      <h2 className="text-lg font-bold tracking-tight text-ink">¿Te interesa este inmueble?</h2>
      <p className="mt-1 text-sm text-muted">Te respondemos en el menor tiempo posible.</p>

      <div className="mt-4 grid grid-cols-2 gap-1 rounded-xl bg-surface p-1">
        <button
          type="button"
          onClick={() => setTab("visita")}
          className={cn(
            "flex items-center justify-center gap-1.5 rounded-lg py-2 text-sm font-semibold transition-all duration-300",
            tab === "visita" ? "bg-white text-brand-700 shadow-sm" : "text-muted hover:text-ink",
          )}
        >
          <CalendarCheck className="h-4 w-4" /> Agendar visita
        </button>
        <button
          type="button"
          onClick={() => setTab("info")}
          className={cn(
            "flex items-center justify-center gap-1.5 rounded-lg py-2 text-sm font-semibold transition-all duration-300",
            tab === "info" ? "bg-white text-brand-700 shadow-sm" : "text-muted hover:text-ink",
          )}
        >
          <Info className="h-4 w-4" /> Más información
        </button>
      </div>

      <div className="mt-4">
        {/* key fuerza el reinicio del formulario al cambiar de pestaña */}
        <LeadForm
          key={tab}
          tipo="comprador"
          intencion={tab}
          propertyId={propertyId}
          propertySlug={propertySlug}
          submitLabel={tab === "visita" ? "Solicitar visita" : "Quiero más información"}
        />
      </div>

      <div className="mt-5 flex items-center gap-3">
        <span className="h-px flex-1 bg-line" />
        <span className="text-xs text-muted">o</span>
        <span className="h-px flex-1 bg-line" />
      </div>

      <WhatsAppButton
        className="mt-4 w-full"
        message={whatsappMessage}
        label="Contactar por WhatsApp"
      />
      <p className="sr-only">{title}</p>
    </div>
  );
}
