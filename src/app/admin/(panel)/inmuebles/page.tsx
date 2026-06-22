import Link from "next/link";
import { ExternalLink, FolderInput, Pencil, Plus, Search, Trash2 } from "lucide-react";
import { buttonVariants } from "@/components/ui/button";
import { getRepository } from "@/lib/data";
import { deletePropertyAction } from "@/lib/actions/admin-properties";
import { StatusBadge } from "@/components/ui/status-badge";
import {
  OPERATION_LABELS,
  PROPERTY_STATUSES,
  PROPERTY_STATUS_LABELS,
  PROPERTY_TYPE_LABELS,
  type PropertyFilters,
  type PropertyStatus,
} from "@/lib/domain";
import { formatPrice } from "@/lib/utils/format";

export const dynamic = "force-dynamic";

export default async function AdminInmueblesPage({
  searchParams,
}: {
  searchParams: Promise<{ q?: string; estado?: string }>;
}) {
  const sp = await searchParams;
  const estado = PROPERTY_STATUSES.includes(sp.estado as PropertyStatus)
    ? (sp.estado as PropertyStatus)
    : undefined;
  const filters: PropertyFilters = { q: sp.q || undefined, estado };
  const properties = await getRepository().properties.list(filters);

  return (
    <div className="space-y-6">
      <div className="flex flex-wrap items-center justify-between gap-3">
        <div>
          <h1 className="text-2xl font-bold tracking-tight text-ink">Inmuebles</h1>
          <p className="mt-0.5 text-sm text-muted">{properties.length} en el inventario</p>
        </div>
        <div className="flex flex-wrap items-center gap-2">
          <Link href="/admin/inmuebles/importar" className={buttonVariants({ variant: "outline", size: "md" })}>
            <FolderInput className="h-4 w-4" /> Importar de Drive
          </Link>
          <Link href="/admin/inmuebles/nuevo" className={buttonVariants({ variant: "primary", size: "md" })}>
            <Plus className="h-4 w-4" /> Nuevo inmueble
          </Link>
        </div>
      </div>

      <form method="get" className="flex flex-wrap items-center gap-2 rounded-2xl border border-line bg-white p-3">
        <div className="relative min-w-48 flex-1">
          <Search className="pointer-events-none absolute left-3.5 top-1/2 h-4 w-4 -translate-y-1/2 text-muted" />
          <input
            name="q"
            defaultValue={sp.q ?? ""}
            placeholder="Buscar por título, ciudad, código..."
            className="h-10 w-full rounded-xl border border-line bg-surface pl-10 pr-3 text-sm text-ink transition-colors focus:border-brand-500 focus:bg-white focus:outline-none focus:ring-2 focus:ring-brand-200"
          />
        </div>
        <select
          name="estado"
          defaultValue={estado ?? ""}
          className="h-10 rounded-xl border border-line bg-surface px-3 text-sm text-ink-soft transition-colors focus:border-brand-500 focus:bg-white focus:outline-none focus:ring-2 focus:ring-brand-200"
        >
          <option value="">Todos los estados</option>
          {PROPERTY_STATUSES.map((s) => (
            <option key={s} value={s}>{PROPERTY_STATUS_LABELS[s]}</option>
          ))}
        </select>
        <button className="h-10 shrink-0 rounded-xl bg-brand-700 px-4 text-sm font-semibold text-white shadow-[0_10px_26px_-12px_rgba(4,125,91,0.8)] transition-all duration-300 ease-[cubic-bezier(0.16,1,0.3,1)] hover:bg-brand-800 active:scale-[0.98]">
          Filtrar
        </button>
        {(sp.q || estado) && (
          <Link href="/admin/inmuebles" className="text-sm font-medium text-muted hover:text-ink">
            Limpiar
          </Link>
        )}
      </form>

      <div className="overflow-x-auto rounded-2xl border border-line bg-white">
        <table className="w-full text-left text-sm">
          <thead className="border-b border-line bg-surface text-xs uppercase tracking-wider text-muted">
            <tr>
              <th className="px-4 py-3 font-semibold">Código</th>
              <th className="px-4 py-3 font-semibold">Título</th>
              <th className="px-4 py-3 font-semibold">Ciudad</th>
              <th className="px-4 py-3 font-semibold">Operación</th>
              <th className="px-4 py-3 font-semibold">Precio</th>
              <th className="px-4 py-3 font-semibold">Estado</th>
              <th className="px-4 py-3 text-right font-semibold">Acciones</th>
            </tr>
          </thead>
          <tbody className="divide-y divide-line">
            {properties.map((p) => (
              <tr key={p.id} className="transition-colors hover:bg-surface">
                <td className="px-4 py-3 font-mono text-xs text-muted">{p.codigo}</td>
                <td className="px-4 py-3">
                  <p className="font-medium text-ink">{p.titulo}</p>
                  <p className="text-xs text-muted">{PROPERTY_TYPE_LABELS[p.tipo]}{p.publicado ? "" : " · borrador"}</p>
                </td>
                <td className="px-4 py-3 text-ink-soft">{p.ubicacion.ciudad}</td>
                <td className="px-4 py-3 text-ink-soft">{OPERATION_LABELS[p.operacion]}</td>
                <td className="px-4 py-3 font-semibold text-ink">{formatPrice(p.precio, p.moneda)}</td>
                <td className="px-4 py-3"><StatusBadge status={p.estado} /></td>
                <td className="px-4 py-3">
                  <div className="flex items-center justify-end gap-1">
                    <Link
                      href={`/inmuebles/${p.slug}`}
                      target="_blank"
                      className="rounded-lg p-2 text-muted transition-colors hover:bg-brand-50 hover:text-brand-700"
                      aria-label="Ver en el sitio"
                    >
                      <ExternalLink className="h-4 w-4" />
                    </Link>
                    <Link
                      href={`/admin/inmuebles/${p.id}`}
                      className="rounded-lg p-2 text-muted transition-colors hover:bg-brand-50 hover:text-brand-700"
                      aria-label="Editar"
                    >
                      <Pencil className="h-4 w-4" />
                    </Link>
                    <form action={deletePropertyAction}>
                      <input type="hidden" name="id" value={p.id} />
                      <button
                        className="rounded-lg p-2 text-muted transition-colors hover:bg-rose-50 hover:text-rose-600"
                        aria-label="Eliminar"
                      >
                        <Trash2 className="h-4 w-4" />
                      </button>
                    </form>
                  </div>
                </td>
              </tr>
            ))}
            {properties.length === 0 && (
              <tr>
                <td colSpan={7} className="px-4 py-12 text-center text-muted">
                  No hay inmuebles. Crea el primero.
                </td>
              </tr>
            )}
          </tbody>
        </table>
      </div>
    </div>
  );
}
