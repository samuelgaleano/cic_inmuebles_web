"use client";

import { useRouter, useSearchParams } from "next/navigation";
import { useCallback, useTransition } from "react";
import { Search, X } from "lucide-react";
import {
  OPERATIONS,
  OPERATION_LABELS,
  PROPERTY_STATUSES,
  PROPERTY_STATUS_LABELS,
  PROPERTY_TYPES,
  PROPERTY_TYPE_LABELS,
} from "@/lib/domain";

const selectClass =
  "h-11 rounded-lg border border-slate-300 bg-white px-3 text-sm text-slate-700 focus:border-brand-500 focus:outline-none focus:ring-2 focus:ring-brand-200";

export function PropertyFilters({ cities }: { cities: string[] }) {
  const router = useRouter();
  const params = useSearchParams();
  const [isPending, startTransition] = useTransition();

  const update = useCallback(
    (key: string, value: string) => {
      const next = new URLSearchParams(params.toString());
      if (value) next.set(key, value);
      else next.delete(key);
      startTransition(() => {
        router.push(`/inmuebles?${next.toString()}`, { scroll: false });
      });
    },
    [params, router],
  );

  const onSearch = useCallback(
    (e: React.FormEvent<HTMLFormElement>) => {
      e.preventDefault();
      const data = new FormData(e.currentTarget);
      update("q", String(data.get("q") ?? ""));
    },
    [update],
  );

  const hasFilters = [...params.keys()].length > 0;

  return (
    <div className={`rounded-xl border border-slate-200 bg-white p-4 shadow-sm ${isPending ? "opacity-70" : ""}`}>
      <form onSubmit={onSearch} className="flex gap-2">
        <div className="relative flex-1">
          <Search className="pointer-events-none absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-slate-400" />
          <input
            type="search"
            name="q"
            defaultValue={params.get("q") ?? ""}
            placeholder="Buscar por ciudad, barrio, código..."
            className="h-11 w-full rounded-lg border border-slate-300 pl-9 pr-3 text-sm focus:border-brand-500 focus:outline-none focus:ring-2 focus:ring-brand-200"
          />
        </div>
        <button
          type="submit"
          className="h-11 rounded-lg bg-brand-700 px-4 text-sm font-medium text-white hover:bg-brand-800"
        >
          Buscar
        </button>
      </form>

      <div className="mt-3 grid grid-cols-2 gap-2 sm:grid-cols-3 lg:grid-cols-5">
        <select
          aria-label="Operación"
          className={selectClass}
          value={params.get("operacion") ?? ""}
          onChange={(e) => update("operacion", e.target.value)}
        >
          <option value="">Operación</option>
          {OPERATIONS.map((o) => (
            <option key={o} value={o}>{OPERATION_LABELS[o]}</option>
          ))}
        </select>

        <select
          aria-label="Tipo"
          className={selectClass}
          value={params.get("tipo") ?? ""}
          onChange={(e) => update("tipo", e.target.value)}
        >
          <option value="">Tipo</option>
          {PROPERTY_TYPES.map((t) => (
            <option key={t} value={t}>{PROPERTY_TYPE_LABELS[t]}</option>
          ))}
        </select>

        <select
          aria-label="Ciudad"
          className={selectClass}
          value={params.get("ciudad") ?? ""}
          onChange={(e) => update("ciudad", e.target.value)}
        >
          <option value="">Ciudad</option>
          {cities.map((c) => (
            <option key={c} value={c}>{c}</option>
          ))}
        </select>

        <select
          aria-label="Habitaciones mínimas"
          className={selectClass}
          value={params.get("habitacionesMin") ?? ""}
          onChange={(e) => update("habitacionesMin", e.target.value)}
        >
          <option value="">Habitaciones</option>
          {[1, 2, 3, 4].map((n) => (
            <option key={n} value={n}>{n}+ hab</option>
          ))}
        </select>

        <select
          aria-label="Estado"
          className={selectClass}
          value={params.get("estado") ?? ""}
          onChange={(e) => update("estado", e.target.value)}
        >
          <option value="">Estado</option>
          {PROPERTY_STATUSES.map((s) => (
            <option key={s} value={s}>{PROPERTY_STATUS_LABELS[s]}</option>
          ))}
        </select>
      </div>

      <div className="mt-2 grid grid-cols-2 gap-2 sm:grid-cols-4">
        <input
          type="number"
          inputMode="numeric"
          aria-label="Precio mínimo"
          placeholder="Precio mín."
          defaultValue={params.get("precioMin") ?? ""}
          onBlur={(e) => update("precioMin", e.target.value)}
          className={selectClass}
        />
        <input
          type="number"
          inputMode="numeric"
          aria-label="Precio máximo"
          placeholder="Precio máx."
          defaultValue={params.get("precioMax") ?? ""}
          onBlur={(e) => update("precioMax", e.target.value)}
          className={selectClass}
        />
        <select
          aria-label="Ordenar"
          className={`${selectClass} sm:col-span-2`}
          value={params.get("orden") ?? ""}
          onChange={(e) => update("orden", e.target.value)}
        >
          <option value="">Ordenar: relevancia</option>
          <option value="precio_asc">Precio: menor a mayor</option>
          <option value="precio_desc">Precio: mayor a menor</option>
          <option value="recientes">Más recientes</option>
        </select>
      </div>

      {hasFilters && (
        <button
          type="button"
          onClick={() => startTransition(() => router.push("/inmuebles", { scroll: false }))}
          className="mt-3 inline-flex items-center gap-1 text-sm font-medium text-slate-500 hover:text-brand-700"
        >
          <X className="h-4 w-4" /> Limpiar filtros
        </button>
      )}
    </div>
  );
}
