import {
  ExternalLink,
  File as FileIcon,
  FileText,
  FolderOpen,
  HardDriveUpload,
  Image as ImageIcon,
} from "lucide-react";
import { createPropertyArchiveAction } from "@/lib/actions/admin-properties";
import { driveFolderLink, type DriveFile } from "@/lib/integrations/drive";

function fileIcon(mimeType: string) {
  if (mimeType.startsWith("image/")) return ImageIcon;
  if (mimeType === "application/pdf" || mimeType.startsWith("text/")) return FileText;
  return FileIcon;
}

function formatDate(iso?: string): string {
  if (!iso) return "";
  return new Date(iso).toLocaleDateString("es-CO", { day: "2-digit", month: "short", year: "numeric" });
}

/**
 * Panel de archivo del inmueble en Google Drive: permite a los agentes
 * verificar y abrir los documentos/fotos centralizados desde la web.
 */
export function DriveArchivePanel({
  configured,
  folderId,
  files,
  propertyId,
}: {
  configured: boolean;
  folderId?: string;
  files: DriveFile[];
  propertyId: string;
}) {
  return (
    <section className="rounded-2xl border border-line bg-white p-6">
      <div className="flex flex-wrap items-center justify-between gap-3">
        <h2 className="flex items-center gap-2 text-lg font-bold tracking-tight text-ink">
          <FolderOpen className="h-5 w-5 text-brand-600" /> Archivo en Google Drive
        </h2>
        {configured && folderId && (
          <a
            href={driveFolderLink(folderId)}
            target="_blank"
            rel="noopener noreferrer"
            className="inline-flex h-9 items-center gap-1.5 rounded-xl border border-line px-3 text-sm font-medium text-ink-soft transition-colors hover:border-brand-300 hover:bg-brand-50 hover:text-brand-700"
          >
            <ExternalLink className="h-4 w-4" /> Abrir carpeta
          </a>
        )}
      </div>

      {/* Sin configurar */}
      {!configured && (
        <p className="mt-4 rounded-xl border border-dashed border-line bg-surface px-4 py-3 text-sm text-muted">
          Conecta Google Drive (variables <code className="font-mono text-xs">GOOGLE_SERVICE_ACCOUNT_EMAIL</code>,{" "}
          <code className="font-mono text-xs">GOOGLE_PRIVATE_KEY</code> y{" "}
          <code className="font-mono text-xs">GOOGLE_DRIVE_ROOT_FOLDER_ID</code>) para centralizar y verificar
          los documentos de cada inmueble desde aquí.
        </p>
      )}

      {/* Configurado, pero sin carpeta aún */}
      {configured && !folderId && (
        <div className="mt-4 flex flex-wrap items-center justify-between gap-3 rounded-xl border border-dashed border-line bg-surface px-4 py-3">
          <p className="text-sm text-muted">Este inmueble todavía no tiene carpeta de archivo en Drive.</p>
          <form action={createPropertyArchiveAction}>
            <input type="hidden" name="id" value={propertyId} />
            <button className="inline-flex h-9 items-center gap-1.5 rounded-xl bg-brand-700 px-3.5 text-sm font-semibold text-white transition-colors hover:bg-brand-800">
              <HardDriveUpload className="h-4 w-4" /> Crear carpeta
            </button>
          </form>
        </div>
      )}

      {/* Carpeta con archivos */}
      {configured && folderId && (
        files.length === 0 ? (
          <p className="mt-4 rounded-xl border border-dashed border-line bg-surface px-4 py-3 text-sm text-muted">
            La carpeta está vacía. Sube fotos o documentos a Drive y aparecerán aquí para verificarlos.
          </p>
        ) : (
          <ul className="mt-4 grid gap-2 sm:grid-cols-2">
            {files.map((f) => {
              const Icon = fileIcon(f.mimeType);
              return (
                <li key={f.id}>
                  <a
                    href={f.webViewLink ?? driveFolderLink(folderId)}
                    target="_blank"
                    rel="noopener noreferrer"
                    className="group flex items-center gap-3 rounded-xl border border-line bg-surface px-3 py-2.5 transition-colors hover:border-brand-300 hover:bg-brand-50"
                  >
                    <span className="flex h-9 w-9 shrink-0 items-center justify-center rounded-lg bg-white text-brand-600 ring-1 ring-line">
                      <Icon className="h-[18px] w-[18px]" />
                    </span>
                    <span className="min-w-0 flex-1">
                      <span className="block truncate text-sm font-medium text-ink group-hover:text-brand-700">{f.name}</span>
                      {f.modifiedTime && <span className="block text-xs text-muted">{formatDate(f.modifiedTime)}</span>}
                    </span>
                    <ExternalLink className="h-4 w-4 shrink-0 text-muted transition-colors group-hover:text-brand-600" />
                  </a>
                </li>
              );
            })}
          </ul>
        )
      )}
    </section>
  );
}
