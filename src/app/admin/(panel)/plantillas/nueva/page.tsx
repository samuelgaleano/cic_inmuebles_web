import Link from "next/link";
import { ArrowLeft } from "lucide-react";
import { TemplateForm } from "@/components/admin/template-form";
import { createTemplateAction } from "@/lib/actions/admin-templates";

export default function NuevaPlantillaPage() {
  return (
    <div className="mx-auto max-w-3xl space-y-6">
      <div>
        <Link href="/admin/plantillas" className="inline-flex items-center gap-1.5 text-sm font-medium text-muted transition-colors hover:gap-2 hover:text-brand-700">
          <ArrowLeft className="h-4 w-4" /> Plantillas
        </Link>
        <h1 className="mt-2 text-2xl font-bold tracking-tight text-ink">Nueva plantilla</h1>
      </div>
      <TemplateForm action={createTemplateAction} />
    </div>
  );
}
