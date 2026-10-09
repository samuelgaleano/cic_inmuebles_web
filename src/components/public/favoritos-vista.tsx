"use client";

import { useMemo, useSyncExternalStore } from "react";
import Link from "next/link";
import { useSearchParams } from "next/navigation";
import { GitCompareArrows, Heart, MessageCircle, Trash2 } from "lucide-react";
import { buttonVariants } from "@/components/ui/button";
import { propertyUrl, siteConfig, whatsappLink } from "@/lib/config/site";
import { MAX_COMPARAR, MAX_FAVORITOS, useFavoritos } from "@/lib/cliente/almacenes";
import { leerSlugs, mensajeSeleccion, urlSeleccion } from "@/lib/cliente/seleccion";
import type { ItemIndice } from "@/lib/search/indice";
import { BotonCompartir } from "./boton-compartir";
import { TarjetaInmueble } from "./tarjeta-inmueble";

const sinSuscripcion = () => () => {};

/**
 * Favoritos: lo guardado en este navegador, o una selección que alguien
 * compartió por enlace (`?s=a,b,c`). Los favoritos no necesitan cuenta; para
 * pasarlos a otro dispositivo o a otra persona se comparte el enlace.
 */
export function FavoritosVista({ indice }: { indice: ItemIndice[] }) {
  const params = useSearchParams();
  const { ids, vaciar, alternar } = useFavoritos();
  // Hasta hidratar no se sabe qué hay guardado: no mostrar un "vacío" que luego se corrige.
  const hidratado = useSyncExternalStore(sinSuscripcion, () => true, () => false);

  const porSlug = useMemo(() => new Map(indice.map((i) => [i.slug, i])), [indice]);
  const validos = useMemo(() => new Set(porSlug.keys()), [porSlug]);

  const compartidos = leerSlugs(params.get("s"), validos, MAX_FAVORITOS);
  const esCompartida = compartidos.length > 0;
  const slugs = esCompartida ? compartidos : ids.filter((id) => validos.has(id));
  const items = slugs.map((s) => porSlug.get(s)!).filter(Boolean);

  const enlace = urlSeleccion(siteConfig.url, "/favoritos", slugs);
  const mensaje = mensajeSeleccion(
    siteConfig.name,
    esCompartida ? "te comparto estos inmuebles que vi en su catálogo:" : "estos son los inmuebles que me interesan:",
    items.map((i) => ({ titulo: i.titulo, sector: i.sector, url: propertyUrl(i.slug) })),
  );

  const guardarCompartidos = () => {
    for (const s of compartidos) if (!ids.includes(s)) alternar(s);
  };

  if (!hidratado) {
    return <div className="wrap min-h-[24rem]" aria-busy="true" />;
  }

  if (items.length === 0) {
    return (
      <div className="wrap">
        <div className="max-w-xl rounded-[var(--radius-tile)] bg-surface p-8 sm:p-10">
          <Heart className="h-8 w-8 text-brand-700" aria-hidden />
          <h2 className="t-title mt-5">Aún no has guardado ninguno.</h2>
          <p className="mt-3 text-muted">
            Toca el corazón de cualquier inmueble para guardarlo aquí. Después puedes compararlos o enviar tu selección a un asesor.
          </p>
          <Link href="/inmuebles" className={buttonVariants({ variant: "primary", size: "lg", className: "mt-8" })}>
            Ver los inmuebles
          </Link>
        </div>
      </div>
    );
  }

  return (
    <div className="wrap">
      <div className="flex flex-wrap items-center gap-2 border-b border-line pb-6">
        {esCompartida && (
          <button type="button" onClick={guardarCompartidos} className={buttonVariants({ variant: "primary" })}>
            <Heart className="h-4 w-4" aria-hidden /> Guardar en mis favoritos
          </button>
        )}
        <a
          href={whatsappLink(mensaje)}
          target="_blank"
          rel="noopener noreferrer"
          className={buttonVariants({ variant: esCompartida ? "outline" : "primary" })}
        >
          <MessageCircle className="h-[18px] w-[18px]" aria-hidden /> Enviar a un asesor
        </a>
        {items.length >= 2 && (
          <Link href={`/comparar?s=${slugs.slice(0, MAX_COMPARAR).join(",")}`} className={buttonVariants({ variant: "outline" })}>
            <GitCompareArrows className="h-[18px] w-[18px]" aria-hidden /> Comparar {Math.min(items.length, MAX_COMPARAR)}
          </Link>
        )}
        <BotonCompartir url={enlace} titulo={`Mi selección en ${siteConfig.name}`} texto="Estos son los inmuebles que me interesan." />
        {!esCompartida && (
          <button
            type="button"
            onClick={vaciar}
            className="ml-auto inline-flex h-11 items-center gap-2 rounded-full px-4 text-[15px] font-medium text-muted transition-colors hover:bg-ink/[0.06] hover:text-ink"
          >
            <Trash2 className="h-[18px] w-[18px]" aria-hidden /> Vaciar
          </button>
        )}
      </div>

      <ul className="mt-10 grid gap-x-6 gap-y-14 sm:grid-cols-2 lg:grid-cols-3">
        {items.map((item, i) => (
          <li key={item.slug} className="anim-sube" style={{ "--d": `${Math.min(i, 8) * 45}ms` } as React.CSSProperties}>
            <TarjetaInmueble datos={item} prioridad={i < 3} />
          </li>
        ))}
      </ul>
    </div>
  );
}
