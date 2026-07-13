import type { Metadata } from "next";
import { Suspense } from "react";
import { PropertyFilters } from "@/components/public/property-filters";
import { PropertyGrid } from "@/components/public/property-grid";
import { Pagination } from "@/components/public/pagination";
import { JsonLd } from "@/components/seo/json-ld";
import { propertyUrl } from "@/lib/config/site";
import { getRepository } from "@/lib/data";
import {
  PROPERTY_STATUSES,
  PROPERTY_TYPES,
  type PropertyFilters as Filters,
  type PropertyStatus,
  type PropertyType,
  type PublicProperty,
} from "@/lib/domain";

export const metadata: Metadata = {
  title: "Inmuebles en venta",
  description:
    "Explora apartamentos y casas en venta en Bogotá y toda Colombia. Filtra por ciudad, tipo y precio, y agenda tu visita con CIC Inmuebles.",
  alternates: { canonical: "/inmuebles" },
};

type SearchParams = Record<string, string | string[] | undefined>;

const PAGE_SIZE = 9;

function first(v: string | string[] | undefined): string | undefined {
  return Array.isArray(v) ? v[0] : v;
}

function parseFilters(sp: SearchParams): Filters {
  const tipo = first(sp.tipo);
  const estado = first(sp.estado);
  const habMin = first(sp.habitacionesMin);
  const precioMin = first(sp.precioMin);
  const precioMax = first(sp.precioMax);
  return {
    q: first(sp.q),
    ciudad: first(sp.ciudad),
    tipo: PROPERTY_TYPES.includes(tipo as PropertyType) ? (tipo as PropertyType) : undefined,
    estado: PROPERTY_STATUSES.includes(estado as PropertyStatus)
      ? (estado as PropertyStatus)
      : undefined,
    habitacionesMin: habMin ? Number(habMin) || undefined : undefined,
    precioMin: precioMin ? Number(precioMin) || undefined : undefined,
    precioMax: precioMax ? Number(precioMax) || undefined : undefined,
  };
}

function applySort(items: PublicProperty[], orden?: string): PublicProperty[] {
  switch (orden) {
    case "precio_asc":
      return [...items].sort((a, b) => a.precio - b.precio);
    case "precio_desc":
      return [...items].sort((a, b) => b.precio - a.precio);
    case "recientes":
      return [...items].sort((a, b) => b.actualizadoEn.localeCompare(a.actualizadoEn));
    default:
      return items; // relevancia (orden del repositorio)
  }
}

export default async function InmueblesPage({
  searchParams,
}: {
  searchParams: Promise<SearchParams>;
}) {
  const sp = await searchParams;
  const filters = parseFilters(sp);
  const orden = first(sp.orden);
  const page = Math.max(1, Number(first(sp.page)) || 1);

  const repo = getRepository();
  let all: PublicProperty[] = [];
  let cities: string[] = [];
  try {
    [all, cities] = await Promise.all([
      repo.properties.listPublic(filters),
      repo.properties.listCities(),
    ]);
  } catch (err) {
    console.error("[inmuebles] error al cargar catálogo:", err);
  }

  const sorted = applySort(all, orden);
  const total = sorted.length;
  const totalPages = Math.max(1, Math.ceil(total / PAGE_SIZE));
  const safePage = Math.min(page, totalPages);
  const pageItems = sorted.slice((safePage - 1) * PAGE_SIZE, safePage * PAGE_SIZE);

  // Datos estructurados (schema.org): lista de inmuebles visibles en esta
  // página. Se omite cuando no hay resultados (un ItemList vacío no aporta).
  const jsonLd =
    pageItems.length > 0
      ? {
          "@context": "https://schema.org",
          "@type": "ItemList",
          name: "Inmuebles en venta",
          numberOfItems: pageItems.length,
          itemListElement: pageItems.map((p, i) => ({
            "@type": "ListItem",
            position: (safePage - 1) * PAGE_SIZE + i + 1,
            name: p.titulo,
            url: propertyUrl(p.slug),
          })),
        }
      : null;

  return (
    <div className="mx-auto max-w-6xl px-4 py-12 sm:px-6 lg:px-8">
      {jsonLd && <JsonLd data={jsonLd} />}
      <header className="mb-8">
        <p className="text-xs font-semibold uppercase tracking-[0.2em] text-brand-600">Catálogo</p>
        <h1 className="mt-2 text-3xl font-bold tracking-tight text-ink sm:text-4xl">Inmuebles en venta</h1>
        <p className="mt-2 text-muted">
          <span className="font-semibold text-ink">{total}</span> inmueble{total === 1 ? "" : "s"} disponible{total === 1 ? "" : "s"}
        </p>
      </header>

      <div className="mb-8">
        <Suspense fallback={<div className="h-40 rounded-[1.4rem] bg-surface" />}>
          <PropertyFilters cities={cities} />
        </Suspense>
      </div>

      <PropertyGrid properties={pageItems} />
      <Pagination currentPage={safePage} totalPages={totalPages} params={sp} />
    </div>
  );
}
