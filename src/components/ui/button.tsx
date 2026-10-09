import { cn } from "@/lib/utils/cn";

type Variant = "primary" | "outline" | "ghost" | "inverse" | "whatsapp";
type Size = "sm" | "md" | "lg";

// Píldora, sin sombras: la jerarquía la da el relleno, no el relieve. El foco lo pone el estilo global.
const base =
  "group relative inline-flex select-none items-center justify-center gap-2 whitespace-nowrap rounded-full font-medium tracking-[-0.01em] transition-[background-color,color,border-color,transform] duration-200 ease-out active:scale-[0.97] disabled:pointer-events-none disabled:opacity-50";

const variants: Record<Variant, string> = {
  primary: "bg-brand-700 text-white hover:bg-brand-800",
  outline: "border border-line-strong bg-white text-ink hover:border-ink",
  ghost: "text-ink hover:bg-ink/[0.06]",
  // Sobre baldosas oscuras.
  inverse: "bg-white text-ink hover:bg-brand-50",
  // Tinta sobre el verde de WhatsApp: ~9:1 de contraste (blanco daba ~2:1).
  whatsapp: "bg-[#25D366] text-ink hover:bg-[#1ebe5d]",
};

const sizes: Record<Size, string> = {
  sm: "h-9 px-4 text-sm",
  md: "h-11 px-6 text-[15px]",
  lg: "h-[52px] px-7 text-base",
};

/** Devuelve las clases del botón (útil para aplicar a <Link> o <a>). */
export function buttonVariants({
  variant = "primary",
  size = "md",
  className,
}: {
  variant?: Variant;
  size?: Size;
  className?: string;
} = {}): string {
  return cn(base, variants[variant], sizes[size], className);
}

export interface ButtonProps extends React.ButtonHTMLAttributes<HTMLButtonElement> {
  variant?: Variant;
  size?: Size;
}

export function Button({ variant, size, className, ...props }: ButtonProps) {
  return <button className={buttonVariants({ variant, size, className })} {...props} />;
}
