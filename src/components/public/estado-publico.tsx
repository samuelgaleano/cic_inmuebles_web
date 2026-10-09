import { cn } from "@/lib/utils/cn";
import { PROPERTY_STATUS_PUBLIC_LABELS, type PropertyStatus } from "@/lib/domain";

const punto: Record<PropertyStatus, string> = {
  disponible: "bg-brand-500",
  en_proceso: "bg-[#d99a2b]",
  vendido: "bg-muted/60",
};

/**
 * Estado del inmueble para el visitante ("Disponible", "En negociación",
 * "Vendido"): un punto y una palabra, sin pastilla de color. `foto` lo pone
 * sobre una imagen con un fondo blanco opaco para que se lea siempre.
 * El panel de administración sigue usando StatusBadge y sus rótulos internos.
 */
export function EstadoPublico({
  estado,
  tono = "plano",
  className,
}: {
  estado: PropertyStatus;
  tono?: "plano" | "foto";
  className?: string;
}) {
  return (
    <span
      className={cn(
        "inline-flex items-center gap-1.5 text-[13px] font-medium",
        tono === "foto" ? "rounded-full bg-white/95 px-2.5 py-1 text-ink" : "text-muted",
        className,
      )}
    >
      <span className={cn("h-1.5 w-1.5 rounded-full", punto[estado])} aria-hidden />
      {PROPERTY_STATUS_PUBLIC_LABELS[estado]}
    </span>
  );
}
