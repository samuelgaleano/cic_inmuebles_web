import type { Metadata } from "next";
import { Suspense } from "react";
import { FavoritosVista } from "@/components/public/favoritos-vista";
import { getPublicInventory } from "@/lib/data/public-inventory";
import { construirIndice } from "@/lib/search/indice";

// Es una lista personal (vive en el navegador de cada visitante): no se indexa.
export const metadata: Metadata = {
  title: "Tus favoritos",
  description: "Los inmuebles que guardaste: compáralos, compártelos o envíaselos a un asesor.",
  alternates: { canonical: "/favoritos" },
  robots: { index: false, follow: true },
};

export const revalidate = 300;

export default async function FavoritosPage() {
  const indice = construirIndice(await getPublicInventory());

  return (
    <>
      <header className="wrap pb-10 pt-14 sm:pb-12 sm:pt-20">
        <h1 className="t-display max-w-4xl">Tus favoritos</h1>
        <p className="t-lead mt-5 max-w-2xl">
          Guardados en este navegador, sin crear cuenta. Compáralos, compártelos con quien decide contigo o envíaselos a un asesor.
        </p>
      </header>
      <Suspense fallback={<div className="wrap min-h-[24rem]" aria-busy="true" />}>
        <FavoritosVista indice={indice} />
      </Suspense>
      <div className="h-28" />
    </>
  );
}
