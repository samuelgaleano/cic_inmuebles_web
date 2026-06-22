"use client";

import { useEffect } from "react";
import { RotateCw } from "lucide-react";

export default function PublicError({
  error,
  reset,
}: {
  error: Error & { digest?: string };
  reset: () => void;
}) {
  useEffect(() => {
    console.error(error);
  }, [error]);

  return (
    <div className="mx-auto flex max-w-lg flex-col items-center px-4 py-24 text-center">
      <h1 className="text-2xl font-bold tracking-tight text-ink">Algo salió mal</h1>
      <p className="mt-2 text-muted">
        Ocurrió un error inesperado. Puedes intentarlo de nuevo.
      </p>
      <button
        onClick={reset}
        className="mt-6 inline-flex h-11 items-center gap-2 rounded-xl bg-brand-700 px-5 text-sm font-semibold text-white shadow-[0_10px_26px_-10px_rgba(4,125,91,0.8)] transition-all duration-300 ease-[cubic-bezier(0.16,1,0.3,1)] hover:bg-brand-800 active:scale-[0.98]"
      >
        <RotateCw className="h-4 w-4" /> Reintentar
      </button>
    </div>
  );
}
