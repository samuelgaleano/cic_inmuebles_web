import Link from "next/link";
import { FileText, Pencil, Plus, Trash2 } from "lucide-react";
import { getRepository } from "@/lib/data";
import { deleteTemplateAction } from "@/lib/actions/admin-templates";
import { TEMPLATE_TYPE_LABELS } from "@/lib/domain";

export const dynamic = "force-dynamic";

export default async function AdminPlantillasPage() {
  const templates = await getRepository().templates.list();

  return (
    <div className="space-y-6">
      <div className="flex flex-wrap items-center justify-between gap-3">
        <div>
          <h1 className="text-2xl font-bold text-slate-900">Plantillas</h1>
          <p className="text-slate-500">Documentos reutilizables (promesa de compraventa, contratos…).</p>
        </div>
        <Link
          href="/admin/plantillas/nueva"
          className="inline-flex h-10 items-center gap-2 rounded-lg bg-brand-700 px-4 text-sm font-semibold text-white hover:bg-brand-800"
        >
          <Plus className="h-4 w-4" /> Nueva plantilla
        </Link>
      </div>

      <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
        {templates.map((t) => (
          <div key={t.id} className="flex flex-col rounded-xl border border-slate-200 bg-white p-5">
            <FileText className="h-6 w-6 text-brand-600" />
            <h3 className="mt-3 font-semibold text-slate-900">{t.nombre}</h3>
            <span className="mt-1 inline-block w-fit rounded-full bg-brand-50 px-2 py-0.5 text-xs font-medium text-brand-700">
              {TEMPLATE_TYPE_LABELS[t.tipo]}
            </span>
            <p className="mt-3 line-clamp-3 flex-1 text-sm text-slate-500">{t.contenido}</p>
            <div className="mt-4 flex items-center gap-1 border-t border-slate-100 pt-3">
              <Link
                href={`/admin/plantillas/${t.id}`}
                className="inline-flex items-center gap-1.5 rounded-md px-2 py-1 text-sm font-medium text-brand-700 hover:bg-brand-50"
              >
                <Pencil className="h-4 w-4" /> Editar
              </Link>
              <form action={deleteTemplateAction} className="ml-auto">
                <input type="hidden" name="id" value={t.id} />
                <button className="rounded-md p-2 text-slate-400 hover:bg-rose-50 hover:text-rose-600" aria-label="Eliminar">
                  <Trash2 className="h-4 w-4" />
                </button>
              </form>
            </div>
          </div>
        ))}
        {templates.length === 0 && (
          <p className="col-span-full rounded-xl border border-dashed border-slate-300 bg-white py-12 text-center text-slate-400">
            No hay plantillas. Crea la primera.
          </p>
        )}
      </div>
    </div>
  );
}
