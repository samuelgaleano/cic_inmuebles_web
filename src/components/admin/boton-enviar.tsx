"use client";

import { useFormStatus } from "react-dom";

/**
 * Botón de envío que se desactiva mientras la acción corre: un doble clic no
 * suma dos periodos ni manda dos correos (el servidor además lo condiciona).
 */
export function BotonEnviar({ children, className, name, value }: { children: React.ReactNode; className?: string; name?: string; value?: string }) {
  const { pending } = useFormStatus();
  return (
    <button type="submit" name={name} value={value} disabled={pending} aria-busy={pending} className={`${className ?? ""} disabled:cursor-wait disabled:opacity-60`}>
      {pending ? "Procesando…" : children}
    </button>
  );
}
