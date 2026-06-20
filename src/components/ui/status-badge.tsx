import { cn } from "@/lib/utils/cn";
import { PROPERTY_STATUS_LABELS, type PropertyStatus } from "@/lib/domain";

const styles: Record<PropertyStatus, string> = {
  disponible: "bg-emerald-100 text-emerald-800 ring-emerald-600/20",
  en_proceso: "bg-amber-100 text-amber-800 ring-amber-600/20",
  vendido: "bg-rose-100 text-rose-800 ring-rose-600/20",
};

const dot: Record<PropertyStatus, string> = {
  disponible: "bg-emerald-500",
  en_proceso: "bg-amber-500",
  vendido: "bg-rose-500",
};

export function StatusBadge({
  status,
  className,
}: {
  status: PropertyStatus;
  className?: string;
}) {
  return (
    <span
      className={cn(
        "inline-flex items-center gap-1.5 rounded-full px-2.5 py-1 text-xs font-semibold ring-1 ring-inset",
        styles[status],
        className,
      )}
    >
      <span className={cn("h-1.5 w-1.5 rounded-full", dot[status])} />
      {PROPERTY_STATUS_LABELS[status]}
    </span>
  );
}
