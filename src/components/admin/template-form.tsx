import Link from "next/link";
import { Save } from "lucide-react";
import { TEMPLATE_TYPES, TEMPLATE_TYPE_LABELS, type Template } from "@/lib/domain";

const inputClass =
  "h-11 w-full rounded-lg border border-slate-300 px-3 text-sm focus:border-brand-500 focus:outline-none focus:ring-2 focus:ring-brand-200";

/** Formulario de plantilla (server component; usa una server action por prop). */
export function TemplateForm({
  action,
  template,
}: {
  action: (formData: FormData) => void | Promise<void>;
  template?: Template;
}) {
  return (
    <form action={action} className="space-y-5">
      <div className="grid gap-4 sm:grid-cols-2">
        <div>
          <label className="mb-1 block text-sm font-medium text-slate-700">Nombre</label>
          <input name="nombre" defaultValue={template?.nombre} className={inputClass} required />
        </div>
        <div>
          <label className="mb-1 block text-sm font-medium text-slate-700">Tipo</label>
          <select name="tipo" defaultValue={template?.tipo ?? "promesa_compraventa"} className={inputClass}>
            {TEMPLATE_TYPES.map((t) => (
              <option key={t} value={t}>{TEMPLATE_TYPE_LABELS[t]}</option>
            ))}
          </select>
        </div>
      </div>
      <div>
        <label className="mb-1 block text-sm font-medium text-slate-700">Contenido</label>
        <textarea
          name="contenido"
          rows={18}
          defaultValue={template?.contenido}
          className="w-full rounded-lg border border-slate-300 px-3 py-2 font-mono text-sm focus:border-brand-500 focus:outline-none focus:ring-2 focus:ring-brand-200"
          required
        />
        <p className="mt-1 text-xs text-slate-400">
          Usa marcadores como [VENDEDOR], [COMPRADOR], [DIRECCIÓN], [PRECIO] para completar luego.
        </p>
      </div>
      <div className="flex items-center gap-3">
        <button className="inline-flex h-11 items-center gap-2 rounded-lg bg-brand-700 px-6 font-semibold text-white hover:bg-brand-800">
          <Save className="h-4 w-4" /> Guardar
        </button>
        <Link href="/admin/plantillas" className="text-sm font-medium text-slate-500 hover:text-slate-700">
          Cancelar
        </Link>
      </div>
    </form>
  );
}
