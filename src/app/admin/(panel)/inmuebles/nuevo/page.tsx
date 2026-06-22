import Link from "next/link";
import { ArrowLeft } from "lucide-react";
import { PropertyForm } from "@/components/admin/property-form";
import { createPropertyAction } from "@/lib/actions/admin-properties";

export default function NuevoInmueblePage() {
  return (
    <div className="mx-auto max-w-4xl space-y-6">
      <div>
        <Link href="/admin/inmuebles" className="inline-flex items-center gap-1.5 text-sm font-medium text-muted transition-colors hover:gap-2 hover:text-brand-700">
          <ArrowLeft className="h-4 w-4" /> Inmuebles
        </Link>
        <h1 className="mt-2 text-2xl font-bold tracking-tight text-ink">Nuevo inmueble</h1>
      </div>
      <PropertyForm action={createPropertyAction} />
    </div>
  );
}
