import { MessageCircle } from "lucide-react";
import { buttonVariants } from "@/components/ui/button";
import { whatsappLink } from "@/lib/config/site";
import { cn } from "@/lib/utils/cn";

/** Botón de contacto directo por WhatsApp (la vía de menor fricción). */
export function WhatsAppButton({
  message,
  label = "Escríbenos por WhatsApp",
  size = "md",
  className,
}: {
  message: string;
  label?: string;
  size?: "sm" | "md" | "lg";
  className?: string;
}) {
  return (
    <a
      href={whatsappLink(message)}
      target="_blank"
      rel="noopener noreferrer"
      className={cn(buttonVariants({ variant: "whatsapp", size }), className)}
    >
      <MessageCircle className="h-4 w-4" />
      {label}
    </a>
  );
}
