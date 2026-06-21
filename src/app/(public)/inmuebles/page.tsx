import type { Metadata } from "next";
import { Suspense } from "react";
import { PropertyFilters } from "@/components/public/property-filters";
import { PropertyGrid } from "@/components/public/property-grid";
import { Pagination } from "@/components/public/pagination";
import { getRepository } from "@/lib/data";
import {
  OPERATIONS,
  PROPERTY_STATUSES,
  PROPERTY_TYPES,
  type Operation,
  type PropertyFilters as Filters,
  type PropertyStatus,
  type PropertyType,
  type PublicProperty,
} from "@/lib/domain";

export const metadata: Metadata = {
  title: "Inmuebles",
  description: "Explora el catálogo de inmuebles en venta y arriendo de CIC Inmuebles.",
};

type SearchParams = Record<string, string | string[] | undefined>;

const PAGE_SIZE = 9;

function first(v: string | string[] | undefined): string | undefined {
  return Array.isArray(v) ? v[0] : v;
}

function parseFilters(sp: SearchParams): Filters {
  const tipo = first(sp.tipo);
  const operacion = first(sp.operacion);
  const estado = first(sp.estado);
  const habMin = first(sp.habitacionesMin);
  const precioMin = first(sp.precioMin);
  const precioMax = first(sp.precioMax);
  return {
    q: first(sp.q),
    ciudad: first(sp.ciudad),
    tipo: PROPERTY_TYPES.includes(tipo as PropertyType) ? (tipo as PropertyType) : undefined,
    operacion: OPERATIONS.includes(operacion as Operation) ? (operacion as Operation) : undefined,
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

  return (
    <div className="mx-auto max-w-7xl px-4 py-10 sm:px-6 lg:px-8">
      <header className="mb-6">
        <h1 className="text-3xl font-bold tracking-tight text-slate-900">Catálogo de inmuebles</h1>
        <p className="mt-1 text-slate-600">
          {total} inmueble{total === 1 ? "" : "s"} encontrado{total === 1 ? "" : "s"}
        </p>
      </header>

      <div className="mb-8">
        <Suspense fallback={<div className="h-40 rounded-xl bg-slate-100" />}>
          <PropertyFilters cities={cities} />
        </Suspense>
      </div>

      <PropertyGrid properties={pageItems} />
      <Pagination currentPage={safePage} totalPages={totalPages} params={sp} />
    </div>
  );
}
