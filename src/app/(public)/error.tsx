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
      <h1 className="text-2xl font-bold text-slate-900">Algo salió mal</h1>
      <p className="mt-2 text-slate-500">
        Ocurrió un error inesperado. Puedes intentarlo de nuevo.
      </p>
      <button
        onClick={reset}
        className="mt-6 inline-flex h-11 items-center gap-2 rounded-lg bg-brand-700 px-5 text-sm font-semibold text-white hover:bg-brand-800"
      >
        <RotateCw className="h-4 w-4" /> Reintentar
      </button>
    </div>
  );
}
