import Link from "next/link";
import { ArrowLeft } from "lucide-react";
import { DriveImport } from "@/components/admin/drive-import";
import { isDriveConfigured } from "@/lib/integrations/drive";

export const dynamic = "force-dynamic";

export default function ImportarDrivePage() {
  return (
    <div className="mx-auto max-w-3xl space-y-6">
      <div>
        <Link
          href="/admin/inmuebles"
          className="inline-flex items-center gap-1.5 text-sm font-medium text-muted transition-colors hover:gap-2 hover:text-brand-700"
        >
          <ArrowLeft className="h-4 w-4" /> Inmuebles
        </Link>
        <h1 className="mt-2 text-2xl font-bold tracking-tight text-ink">Importar desde Drive</h1>
        <p className="mt-0.5 text-sm text-muted">Trae inmuebles desde tus carpetas de Google Drive.</p>
      </div>
      <DriveImport configured={isDriveConfigured()} />
    </div>
  );
}
