import { cn } from "@/lib/utils/cn";

type Variant = "primary" | "accent" | "outline" | "ghost" | "whatsapp";
type Size = "sm" | "md" | "lg";

const base =
  "group relative inline-flex items-center justify-center gap-2 rounded-xl font-semibold tracking-tight transition-all duration-300 ease-[cubic-bezier(0.16,1,0.3,1)] focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-brand-500 focus-visible:ring-offset-2 active:scale-[0.98] disabled:opacity-60 disabled:pointer-events-none";

const variants: Record<Variant, string> = {
  primary:
    "bg-brand-700 text-white shadow-[0_10px_26px_-10px_rgba(4,125,91,0.8)] hover:bg-brand-800 hover:shadow-[0_14px_32px_-10px_rgba(4,125,91,0.9)]",
  accent:
    "bg-accent-500 text-ink shadow-[0_10px_26px_-12px_rgba(226,173,78,0.9)] hover:bg-accent-400",
  outline:
    "border border-line bg-white text-ink hover:border-brand-300 hover:bg-brand-50 hover:text-brand-800",
  ghost: "text-ink hover:bg-brand-50 hover:text-brand-800",
  whatsapp: "bg-[#25D366] text-white shadow-[0_10px_26px_-12px_rgba(37,211,102,0.9)] hover:bg-[#1ebe5d]",
};

const sizes: Record<Size, string> = {
  sm: "h-9 px-3.5 text-sm",
  md: "h-11 px-5 text-sm",
  lg: "h-12 px-6 text-[15px]",
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
