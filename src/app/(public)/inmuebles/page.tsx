import type { Metadata } from "next";
import Link from "next/link";
import { Suspense } from "react";
import { PropertyFilters } from "@/components/public/property-filters";
import { PropertyGrid } from "@/components/public/property-grid";
import { Pagination } from "@/components/public/pagination";
import { JsonLd } from "@/components/seo/json-ld";
import { propertyUrl, siteConfig } from "@/lib/config/site";
import { getRepository } from "@/lib/data";
import { getPublicInventory } from "@/lib/data/public-inventory";
import {
  PROPERTY_STATUSES,
  PROPERTY_TYPES,
  type PropertyFilters as Filters,
  type PropertyStatus,
  type PropertyType,
  type PublicProperty,
} from "@/lib/domain";
import { agruparPorSector, sectorPath } from "@/lib/seo/sectores";
import { titularInventario } from "@/lib/seo/titular";

export async function generateMetadata(): Promise<Metadata> {
  const t = titularInventario(await getPublicInventory());
  const donde = t.sectores.length > 0 ? `${t.lugar}: ${t.sectores.slice(0, 5).join(", ")}` : t.lugar;
  return {
    title: t.titulo,
    description: `${t.tipos} en venta en ${donde}. Filtra por precio y características y agenda tu visita con ${siteConfig.name}.`.slice(0, 160),
    alternates: { canonical: "/inmuebles" },
  };
}

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
  let todos: PublicProperty[] = [];
  try {
    [all, cities, todos] = await Promise.all([
      repo.properties.listPublic(filters),
      repo.properties.listCities(),
      getPublicInventory(),
    ]);
  } catch (err) {
    console.error("[inmuebles] error al cargar catálogo:", err);
  }
  const titular = titularInventario(todos);
  const sectores = agruparPorSector(todos);

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
          name: titular.titulo,
          numberOfItems: pageItems.length,
          itemListElement: pageItems.map((p, i) => ({
            "@type": "ListItem",
            position: (safePage - 1) * PAGE_SIZE + i + 1,
            name: [p.titulo, p.ubicacion.sector, p.ubicacion.ciudad].filter(Boolean).join(" · "),
            url: propertyUrl(p.slug),
          })),
        }
      : null;

  return (
    <div className="mx-auto max-w-6xl px-4 py-12 sm:px-6 lg:px-8">
      {jsonLd && <JsonLd data={jsonLd} />}
      <header className="mb-8">
        <p className="text-xs font-semibold uppercase tracking-[0.2em] text-brand-700">Catálogo</p>
        <h1 className="mt-2 text-balance text-3xl font-bold tracking-tight text-ink sm:text-4xl">{titular.titulo}</h1>
        <p className="mt-2 text-muted">
          <span className="font-semibold text-ink">{total}</span> inmueble{total === 1 ? "" : "s"} disponible{total === 1 ? "" : "s"}
        </p>
        {sectores.length > 0 && (
          <nav className="mt-4" aria-label="Sectores">
            <ul className="flex flex-wrap gap-2">
              {sectores.map((s) => (
                <li key={s.slug}>
                  <Link
                    href={sectorPath(s)}
                    className="inline-flex items-center gap-1.5 rounded-full border border-line bg-white px-3.5 py-1.5 text-sm font-medium text-ink transition-colors hover:border-brand-300 hover:bg-brand-50 hover:text-brand-800"
                  >
                    {s.nombre}
                    <span className="text-xs text-muted">{s.inmuebles.length}</span>
                  </Link>
                </li>
              ))}
            </ul>
          </nav>
        )}
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
