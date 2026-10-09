import { cn } from "@/lib/utils/cn";

/**
 * Párrafo grande cuyas palabras pasan de gris a tinta, línea por línea, a
 * medida que sube por la pantalla (animación ligada al scroll, solo CSS). Sin
 * soporte del navegador o con movimiento reducido el texto se ve entero, en tinta.
 */
export function Declaracion({ texto, className }: { texto: string; className?: string }) {
  const palabras = texto.split(" ");
  return (
    <p className={cn("t-headline", className)}>
      {palabras.map((p, i) => (
        <span key={i} className="scrub-linea">
          {p}
          {i < palabras.length - 1 ? " " : ""}
        </span>
      ))}
    </p>
  );
}
