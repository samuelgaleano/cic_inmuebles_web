import { MessageCircle } from "lucide-react";
import { buttonVariants } from "@/components/ui/button";
import { whatsappLink } from "@/lib/config/site";
import { cn } from "@/lib/utils/cn";

/** Botón de contacto directo por WhatsApp (la vía de menor fricción). */
export function WhatsAppButton({
  message,
  label = "Escríbenos por WhatsApp",
  size = "md",
  variant = "whatsapp",
  className,
}: {
  message: string;
  label?: string;
  size?: "sm" | "md" | "lg";
  /** "outline" cuando comparte espacio con otro botón principal (un solo protagonista por bloque). */
  variant?: "whatsapp" | "outline";
  className?: string;
}) {
  return (
    <a
      href={whatsappLink(message)}
      target="_blank"
      rel="noopener noreferrer"
      className={cn(buttonVariants({ variant, size }), className)}
    >
      <MessageCircle className={cn("h-4 w-4", variant === "outline" && "text-[#128C4A]")} aria-hidden />
      {label}
    </a>
  );
}
