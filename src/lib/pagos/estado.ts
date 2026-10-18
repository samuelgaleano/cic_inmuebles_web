import { fetchTransactionsByReference as fetchPorReferenciaApi, type WompiTransaction } from "@/lib/integrations/wompi";
import { CIC_REFERENCE, defaultDeps, processTransaction, type ProcessDeps } from "./process";

/**
 * Confirmación por referencia, sin depender de que quien paga pulse «Volver al comercio».
 *
 * Wompi solo avisa al sitio por el webhook (cuya URL hoy es de otro comercio) o cuando la persona regresa
 * con su botón. La página que abrió el pago consulta este camino mientras dura el pago: se le pregunta
 * a Wompi (la API es la fuente de verdad) y, si ya hay transacción, se procesa igual que en el retorno
 * (idempotente: no duplica eventos, avisos ni servicios). No devuelve datos de la transacción, solo su estado.
 */

export type EstadoConsulta =
  | { estado: "desconocida" } // referencia que este sitio no emitió
  | { estado: "espera" } // consultada hace muy poco
  | { estado: "sin_respuesta" } // Wompi no contestó
  | { estado: "sin_transaccion" } // la persona aún no pagó
  | { estado: "error" } // no se pudo registrar: se reintenta
  | { estado: string; final: boolean };

const FINALES = new Set(["APPROVED", "DECLINED", "VOIDED", "ERROR"]);
/** Separación mínima entre dos consultas de la misma referencia (por instancia del servidor). */
export const INTERVALO_MINIMO_MS = 3_000;
const ultimaConsulta = new Map<string, number>();

function recordar(reference: string, ahora: number) {
  ultimaConsulta.set(reference, ahora);
  if (ultimaConsulta.size > 500) {
    // Memoria acotada: se olvidan las consultas antiguas.
    for (const [k, t] of ultimaConsulta) if (ahora - t > 60_000) ultimaConsulta.delete(k);
  }
}

export function reiniciarLimite() {
  ultimaConsulta.clear();
}

/** Entre varias transacciones de una referencia, la aprobada manda; si no, la más reciente que traiga la API. */
function elegir(txs: WompiTransaction[]): WompiTransaction {
  return txs.find((t) => t.status === "APPROVED") ?? txs[0];
}

export async function confirmarPorReferencia(
  reference: string,
  opts: {
    deps?: ProcessDeps;
    fetchPorReferencia?: (ref: string) => Promise<WompiTransaction[] | null>;
    ahora?: () => number;
  } = {},
): Promise<EstadoConsulta> {
  const ahora = (opts.ahora ?? Date.now)();
  if (!CIC_REFERENCE.test(reference)) return { estado: "desconocida" };

  const previa = ultimaConsulta.get(reference);
  if (previa !== undefined && ahora - previa < INTERVALO_MINIMO_MS) return { estado: "espera" };
  recordar(reference, ahora);

  const deps = opts.deps ?? defaultDeps();
  try {
    // Solo se le pregunta a Wompi (con la llave privada) por referencias que este sitio emitió.
    if (!(await deps.store.getReference(reference))) return { estado: "desconocida" };
    const txs = await (opts.fetchPorReferencia ?? fetchPorReferenciaApi)(reference);
    if (txs === null) return { estado: "sin_respuesta" };
    if (txs.length === 0) return { estado: "sin_transaccion" };

    const tx = elegir(txs);
    const r = await processTransaction(tx.id, { source: "redirect", tx }, deps);
    if (r.outcome === "store_error") return { estado: "error" };
    return { estado: tx.status, final: FINALES.has(tx.status) };
  } catch (err) {
    console.error("[pago] la confirmación por referencia falló:", err instanceof Error ? err.message : err);
    return { estado: "error" };
  }
}
