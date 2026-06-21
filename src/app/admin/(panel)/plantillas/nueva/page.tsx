import Link from "next/link";
import { ArrowLeft } from "lucide-react";
import { TemplateForm } from "@/components/admin/template-form";
import { createTemplateAction } from "@/lib/actions/admin-templates";

export default function NuevaPlantillaPage() {
  return (
    <div className="mx-auto max-w-3xl space-y-6">
      <div>
        <Link href="/admin/plantillas" className="inline-flex items-center gap-1 text-sm text-slate-500 hover:text-slate-700">
          <ArrowLeft className="h-4 w-4" /> Plantillas
        </Link>
        <h1 className="mt-2 text-2xl font-bold text-slate-900">Nueva plantilla</h1>
      </div>
      <TemplateForm action={createTemplateAction} />
    </div>
  );
}
