import type { Metadata } from "next";
import { Suspense } from "react";
import { ComparadorVista } from "@/components/public/comparador-vista";
import { getPublicInventory } from "@/lib/data/public-inventory";
import { construirIndice } from "@/lib/search/indice";

// La selección vive en la URL de cada visitante: no se indexa.
export const metadata: Metadata = {
  title: "Comparar inmuebles",
  description: "Hasta tres inmuebles lado a lado: precio, precio por metro cuadrado, área, habitaciones y administración.",
  alternates: { canonical: "/comparar" },
  robots: { index: false, follow: true },
};

export const revalidate = 300;

export default async function CompararPage() {
  const indice = construirIndice(await getPublicInventory());

  return (
    <>
      <header className="wrap pb-10 pt-14 sm:pb-12 sm:pt-20">
        <h1 className="t-display max-w-4xl">Comparar</h1>
        <p className="t-lead mt-5 max-w-2xl">
          Hasta tres inmuebles lado a lado, con la mejor cifra de cada fila resaltada. El enlace de esta página se puede compartir.
        </p>
      </header>
      <Suspense fallback={<div className="wrap min-h-[24rem]" aria-busy="true" />}>
        <ComparadorVista indice={indice} />
      </Suspense>
      <div className="h-28" />
    </>
  );
}
