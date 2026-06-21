import Link from "next/link";
import { notFound } from "next/navigation";
import { ArrowLeft } from "lucide-react";
import { TemplateForm } from "@/components/admin/template-form";
import { updateTemplateAction } from "@/lib/actions/admin-templates";
import { getRepository } from "@/lib/data";

export const dynamic = "force-dynamic";

export default async function EditarPlantillaPage({
  params,
}: {
  params: Promise<{ id: string }>;
}) {
  const { id } = await params;
  const template = await getRepository().templates.getById(id);
  if (!template) notFound();

  const action = updateTemplateAction.bind(null, id);

  return (
    <div className="mx-auto max-w-3xl space-y-6">
      <div>
        <Link href="/admin/plantillas" className="inline-flex items-center gap-1 text-sm text-slate-500 hover:text-slate-700">
          <ArrowLeft className="h-4 w-4" /> Plantillas
        </Link>
        <h1 className="mt-2 text-2xl font-bold text-slate-900">{template.nombre}</h1>
      </div>
      <TemplateForm action={action} template={template} />
    </div>
  );
}
