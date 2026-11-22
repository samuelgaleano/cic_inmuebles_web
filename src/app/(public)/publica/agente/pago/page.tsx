import type { Metadata } from "next";
import Link from "next/link";
import { ArrowLeft } from "lucide-react";
import { PagoResultado, type PagoEstadoVisible } from "@/components/public/pago-resultado";
import { getPlan } from "@/lib/config/plans";
import { isWompiConfigured, planIdFromReference } from "@/lib/integrations/wompi";
import { confirmFromRedirect } from "@/lib/pagos/process";
import { getPagosStore, isPagosStoreConfigured } from "@/lib/pagos/store";

// La pantalla de retorno es personal y efímera: título propio y fuera del índice.
export const metadata: Metadata = {
  title: "Estado de tu pago",
  robots: { index: false, follow: false },
  alternates: { canonical: "/publica/agente" },
};

const ESTADOS_VISIBLES = new Set<string>(["APPROVED", "PENDING", "DECLINED", "VOIDED", "ERROR"]);
const esEstadoVisible = (s: string): s is PagoEstadoVisible => ESTADOS_VISIBLES.has(s);

/**
 * Retorno del widget de Wompi: agrega ?id=<transacción>. Se confirma con la API (fuente de verdad) y se
 * muestra el estado real; la notificación al negocio es idempotente, así que recargar esta página no duplica avisos.
 */
export default async function PagoProcesadoPage({ searchParams }: { searchParams: Promise<{ ref?: string; id?: string }> }) {
  const sp = await searchParams;
  const wompiOn = isWompiConfigured();

  const retorno =
    sp.id && sp.ref && wompiOn && isPagosStoreConfigured() ? await confirmFromRedirect(sp.id, sp.ref) : null;
  // Un status nuevo de Wompi que no conozcamos se trata como "en proceso": nunca como aprobado.
  const estado: PagoEstadoVisible = !retorno?.found ? "DESCONOCIDO" : esEstadoVisible(retorno.status) ? retorno.status : "PENDING";
  const reference = retorno?.found ? retorno.reference : sp.ref;
  const planId = reference ? planIdFromReference(reference) : undefined;
  const plan = planId ? getPlan(planId) : undefined;
  const actualUrl = `/publica/agente/pago?${[sp.ref && `ref=${encodeURIComponent(sp.ref)}`, sp.id && `id=${encodeURIComponent(sp.id)}`].filter(Boolean).join("&")}`;
  // Una renovación pagada desde el correo no vuelve a pedir fotos ni datos: su vigencia solo se extiende.
  let esRenovacion = false;
  if (retorno?.found && isPagosStoreConfigured()) {
    try {
      esRenovacion = Boolean((await getPagosStore().getReference(retorno.reference))?.renuevaServicioId);
    } catch {
      esRenovacion = false;
    }
  }

  return (
    <>
      <div className="wrap pt-8">
        <Link href="/publica/agente" className="link-arrow py-2 text-[15px]">
          <ArrowLeft className="h-4 w-4" aria-hidden="true" /> Volver a los planes
        </Link>
      </div>
      <div className="wrap pb-28 pt-8">
        <PagoResultado
          estado={estado}
          plan={plan}
          amountInCents={retorno?.found ? retorno.amountInCents : undefined}
          reference={reference}
          actualUrl={actualUrl}
          esRenovacion={esRenovacion}
        />
      </div>
    </>
  );
}
