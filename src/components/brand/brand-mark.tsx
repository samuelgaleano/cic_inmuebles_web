import { cn } from "@/lib/utils/cn";

/**
 * Marca CIC: tríada de bloques isométricos apilados (eco del logo).
 * Monocromática vía `currentColor`, con caras sombreadas por opacidad para
 * dar volumen. Funciona en blanco sobre fondos verdes/oscuros y en esmeralda
 * sobre claro.
 */
export function BrandMark({ className }: { className?: string }) {
  // Un cubo isométrico con vértice superior en (0,0), arista a=7.
  const cube = (tx: number, ty: number, key: string) => (
    <g key={key} transform={`translate(${tx} ${ty})`}>
      {/* cara superior */}
      <path d="M0 0 L7 3.5 L0 7 L-7 3.5 Z" fill="currentColor" />
      {/* cara derecha */}
      <path d="M0 7 L7 3.5 L7 10.5 L0 14 Z" fill="currentColor" opacity="0.74" />
      {/* cara izquierda */}
      <path d="M0 7 L-7 3.5 L-7 10.5 L0 14 Z" fill="currentColor" opacity="0.52" />
    </g>
  );

  return (
    <svg
      viewBox="0 0 32 32"
      className={cn("h-7 w-7", className)}
      role="img"
      aria-label="CIC Inmuebles"
      fill="none"
    >
      {/* cubo superior (atrás), luego los dos de la base */}
      {cube(16, 3, "top")}
      {cube(9, 7, "left")}
      {cube(23, 7, "right")}
    </svg>
  );
}

/**
 * Logotipo completo: marca dentro de una pastilla + tipografía de la marca.
 * `tone` adapta los colores al fondo.
 */
export function Logo({
  className,
  tone = "light",
}: {
  className?: string;
  tone?: "light" | "dark";
}) {
  return (
    <span className={cn("inline-flex items-center gap-2.5", className)}>
      <span
        className={cn(
          "flex h-9 w-9 items-center justify-center rounded-xl ring-1 transition-colors",
          tone === "light"
            ? "bg-brand-600 text-white ring-brand-700/40 shadow-[0_6px_18px_-6px_rgba(7,162,118,0.6)]"
            : "bg-brand-500/15 text-brand-400 ring-white/15",
        )}
      >
        <BrandMark className="h-5 w-5" />
      </span>
      <span className="flex flex-col leading-none">
        <span
          className={cn(
            "font-display text-[15px] font-extrabold tracking-tight",
            tone === "light" ? "text-ink" : "text-white",
          )}
        >
          CIC<span className={tone === "light" ? "text-brand-600" : "text-brand-400"}> Inmuebles</span>
        </span>
        <span
          className={cn(
            "mt-0.5 text-[9px] font-semibold uppercase tracking-[0.28em]",
            tone === "light" ? "text-muted" : "text-white/45",
          )}
        >
          Finca raíz
        </span>
      </span>
    </span>
  );
}
