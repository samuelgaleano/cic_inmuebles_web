"use client";

import { useEffect, useState } from "react";
import { useRouter } from "next/navigation";
import { proximaEsperaPendiente } from "./checkout-utils";

/**
 * Un pago PSE o Nequi puede quedar pendiente unos minutos. Mientras tanto se consulta el estado con el endpoint
 * liviano /api/pagos/wompi/estado (30 s al inicio y 60 s después, hasta 10 veces; sin consultar si la pestaña está
 * oculta) y SOLO cuando el pago llega a un estado final se vuelve a pintar la página, una vez. Antes cada vuelta
 * hacía `router.refresh()`: renderizar de nuevo toda la página en el servidor.
 */
export function AutoActualizar({ referencia, maximo = 10 }: { referencia?: string; maximo?: number }) {
  const router = useRouter();
  const [vueltas, setVueltas] = useState(0);
  useEffect(() => {
    if (vueltas >= maximo) return;
    const t = window.setTimeout(async () => {
      if (document.visibilityState === "hidden") return setVueltas((n) => n + 1);
      try {
        // Sin referencia (retorno sin ?ref) no hay a quién preguntar: se repinta la página como antes.
        if (!referencia) return router.refresh();
        const res = await fetch(`/api/pagos/wompi/estado?ref=${encodeURIComponent(referencia)}`, { cache: "no-store" });
        const d = (await res.json().catch(() => null)) as { final?: boolean; estado?: string } | null;
        if (d?.final) return router.refresh();
        if (d?.estado === "desconocida" || res.status === 503) return setVueltas(maximo);
      } catch {
        // sin red por un momento: se reintenta en la siguiente vuelta
      }
      setVueltas((n) => n + 1);
    }, proximaEsperaPendiente(vueltas));
    return () => window.clearTimeout(t);
  }, [vueltas, maximo, referencia, router]);
  return (
    <p className="mt-4 text-[13px] text-muted" aria-live="polite">
      {vueltas < maximo ? "Revisamos el estado automáticamente." : "Ya no revisamos solos: usa «Actualizar estado»."}
    </p>
  );
}
