import { processTransaction, type ProcessDeps } from "./process";
import type { EventoPagoRow } from "./store";

const DIAS = 7;
const MINUTOS_SIN_EVENTO = 60;
const FINALES = new Set(["APPROVED", "DECLINED", "VOIDED", "ERROR"]);

export interface ReconcileResult {
  revisadas: string[];
  resultados: Record<string, string>;
  /** Referencias emitidas sin transacción en Wompi (checkout abandonado); se reportan una vez. */
  referenciasAbandonadas: string[];
  /** Referencias cuya búsqueda en Wompi no respondió; se reintentan mañana. */
  referenciasSinRespuesta: string[];
  rawPurgados: number;
}

/** Último evento por transacción (los eventos vienen del más reciente al más antiguo). */
function ultimoPorTx(eventos: EventoPagoRow[]): Map<string, EventoPagoRow> {
  const m = new Map<string, EventoPagoRow>();
  for (const e of eventos) if (!m.has(e.txId)) m.set(e.txId, e);
  return m;
}

function describe(err: unknown): string {
  return err instanceof Error ? err.message : String(err);
}

/**
 * Reconciliación diaria:
 *  1. Vuelve a preguntar a Wompi por lo que quedó a medias (PENDING,
 *     sin_verificar, o aprobado sin aviso enviado).
 *  2. Busca en Wompi por referencia los checkouts que nunca recibieron
 *     confirmación por ningún camino y procesa las transacciones que aparezcan.
 *  3. Purga el payload crudo viejo y avisa a Pixies de lo que quedó sin resolver.
 * Un fallo en una transacción no detiene a las demás.
 */
export async function reconcile(deps: ProcessDeps): Promise<ReconcileResult> {
  const { store } = deps;
  const resultados: Record<string, string> = {};
  const registrar = (txId: string, r: Awaited<ReturnType<typeof processTransaction>>) => {
    resultados[txId] = `${r.outcome}${r.status ? ":" + r.status : ""}${r.notified ? " notificado" : ""}`;
  };

  const eventos = await store.recentEvents(DIAS);
  const notificadas = new Set(eventos.filter((e) => e.notifiedAt).map((e) => e.txId));

  const aRevisar = new Set<string>();
  for (const [txId, e] of ultimoPorTx(eventos)) {
    if (e.estado === "sin_verificar" || !FINALES.has(e.status)) aRevisar.add(txId);
    else if (e.status === "APPROVED" && e.estado !== "sin_destino" && !notificadas.has(txId)) aRevisar.add(txId);
  }

  for (const txId of aRevisar) {
    try {
      registrar(txId, await processTransaction(txId, { source: "cron" }, deps));
    } catch (err) {
      resultados[txId] = `error:${describe(err)}`;
    }
  }

  const referenciasAbandonadas: string[] = [];
  const referenciasSinRespuesta: string[] = [];
  for (const ref of await store.referencesWithoutEvents(MINUTOS_SIN_EVENTO, DIAS)) {
    const txs = await deps.fetchTransactionsByReference(ref.reference);
    if (txs === null) {
      referenciasSinRespuesta.push(ref.reference);
      continue;
    }
    if (txs.length === 0) {
      referenciasAbandonadas.push(ref.reference);
      await store.markReferenceChecked(ref.reference);
      continue;
    }
    for (const tx of txs) {
      try {
        registrar(tx.id, await processTransaction(tx.id, { source: "cron", tx }, deps));
      } catch (err) {
        resultados[tx.id] = `error:${describe(err)}`;
      }
    }
  }

  let rawPurgados = 0;
  try {
    rawPurgados = await store.purgeRaw();
  } catch (err) {
    console.error("[pago] purga de payloads falló:", describe(err));
  }

  const sinResolver = Object.entries(resultados).filter(
    ([, v]) => v.startsWith("sin_verificar") || v.startsWith("store_error") || v.startsWith("error:") || (v.includes(":APPROVED") && !v.endsWith("notificado") && !v.startsWith("sin_destino") && !v.startsWith("dedup")),
  );
  const aprobadasSinAviso = eventos
    .filter((e) => e.status === "APPROVED" && e.estado !== "sin_destino" && !notificadas.has(e.txId))
    .map((e) => e.txId)
    .filter((id, i, a) => a.indexOf(id) === i && !resultados[id]?.endsWith("notificado"));

  if (referenciasAbandonadas.length > 0 || referenciasSinRespuesta.length > 0 || sinResolver.length > 0 || aprobadasSinAviso.length > 0) {
    await deps.sendPagosAlert(
      `Reconciliación: ${aprobadasSinAviso.length} aprobadas sin aviso, ${sinResolver.length} sin resolver, ${referenciasAbandonadas.length} checkouts abandonados`,
      [
        aprobadasSinAviso.length ? "Aprobadas sin aviso enviado (revisar Resend / panel de Wompi):" : null,
        ...aprobadasSinAviso.map((id) => `- ${id}: ${resultados[id] ?? "sin resultado"}`),
        sinResolver.length ? "Transacciones sin resolver:" : null,
        ...sinResolver.map(([id, v]) => `- ${id}: ${v}`),
        referenciasAbandonadas.length ? "Checkouts abandonados (referencia emitida, ninguna transacción en Wompi; se reportan una sola vez):" : null,
        ...referenciasAbandonadas.map((r) => `- ${r}`),
        referenciasSinRespuesta.length ? "Referencias que Wompi no respondió (se reintentan mañana):" : null,
        ...referenciasSinRespuesta.map((r) => `- ${r}`),
      ]
        .filter((l): l is string => l !== null)
        .join("\n"),
    );
  }

  return { revisadas: [...aRevisar], resultados, referenciasAbandonadas, referenciasSinRespuesta, rawPurgados };
}
