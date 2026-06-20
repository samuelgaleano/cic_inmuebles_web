import Link from "next/link";
import { ExternalLink, Pencil, Plus, Search, Trash2 } from "lucide-react";
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
          <h1 className="text-2xl font-bold text-slate-900">Inmuebles</h1>
          <p className="text-slate-500">{properties.length} en el inventario</p>
        </div>
        <Link
          href="/admin/inmuebles/nuevo"
          className="inline-flex h-10 items-center gap-2 rounded-lg bg-brand-700 px-4 text-sm font-semibold text-white hover:bg-brand-800"
        >
          <Plus className="h-4 w-4" /> Nuevo inmueble
        </Link>
      </div>

      <form method="get" className="flex flex-wrap items-center gap-2 rounded-xl border border-slate-200 bg-white p-3">
        <div className="relative min-w-48 flex-1">
          <Search className="pointer-events-none absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-slate-400" />
          <input
            name="q"
            defaultValue={sp.q ?? ""}
            placeholder="Buscar por título, ciudad, código..."
            className="h-10 w-full rounded-lg border border-slate-300 pl-9 pr-3 text-sm focus:border-brand-500 focus:outline-none focus:ring-2 focus:ring-brand-200"
          />
        </div>
        <select
          name="estado"
          defaultValue={estado ?? ""}
          className="h-10 rounded-lg border border-slate-300 bg-white px-3 text-sm"
        >
          <option value="">Todos los estados</option>
          {PROPERTY_STATUSES.map((s) => (
            <option key={s} value={s}>{PROPERTY_STATUS_LABELS[s]}</option>
          ))}
        </select>
        <button className="h-10 rounded-lg bg-brand-700 px-4 text-sm font-semibold text-white hover:bg-brand-800">
          Filtrar
        </button>
        {(sp.q || estado) && (
          <Link href="/admin/inmuebles" className="text-sm text-slate-500 hover:text-slate-700">
            Limpiar
          </Link>
        )}
      </form>

      <div className="overflow-x-auto rounded-xl border border-slate-200 bg-white">
        <table className="w-full text-left text-sm">
          <thead className="border-b border-slate-200 bg-slate-50 text-xs uppercase text-slate-500">
            <tr>
              <th className="px-4 py-3">Código</th>
              <th className="px-4 py-3">Título</th>
              <th className="px-4 py-3">Ciudad</th>
              <th className="px-4 py-3">Operación</th>
              <th className="px-4 py-3">Precio</th>
              <th className="px-4 py-3">Estado</th>
              <th className="px-4 py-3 text-right">Acciones</th>
            </tr>
          </thead>
          <tbody className="divide-y divide-slate-100">
            {properties.map((p) => (
              <tr key={p.id} className="hover:bg-slate-50">
                <td className="px-4 py-3 font-mono text-xs text-slate-500">{p.codigo}</td>
                <td className="px-4 py-3">
                  <p className="font-medium text-slate-800">{p.titulo}</p>
                  <p className="text-xs text-slate-400">{PROPERTY_TYPE_LABELS[p.tipo]}{p.publicado ? "" : " · borrador"}</p>
                </td>
                <td className="px-4 py-3 text-slate-600">{p.ubicacion.ciudad}</td>
                <td className="px-4 py-3 text-slate-600">{OPERATION_LABELS[p.operacion]}</td>
                <td className="px-4 py-3 font-medium text-slate-800">{formatPrice(p.precio, p.moneda)}</td>
                <td className="px-4 py-3"><StatusBadge status={p.estado} /></td>
                <td className="px-4 py-3">
                  <div className="flex items-center justify-end gap-1">
                    <Link
                      href={`/inmuebles/${p.slug}`}
                      target="_blank"
                      className="rounded-md p-2 text-slate-400 hover:bg-slate-100 hover:text-brand-700"
                      aria-label="Ver en el sitio"
                    >
                      <ExternalLink className="h-4 w-4" />
                    </Link>
                    <Link
                      href={`/admin/inmuebles/${p.id}`}
                      className="rounded-md p-2 text-slate-400 hover:bg-slate-100 hover:text-brand-700"
                      aria-label="Editar"
                    >
                      <Pencil className="h-4 w-4" />
                    </Link>
                    <form action={deletePropertyAction}>
                      <input type="hidden" name="id" value={p.id} />
                      <button
                        className="rounded-md p-2 text-slate-400 hover:bg-rose-50 hover:text-rose-600"
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
                <td colSpan={7} className="px-4 py-10 text-center text-slate-400">
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
