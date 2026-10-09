import Link from "next/link";
import { SafeImage } from "@/components/ui/safe-image";
import { cn } from "@/lib/utils/cn";
import { PROPERTY_TYPE_LABELS } from "@/lib/domain";
import type { ItemIndice } from "@/lib/search/indice";
import { formatPriceOrConsult } from "@/lib/utils/format";
import { BotonComparar } from "./boton-comparar";
import { BotonFavorito } from "./boton-favorito";
import { EstadoPublico } from "./estado-publico";

export type DatosTarjeta = Pick<
  ItemIndice,
  "slug" | "titulo" | "tipo" | "estado" | "precio" | "ciudad" | "sector" | "habitaciones" | "banos" | "area" | "parqueaderos" | "portada"
>;

/** "4 hab · 4 baños · 128 m²" — solo lo que el inmueble tiene publicado. */
export function resumenCifras(d: Pick<DatosTarjeta, "habitaciones" | "banos" | "area" | "parqueaderos">): string {
  return [
    d.habitaciones != null && `${d.habitaciones} hab`,
    d.banos != null && `${d.banos} ${d.banos === 1 ? "baño" : "baños"}`,
    d.area != null && `${d.area} m²`,
    d.parqueaderos != null && d.parqueaderos > 0 && `${d.parqueaderos} parq`,
  ]
    .filter(Boolean)
    .join(" · ");
}

/**
 * Tarjeta del catálogo: la foto manda, el texto va debajo (no encima). Todo el
 * bloque es un solo enlace a la ficha (enlace extendido); el corazón y
 * "Comparar" son botones aparte que flotan por encima. Si hay una búsqueda
 * activa, `razones` explica por qué aparece este inmueble.
 */
export function TarjetaInmueble({
  datos,
  razones,
  prioridad,
  proporcion = "5/4",
  parallax = false,
  comparar = true,
  className,
}: {
  datos: DatosTarjeta;
  razones?: string[];
  prioridad?: boolean;
  /** "4/5" para la tira de la home (las portadas verticales casi no se recortan). */
  proporcion?: "5/4" | "4/5";
  /** La foto se desplaza dentro del marco según el scroll horizontal de la tira. */
  parallax?: boolean;
  /** Muestra el botón "Comparar" (la tira de la home lo omite para quedar limpia). */
  comparar?: boolean;
  className?: string;
}) {
  const vendido = datos.estado === "vendido";
  const lugar = [datos.sector, datos.ciudad].filter(Boolean).join(", ");
  const cifras = resumenCifras(datos);

  return (
    <article className={cn("group relative flex flex-col", className)}>
      <div
        className={cn(
          "relative overflow-hidden rounded-[var(--radius-media)] bg-surface",
          proporcion === "4/5" ? "aspect-[4/5]" : "aspect-[5/4]",
        )}
      >
        {datos.portada ? (
          <SafeImage
            src={datos.portada}
            alt=""
            fill
            fetchPriority={prioridad ? "high" : undefined}
            sizes={proporcion === "4/5" ? "(max-width: 640px) 72vw, 344px" : "(max-width: 640px) 100vw, (max-width: 1024px) 50vw, 380px"}
            className={cn(
              "object-cover",
              parallax ? "parallax-x" : "transition-transform duration-[900ms] ease-[var(--ease-fluid)] group-hover:scale-[1.035]",
              vendido && "opacity-85 grayscale-[35%]",
            )}
          />
        ) : (
          <div className="flex h-full items-center justify-center text-sm text-muted">Fotos próximamente</div>
        )}
        {datos.estado !== "disponible" && (
          <div className="absolute left-3 top-3">
            <EstadoPublico estado={datos.estado} tono="foto" />
          </div>
        )}
        <div className="absolute right-3 top-3">
          <BotonFavorito id={datos.slug} titulo={datos.titulo} />
        </div>
      </div>

      <div className="flex flex-1 flex-col pt-4">
        <p className="text-[13px] text-muted">
          {PROPERTY_TYPE_LABELS[datos.tipo]}
          {lugar ? ` · ${lugar}` : ""}
        </p>
        <h3 className={cn("mt-1 text-[1.25rem] font-semibold leading-snug tracking-[-0.02em]", vendido && "text-muted")}>
          <Link
            href={`/inmuebles/${datos.slug}`}
            className="rounded-sm after:absolute after:inset-0 after:content-['']"
          >
            {datos.titulo}
          </Link>
        </h3>
        <p className="tnum mt-1 text-[1.0625rem] font-medium">{formatPriceOrConsult(datos.precio)}</p>
        {cifras && <p className="tnum mt-2 text-[14px] text-muted">{cifras}</p>}

        {razones && razones.length > 0 && (
          <p className="mt-3 text-[13px] leading-snug text-brand-800">{razones.slice(0, 4).join(" · ")}</p>
        )}

        {comparar && (
          <div className="mt-4">
            <BotonComparar id={datos.slug} titulo={datos.titulo} />
          </div>
        )}
      </div>
    </article>
  );
}
