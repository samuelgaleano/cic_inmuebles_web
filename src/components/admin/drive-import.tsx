"use client";

import { useActionState } from "react";
import Link from "next/link";
import {
  AlertTriangle,
  CheckCircle2,
  FolderInput,
  ImageIcon,
  Loader2,
  Pencil,
} from "lucide-react";
import { importPropertiesFromDriveAction } from "@/lib/actions/admin-drive";
import type { DriveImportState } from "@/lib/services/drive-import";

const initial: DriveImportState = {};

export function DriveImport({ configured }: { configured: boolean }) {
  const [state, action, pending] = useActionState(importPropertiesFromDriveAction, initial);

  return (
    <div className="space-y-6">
      <section className="rounded-2xl border border-line bg-white p-6">
        <div className="flex items-start gap-4">
          <span className="flex h-12 w-12 shrink-0 items-center justify-center rounded-2xl bg-brand-600 text-white shadow-[0_10px_24px_-12px_rgba(7,162,118,0.7)]">
            <FolderInput className="h-6 w-6" />
          </span>
          <div className="min-w-0">
            <h2 className="text-lg font-bold tracking-tight text-ink">Importar desde Google Drive</h2>
            <p className="mt-1 text-sm leading-relaxed text-muted">
              Cada <strong className="font-semibold text-ink-soft">subcarpeta</strong> de tu carpeta raíz de Drive
              se convierte en un inmueble. Tomamos las <strong className="font-semibold text-ink-soft">fotos</strong>{" "}
              y, si existe, la ficha <code className="rounded bg-surface px-1 font-mono text-xs">especificaciones.md</code>.
              Se importan como <strong className="font-semibold text-ink-soft">borradores</strong> para que los revises y publiques.
            </p>
          </div>
        </div>

        {!configured ? (
          <p className="mt-5 rounded-xl border border-dashed border-line bg-surface px-4 py-3 text-sm text-muted">
            Google Drive aún no está conectado. Agrega las variables{" "}
            <code className="font-mono text-xs">GOOGLE_SERVICE_ACCOUNT_EMAIL</code>,{" "}
            <code className="font-mono text-xs">GOOGLE_PRIVATE_KEY</code> y{" "}
            <code className="font-mono text-xs">GOOGLE_DRIVE_ROOT_FOLDER_ID</code> en Vercel, y comparte la carpeta
            raíz con la cuenta de servicio.
          </p>
        ) : (
          <form action={action} className="mt-5">
            <button
              type="submit"
              disabled={pending}
              className="inline-flex h-11 items-center justify-center gap-2 rounded-xl bg-brand-700 px-5 font-semibold text-white shadow-[0_10px_26px_-10px_rgba(4,125,91,0.8)] transition-all duration-300 ease-[cubic-bezier(0.16,1,0.3,1)] hover:bg-brand-800 active:scale-[0.98] disabled:opacity-60"
            >
              {pending ? <Loader2 className="h-4 w-4 animate-spin" /> : <FolderInput className="h-4 w-4" />}
              {pending ? "Escaneando Drive…" : "Escanear e importar"}
            </button>
          </form>
        )}
      </section>

      {/* Resultado */}
      {state.ran && (
        <section className="rounded-2xl border border-line bg-white p-6">
          <div
            className={`flex items-center gap-2 text-sm font-semibold ${
              state.ok === false ? "text-rose-600" : "text-brand-700"
            }`}
          >
            {state.ok === false ? <AlertTriangle className="h-5 w-5" /> : <CheckCircle2 className="h-5 w-5" />}
            {state.message}
          </div>

          {state.created && state.created.length > 0 && (
            <ul className="mt-4 divide-y divide-line">
              {state.created.map((c) => (
                <li key={c.id} className="flex items-center justify-between gap-3 py-2.5">
                  <div className="min-w-0">
                    <p className="truncate font-medium text-ink">{c.titulo}</p>
                    <p className="flex items-center gap-1 text-xs text-muted">
                      <ImageIcon className="h-3.5 w-3.5" /> {c.fotos} foto{c.fotos === 1 ? "" : "s"} · borrador
                    </p>
                  </div>
                  <Link
                    href={`/admin/inmuebles/${c.id}`}
                    className="inline-flex h-9 shrink-0 items-center gap-1.5 rounded-xl border border-line px-3 text-sm font-medium text-ink-soft transition-colors hover:border-brand-300 hover:bg-brand-50 hover:text-brand-700"
                  >
                    <Pencil className="h-4 w-4" /> Revisar
                  </Link>
                </li>
              ))}
            </ul>
          )}

          {state.errors && state.errors.length > 0 && (
            <ul className="mt-4 space-y-1 text-sm text-rose-600">
              {state.errors.map((e, i) => (
                <li key={i} className="flex items-center gap-1.5">
                  <AlertTriangle className="h-4 w-4 shrink-0" /> {e}
                </li>
              ))}
            </ul>
          )}
        </section>
      )}
    </div>
  );
}
