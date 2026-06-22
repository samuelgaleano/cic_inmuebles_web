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
  "h-11 rounded-xl border border-line bg-surface px-3 text-sm text-ink-soft transition-colors focus:border-brand-500 focus:bg-white focus:outline-none focus:ring-2 focus:ring-brand-200";

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
    <div className={`rounded-[1.4rem] border border-line bg-white p-4 shadow-[0_10px_40px_-28px_rgba(11,26,21,0.35)] ${isPending ? "opacity-70" : ""}`}>
      <form onSubmit={onSearch} className="flex gap-2">
        <div className="relative flex-1">
          <Search className="pointer-events-none absolute left-3.5 top-1/2 h-4 w-4 -translate-y-1/2 text-muted" />
          <input
            type="search"
            name="q"
            defaultValue={params.get("q") ?? ""}
            placeholder="Buscar por ciudad, barrio, código..."
            className="h-11 w-full rounded-xl border border-line bg-surface pl-10 pr-3 text-sm text-ink transition-colors focus:border-brand-500 focus:bg-white focus:outline-none focus:ring-2 focus:ring-brand-200"
          />
        </div>
        <button
          type="submit"
          className="h-11 shrink-0 rounded-xl bg-brand-700 px-5 text-sm font-semibold text-white shadow-[0_10px_26px_-12px_rgba(4,125,91,0.8)] transition-all duration-300 ease-[cubic-bezier(0.16,1,0.3,1)] hover:bg-brand-800 active:scale-[0.98]"
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
          className="mt-3 inline-flex items-center gap-1 text-sm font-medium text-muted hover:text-brand-700"
        >
          <X className="h-4 w-4" /> Limpiar filtros
        </button>
      )}
    </div>
  );
}
