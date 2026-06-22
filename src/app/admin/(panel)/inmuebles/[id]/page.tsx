import Link from "next/link";
import { notFound } from "next/navigation";
import { ArrowLeft, ExternalLink } from "lucide-react";
import { PropertyForm } from "@/components/admin/property-form";
import { updatePropertyAction } from "@/lib/actions/admin-properties";
import { getRepository } from "@/lib/data";

export const dynamic = "force-dynamic";

export default async function EditarInmueblePage({
  params,
}: {
  params: Promise<{ id: string }>;
}) {
  const { id } = await params;
  const property = await getRepository().properties.getById(id);
  if (!property) notFound();

  const action = updatePropertyAction.bind(null, id);

  return (
    <div className="mx-auto max-w-4xl space-y-6">
      <div className="flex items-center justify-between">
        <div>
          <Link href="/admin/inmuebles" className="inline-flex items-center gap-1.5 text-sm font-medium text-muted transition-colors hover:gap-2 hover:text-brand-700">
            <ArrowLeft className="h-4 w-4" /> Inmuebles
          </Link>
          <h1 className="mt-2 text-2xl font-bold tracking-tight text-ink">{property.titulo}</h1>
          <p className="font-mono text-xs text-muted">{property.codigo}</p>
        </div>
        <Link
          href={`/inmuebles/${property.slug}`}
          target="_blank"
          className="inline-flex h-9 shrink-0 items-center gap-1.5 rounded-xl border border-line px-3 text-sm font-medium text-ink-soft transition-colors hover:border-brand-300 hover:bg-brand-50 hover:text-brand-700"
        >
          <ExternalLink className="h-4 w-4" /> Ver
        </Link>
      </div>
      <PropertyForm action={action} property={property} />
    </div>
  );
}
