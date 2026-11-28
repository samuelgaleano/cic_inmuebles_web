/** Esqueleto de carga de un listado del panel (loading.tsx de Leads y CRM): título, filtros y filas. */
export function EsqueletoListado({ titulo, filas = 6 }: { titulo: string; filas?: number }) {
  return (
    <div className="space-y-5" aria-busy="true">
      <div>
        <h1 className="text-2xl font-bold tracking-tight text-ink">{titulo}</h1>
        <p className="mt-1 h-4 w-48 animate-pulse rounded bg-ink/[0.07]" />
      </div>
      <div className="flex gap-2">
        {[0, 1, 2].map((i) => (
          <span key={i} className="h-9 w-24 animate-pulse rounded-full bg-ink/[0.07]" />
        ))}
      </div>
      <ul className="space-y-3">
        {Array.from({ length: filas }, (_, i) => (
          <li key={i} className="flex items-center justify-between gap-3 rounded-2xl border border-line bg-white p-4">
            <div className="flex-1 space-y-2">
              <span className="block h-4 w-2/5 animate-pulse rounded bg-ink/[0.07]" />
              <span className="block h-3 w-3/5 animate-pulse rounded bg-ink/[0.05]" />
            </div>
            <span className="h-11 w-11 animate-pulse rounded-xl bg-ink/[0.07]" />
          </li>
        ))}
      </ul>
      <p className="sr-only" role="status">
        Cargando…
      </p>
    </div>
  );
}
