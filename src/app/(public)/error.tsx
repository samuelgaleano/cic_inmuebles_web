"use client";

import { useEffect } from "react";
import { RotateCw } from "lucide-react";
import { buttonVariants } from "@/components/ui/button";

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
    <div className="wrap py-28">
      <p className="text-[15px] text-muted">Algo no salió como esperábamos</p>
      <h1 className="t-display mt-2 max-w-3xl">Ocurrió un error.</h1>
      <p className="t-lead mt-5 max-w-xl">Puedes intentarlo de nuevo; si sigue pasando, escríbenos por WhatsApp.</p>
      <button onClick={reset} className={buttonVariants({ variant: "primary", size: "lg", className: "mt-10" })}>
        <RotateCw className="h-4 w-4" aria-hidden /> Reintentar
      </button>
    </div>
  );
}
