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
    <div className="rounded-2xl border border-slate-200 bg-white p-5 shadow-sm">
      <h2 className="text-lg font-semibold text-slate-900">¿Te interesa este inmueble?</h2>
      <p className="mt-1 text-sm text-slate-500">Te respondemos en el menor tiempo posible.</p>

      <div className="mt-4 grid grid-cols-2 gap-1 rounded-lg bg-slate-100 p-1">
        <button
          type="button"
          onClick={() => setTab("visita")}
          className={cn(
            "flex items-center justify-center gap-1.5 rounded-md py-2 text-sm font-medium transition",
            tab === "visita" ? "bg-white text-brand-800 shadow-sm" : "text-slate-600",
          )}
        >
          <CalendarCheck className="h-4 w-4" /> Agendar visita
        </button>
        <button
          type="button"
          onClick={() => setTab("info")}
          className={cn(
            "flex items-center justify-center gap-1.5 rounded-md py-2 text-sm font-medium transition",
            tab === "info" ? "bg-white text-brand-800 shadow-sm" : "text-slate-600",
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

      <div className="mt-4 flex items-center gap-3">
        <span className="h-px flex-1 bg-slate-200" />
        <span className="text-xs text-slate-400">o</span>
        <span className="h-px flex-1 bg-slate-200" />
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
