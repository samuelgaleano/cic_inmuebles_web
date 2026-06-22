import Link from "next/link";
import { Save } from "lucide-react";
import { TEMPLATE_TYPES, TEMPLATE_TYPE_LABELS, type Template } from "@/lib/domain";

const inputClass =
  "h-11 w-full rounded-xl border border-line bg-surface px-3.5 text-sm text-ink transition-colors focus:border-brand-500 focus:bg-white focus:outline-none focus:ring-2 focus:ring-brand-200";

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
          <label className="mb-1.5 block text-sm font-medium text-ink-soft">Nombre</label>
          <input name="nombre" defaultValue={template?.nombre} className={inputClass} required />
        </div>
        <div>
          <label className="mb-1.5 block text-sm font-medium text-ink-soft">Tipo</label>
          <select name="tipo" defaultValue={template?.tipo ?? "promesa_compraventa"} className={inputClass}>
            {TEMPLATE_TYPES.map((t) => (
              <option key={t} value={t}>{TEMPLATE_TYPE_LABELS[t]}</option>
            ))}
          </select>
        </div>
      </div>
      <div>
        <label className="mb-1.5 block text-sm font-medium text-ink-soft">Contenido</label>
        <textarea
          name="contenido"
          rows={18}
          defaultValue={template?.contenido}
          className="w-full rounded-xl border border-line bg-surface px-3.5 py-2.5 font-mono text-sm text-ink transition-colors focus:border-brand-500 focus:bg-white focus:outline-none focus:ring-2 focus:ring-brand-200"
          required
        />
        <p className="mt-1.5 text-xs text-muted">
          Usa marcadores como [VENDEDOR], [COMPRADOR], [DIRECCIÓN], [PRECIO] para completar luego.
        </p>
      </div>
      <div className="flex items-center gap-3">
        <button className="inline-flex h-11 items-center gap-2 rounded-xl bg-brand-700 px-6 font-semibold text-white shadow-[0_10px_26px_-10px_rgba(4,125,91,0.8)] transition-all duration-300 ease-[cubic-bezier(0.16,1,0.3,1)] hover:bg-brand-800 active:scale-[0.98]">
          <Save className="h-4 w-4" /> Guardar
        </button>
        <Link href="/admin/plantillas" className="text-sm font-medium text-muted hover:text-ink">
          Cancelar
        </Link>
      </div>
    </form>
  );
}
