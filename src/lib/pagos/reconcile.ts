import { getPlan } from "@/lib/config/plans";
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
  /** Pagos aprobados sin servicio registrado que se volvieron a procesar, con su resultado. */
  serviciosRetomados: Record<string, string>;
  /** De esos, los que siguen sin vigencia registrada después del intento. */
  sinServicio: string[];
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
 *  3. Retoma los pagos aprobados (estado ok) sin servicio ni renovación registrada.
 *  4. Purga el payload crudo viejo y avisa a Pixies de lo que quedó sin resolver.
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

  // 3) Pagos aprobados por el monto correcto cuyo servicio no quedó registrado (la base falló justo en ese
  //    momento, o la renovación chocó con otro cambio). Se procesan como lo hace el retorno: el aviso al
  //    negocio ya salió y su reclamo atómico impide reenviarlo; solo se registra el servicio o la renovación.
  const { retomados: serviciosRetomados, sinServicio } = await retomarServicios(eventos, resultados, deps);

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

  if (referenciasAbandonadas.length > 0 || referenciasSinRespuesta.length > 0 || sinResolver.length > 0 || aprobadasSinAviso.length > 0 || sinServicio.length > 0) {
    await deps.sendPagosAlert(
      `Reconciliación: ${aprobadasSinAviso.length} aprobadas sin aviso, ${sinResolver.length} sin resolver, ${referenciasAbandonadas.length} checkouts abandonados${sinServicio.length ? `, ${sinServicio.length} sin vigencia` : ""}`,
      [
        sinServicio.length ? "Pagos aprobados sin vigencia registrada (se reintentan cada día; si persisten, regístralos a mano en /admin/vigencias):" : null,
        ...sinServicio.map((id) => `- ${id}: ${serviciosRetomados[id] ?? "sin resultado"}`),
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

  return { revisadas: [...aRevisar], resultados, referenciasAbandonadas, referenciasSinRespuesta, serviciosRetomados, sinServicio, rawPurgados };
}

/** Solo los planes de pago con vigencia abren un servicio; los demás nunca aparecerían como registrados. */
function abreServicio(planId: string | null): boolean {
  const plan = planId ? getPlan(planId) : undefined;
  return Boolean(plan && plan.mode === "pago" && plan.dias);
}

/**
 * Busca los pagos APPROVED con estado ok de la ventana cuyo tx_id no está ni en los servicios ni en las
 * renovaciones, y los vuelve a procesar con fuente cron. Lo que ya se procesó en esta corrida no se repite.
 * Nunca lanza: si no se puede saber qué tiene servicio, se deja para mañana.
 */
async function retomarServicios(
  eventos: EventoPagoRow[],
  yaProcesadas: Record<string, string>,
  deps: ProcessDeps,
): Promise<{ retomados: Record<string, string>; sinServicio: string[] }> {
  const retomados: Record<string, string> = {};
  if (!deps.registrarServicio || !deps.txIdsConServicio) return { retomados, sinServicio: [] };

  const candidatos = [
    ...new Set(eventos.filter((e) => e.status === "APPROVED" && e.estado === "ok" && abreServicio(e.planId)).map((e) => e.txId)),
  ].filter((id) => !(id in yaProcesadas));
  if (candidatos.length === 0) return { retomados, sinServicio: [] };

  let faltan: string[];
  try {
    const registrados = await deps.txIdsConServicio(candidatos);
    faltan = candidatos.filter((id) => !registrados.has(id));
  } catch (err) {
    console.error("[pago] no se pudo revisar qué pagos tienen vigencia registrada:", describe(err));
    return { retomados, sinServicio: [] };
  }

  for (const txId of faltan) {
    try {
      const r = await processTransaction(txId, { source: "cron" }, deps);
      retomados[txId] = `${r.outcome}${r.status ? ":" + r.status : ""}`;
    } catch (err) {
      retomados[txId] = `error:${describe(err)}`;
    }
  }
  if (faltan.length === 0) return { retomados, sinServicio: [] };

  // Lo que sigue sin servicio después del intento se reporta (sin datos personales: solo el id de Wompi).
  try {
    const ahora = await deps.txIdsConServicio(faltan);
    return { retomados, sinServicio: faltan.filter((id) => !ahora.has(id)) };
  } catch (err) {
    console.error("[pago] no se pudo comprobar la vigencia de los pagos retomados:", describe(err));
    return { retomados, sinServicio: [] };
  }
}
