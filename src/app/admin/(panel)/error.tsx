"use client"; // Los límites de error son componentes de cliente.

import Link from "next/link";
import { useEffect } from "react";
import { Link2, RotateCw } from "lucide-react";

/**
 * Falla una página del panel (casi siempre Supabase pausado, una migración sin aplicar o una conexión caída):
 * el menú del panel sigue en pie y se ofrece reintentar o revisar Conexiones. En producción el mensaje real no
 * llega al navegador; el código `digest` sirve para buscarlo en los registros del servidor.
 */
export default function PanelError({ error, retry }: { error: unknown; retry: () => void }) {
  useEffect(() => {
    console.error(error);
  }, [error]);
  const digest = error instanceof Error && "digest" in error ? String((error as Error & { digest?: string }).digest ?? "") : "";

  return (
    <div role="alert" className="mx-auto max-w-lg rounded-2xl border border-rose-200 bg-white p-6">
      <h1 className="text-lg font-bold text-ink">No se pudo cargar esta sección</h1>
      <p className="mt-2 text-sm text-ink-soft">
        Puede ser la conexión, la base de datos dormida (Supabase se pausa tras 7 días sin uso) o una migración pendiente. Reintenta; si sigue igual, revisa el estado de las cuentas en Conexiones.
      </p>
      {digest && <p className="mt-2 font-mono text-xs text-muted">Código: {digest}</p>}
      <div className="mt-5 flex flex-wrap gap-2">
        <button
          type="button"
          onClick={() => retry()}
          className="inline-flex min-h-11 items-center gap-2 rounded-xl bg-brand-700 px-4 text-sm font-semibold text-white transition-colors hover:bg-brand-800"
        >
          <RotateCw className="h-4 w-4" aria-hidden /> Reintentar
        </button>
        <Link
          href="/admin/conexiones"
          className="inline-flex min-h-11 items-center gap-2 rounded-xl border border-line px-4 text-sm font-semibold text-ink-soft transition-colors hover:border-ink hover:text-ink"
        >
          <Link2 className="h-4 w-4" aria-hidden /> Ver Conexiones
        </Link>
      </div>
    </div>
  );
}
