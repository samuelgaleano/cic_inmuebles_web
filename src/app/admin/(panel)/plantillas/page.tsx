import Link from "next/link";
import { FileText, Pencil, Plus, Trash2 } from "lucide-react";
import { buttonVariants } from "@/components/ui/button";
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
          <h1 className="text-2xl font-bold tracking-tight text-ink">Plantillas</h1>
          <p className="mt-0.5 text-sm text-muted">Documentos reutilizables (promesa de compraventa, contratos…).</p>
        </div>
        <Link href="/admin/plantillas/nueva" className={buttonVariants({ variant: "primary", size: "md" })}>
          <Plus className="h-4 w-4" /> Nueva plantilla
        </Link>
      </div>

      <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
        {templates.map((t) => (
          <div
            key={t.id}
            className="group flex flex-col rounded-2xl border border-line bg-white p-5 transition-all duration-500 ease-[cubic-bezier(0.16,1,0.3,1)] hover:-translate-y-1 hover:shadow-[0_24px_44px_-28px_rgba(11,26,21,0.3)]"
          >
            <span className="flex h-11 w-11 items-center justify-center rounded-xl bg-brand-50 text-brand-700">
              <FileText className="h-5 w-5" />
            </span>
            <h3 className="mt-4 font-bold text-ink">{t.nombre}</h3>
            <span className="mt-1.5 inline-block w-fit rounded-full bg-brand-50 px-2.5 py-0.5 text-xs font-semibold text-brand-700">
              {TEMPLATE_TYPE_LABELS[t.tipo]}
            </span>
            <p className="mt-3 line-clamp-3 flex-1 text-sm text-muted">{t.contenido}</p>
            <div className="mt-4 flex items-center gap-1 border-t border-line pt-3">
              <Link
                href={`/admin/plantillas/${t.id}`}
                className="inline-flex items-center gap-1.5 rounded-lg px-2.5 py-1.5 text-sm font-semibold text-brand-700 transition-colors hover:bg-brand-50"
              >
                <Pencil className="h-4 w-4" /> Editar
              </Link>
              <form action={deleteTemplateAction} className="ml-auto">
                <input type="hidden" name="id" value={t.id} />
                <button className="rounded-lg p-2 text-muted transition-colors hover:bg-rose-50 hover:text-rose-600" aria-label="Eliminar">
                  <Trash2 className="h-4 w-4" />
                </button>
              </form>
            </div>
          </div>
        ))}
        {templates.length === 0 && (
          <p className="col-span-full rounded-2xl border border-dashed border-line bg-surface py-16 text-center text-muted">
            No hay plantillas. Crea la primera.
          </p>
        )}
      </div>
    </div>
  );
}
