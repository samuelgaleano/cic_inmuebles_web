import type { Metadata } from "next";
import { Suspense } from "react";
import { PropertyFilters } from "@/components/public/property-filters";
import { PropertyGrid } from "@/components/public/property-grid";
import { getRepository } from "@/lib/data";
import {
  OPERATIONS,
  PROPERTY_STATUSES,
  PROPERTY_TYPES,
  type Operation,
  type PropertyFilters as Filters,
  type PropertyStatus,
  type PropertyType,
} from "@/lib/domain";

export const metadata: Metadata = {
  title: "Inmuebles",
  description: "Explora el catálogo de inmuebles en venta y arriendo de CIC Inmuebles.",
};

type SearchParams = Record<string, string | string[] | undefined>;

function first(v: string | string[] | undefined): string | undefined {
  return Array.isArray(v) ? v[0] : v;
}

function parseFilters(sp: SearchParams): Filters {
  const tipo = first(sp.tipo);
  const operacion = first(sp.operacion);
  const estado = first(sp.estado);
  const habMin = first(sp.habitacionesMin);
  return {
    q: first(sp.q),
    ciudad: first(sp.ciudad),
    tipo: PROPERTY_TYPES.includes(tipo as PropertyType) ? (tipo as PropertyType) : undefined,
    operacion: OPERATIONS.includes(operacion as Operation) ? (operacion as Operation) : undefined,
    estado: PROPERTY_STATUSES.includes(estado as PropertyStatus)
      ? (estado as PropertyStatus)
      : undefined,
    habitacionesMin: habMin ? Number(habMin) || undefined : undefined,
  };
}

export default async function InmueblesPage({
  searchParams,
}: {
  searchParams: Promise<SearchParams>;
}) {
  const sp = await searchParams;
  const filters = parseFilters(sp);

  const repo = getRepository();
  const [properties, cities] = await Promise.all([
    repo.properties.listPublic(filters),
    repo.properties.listCities(),
  ]);

  return (
    <div className="mx-auto max-w-7xl px-4 py-10 sm:px-6 lg:px-8">
      <header className="mb-6">
        <h1 className="text-3xl font-bold tracking-tight text-slate-900">Catálogo de inmuebles</h1>
        <p className="mt-1 text-slate-600">
          {properties.length} inmueble{properties.length === 1 ? "" : "s"} encontrado
          {properties.length === 1 ? "" : "s"}
        </p>
      </header>

      <div className="mb-8">
        <Suspense fallback={<div className="h-40 rounded-xl bg-slate-100" />}>
          <PropertyFilters cities={cities} />
        </Suspense>
      </div>

      <PropertyGrid properties={properties} />
    </div>
  );
}
