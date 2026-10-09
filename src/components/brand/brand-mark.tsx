import { cn } from "@/lib/utils/cn";

/**
 * Marca CIC: tríada de bloques isométricos apilados (eco del logo).
 * Monocromática vía `currentColor`, con caras sombreadas por opacidad para
 * dar volumen. Funciona en blanco sobre fondos verdes/oscuros y en esmeralda
 * sobre claro.
 */
export function BrandMark({ className, decorativo = false }: { className?: string; decorativo?: boolean }) {
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
      {...(decorativo ? { "aria-hidden": true } : { role: "img", "aria-label": "CIC Inmuebles" })}
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
 * Logotipo: la marca en su recuadro y el nombre en una sola línea, un solo color.
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
          "flex h-8 w-8 items-center justify-center rounded-[10px]",
          tone === "light" ? "bg-brand-600 text-white" : "bg-white/10 text-brand-400",
        )}
      >
        <BrandMark decorativo className="h-[18px] w-[18px]" />
      </span>
      <span
        className={cn(
          "text-[17px] tracking-[-0.02em]",
          tone === "light" ? "text-ink" : "text-white",
        )}
      >
        <span className="font-semibold">CIC</span> <span className="font-normal">Inmuebles</span>
      </span>
    </span>
  );
}
