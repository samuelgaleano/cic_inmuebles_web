import { SafeImage } from "./safe-image";
import { cn } from "@/lib/utils/cn";

/**
 * Foto que se adapta a CUALQUIER proporción sin recortar ni sobre-ampliar:
 * la imagen se muestra completa (object-contain) sobre una copia borrosa de sí
 * misma que rellena el marco. Así una foto vertical o cuadrada nunca queda
 * pixelada ni cortada dentro de un contenedor de otra proporción.
 *
 * Úsese dentro de un contenedor `relative overflow-hidden` con proporción fija.
 */
export function FramedPhoto({
  src,
  alt,
  sizes,
  priority,
  className,
}: {
  src: string;
  alt: string;
  sizes?: string;
  priority?: boolean;
  className?: string;
}) {
  return (
    <>
      {/* Relleno: la misma foto ampliada y desenfocada (nunca deja bordes vacíos) */}
      <SafeImage
        src={src}
        alt=""
        aria-hidden
        fill
        sizes={sizes}
        className="scale-110 object-cover blur-2xl"
      />
      <span className="absolute inset-0 bg-ink/25" aria-hidden />
      {/* Foto real, completa y nítida */}
      <SafeImage
        src={src}
        alt={alt}
        fill
        priority={priority}
        sizes={sizes}
        className={cn("object-contain", className)}
      />
    </>
  );
}
