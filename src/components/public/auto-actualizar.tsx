"use client";

import { useEffect, useState } from "react";
import { useRouter } from "next/navigation";

/**
 * Un pago PSE o Nequi puede quedar pendiente unos minutos. Mientras tanto la
 * página vuelve a consultar el estado sola (cada 30 s, hasta 10 veces), así la
 * persona ve el resultado sin tener que recargar.
 */
export function AutoActualizar({ cadaSegundos = 30, maximo = 10 }: { cadaSegundos?: number; maximo?: number }) {
  const router = useRouter();
  const [vueltas, setVueltas] = useState(0);
  useEffect(() => {
    if (vueltas >= maximo) return;
    const t = window.setTimeout(() => {
      router.refresh();
      setVueltas((n) => n + 1);
    }, cadaSegundos * 1000);
    return () => window.clearTimeout(t);
  }, [vueltas, maximo, cadaSegundos, router]);
  return (
    <p className="mt-4 text-[13px] text-muted" aria-live="polite">
      {vueltas < maximo ? "Revisamos el estado automáticamente cada 30 segundos." : "Ya no revisamos solos: usa «Actualizar estado»."}
    </p>
  );
}
