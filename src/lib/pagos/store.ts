import { getSupabaseAdmin, isSupabaseConfigured } from "@/lib/data/supabase/client";

export type PagoSource = "webhook" | "redirect" | "cron";
export type PagoEstado = "ok" | "revisar" | "sin_destino" | "sin_verificar";

export interface EventoPagoInput {
  txId: string;
  status: string;
  /** Tiempo UNIX del evento de Wompi; 0 para retorno y cron. */
  eventTimestamp: number;
  source: PagoSource;
  reference: string | null;
  amountInCents: number | null;
  planId: string | null;
  amountOk: boolean | null;
  estado: PagoEstado;
  raw: unknown | null;
}

export interface EventoPagoRow extends EventoPagoInput {
  id: number;
  notifiedAt: string | null;
  receivedAt: string;
}

export interface ReferenciaRow {
  reference: string;
  planId: string;
  amountInCents: number;
  createdAt: string;
}

/** Minutos tras los cuales un reclamo de aviso sin `sent_at` se considera huérfano. */
export const AVISO_HUERFANO_MINUTOS = 10;

export class PagosStoreError extends Error {}

/**
 * Persistencia de pagos. La idempotencia y el anti-replay viven en la
 * restricción UNIQUE (tx_id, status, event_timestamp) de `pagos_eventos`; el
 * envío del aviso se reclama de forma atómica en `pagos_avisos`. Cualquier
 * fallo de infraestructura se lanza como PagosStoreError para que el webhook
 * responda 500 y Wompi reintente.
 */
export interface PagosStore {
  recordReference(ref: { reference: string; planId: string; amountInCents: number }): Promise<void>;
  /**
   * "inserted": fila nueva. "updated": ya existía como sin_verificar y se
   * completó con los datos verificados. "duplicate": ya existía tal cual.
   */
  recordEvent(e: EventoPagoInput): Promise<"inserted" | "updated" | "duplicate">;
  /** true si este llamador obtuvo el derecho exclusivo de enviar el aviso. */
  claimNotification(txId: string): Promise<boolean>;
  /** Libera un reclamo cuyo envío falló, para que otro intento lo retome. */
  releaseNotification(txId: string): Promise<void>;
  markNotified(txId: string): Promise<void>;
  /** Eventos de una transacción, del más reciente al más antiguo. */
  trace(txId: string): Promise<EventoPagoRow[]>;
  /** Eventos de los últimos `days` días, del más reciente al más antiguo. */
  recentEvents(days: number): Promise<EventoPagoRow[]>;
  /** Referencias emitidas entre `minutes` minutos y `days` días atrás, sin evento y no revisadas. */
  referencesWithoutEvents(minutes: number, days: number): Promise<ReferenciaRow[]>;
  markReferenceChecked(reference: string): Promise<void>;
  /** Borra el payload crudo de eventos con más de 72 h. Devuelve cuántos. */
  purgeRaw(): Promise<number>;
}

const COLUMNS =
  "id, tx_id, status, event_timestamp, source, reference, amount_in_cents, plan_id, amount_ok, estado, notified_at, raw, received_at";

type Row = {
  id: number;
  tx_id: string;
  status: string;
  event_timestamp: number;
  source: PagoSource;
  reference: string | null;
  amount_in_cents: number | null;
  plan_id: string | null;
  amount_ok: boolean | null;
  estado: PagoEstado;
  notified_at: string | null;
  raw: unknown | null;
  received_at: string;
};

function rowToEvento(r: Row): EventoPagoRow {
  return {
    id: r.id,
    txId: r.tx_id,
    status: r.status,
    eventTimestamp: Number(r.event_timestamp),
    source: r.source,
    reference: r.reference,
    amountInCents: r.amount_in_cents == null ? null : Number(r.amount_in_cents),
    planId: r.plan_id,
    amountOk: r.amount_ok,
    estado: r.estado,
    raw: r.raw,
    notifiedAt: r.notified_at,
    receivedAt: r.received_at,
  };
}

function fail(op: string, error: { message: string } | null): never {
  throw new PagosStoreError(`[pagos_store] ${op}: ${error?.message ?? "error desconocido"}`);
}

function isoAgo(ms: number): string {
  return new Date(Date.now() - ms).toISOString();
}

class SupabasePagosStore implements PagosStore {
  async recordReference(ref: { reference: string; planId: string; amountInCents: number }): Promise<void> {
    const { error } = await getSupabaseAdmin()
      .from("pagos_referencias")
      .upsert(
        { reference: ref.reference, plan_id: ref.planId, amount_in_cents: ref.amountInCents },
        { onConflict: "reference", ignoreDuplicates: true },
      );
    if (error) fail("recordReference", error);
  }

  async recordEvent(e: EventoPagoInput): Promise<"inserted" | "updated" | "duplicate"> {
    const supabase = getSupabaseAdmin();
    const inserted = await supabase
      .from("pagos_eventos")
      .upsert(
        {
          tx_id: e.txId,
          status: e.status,
          event_timestamp: e.eventTimestamp,
          source: e.source,
          reference: e.reference,
          amount_in_cents: e.amountInCents,
          plan_id: e.planId,
          amount_ok: e.amountOk,
          estado: e.estado,
          raw: e.raw ?? null,
        },
        { onConflict: "tx_id,status,event_timestamp", ignoreDuplicates: true },
      )
      .select("id");
    if (inserted.error) fail("recordEvent", inserted.error);
    if (inserted.data && inserted.data.length > 0) return "inserted";
    if (e.estado === "sin_verificar") return "duplicate";

    // La fila ya existía; si quedó sin verificar (API caída en su momento),
    // se completa con los datos verificados en vez de dejarla huérfana.
    const updated = await supabase
      .from("pagos_eventos")
      .update({
        reference: e.reference,
        amount_in_cents: e.amountInCents,
        plan_id: e.planId,
        amount_ok: e.amountOk,
        estado: e.estado,
      })
      .eq("tx_id", e.txId)
      .eq("status", e.status)
      .eq("event_timestamp", e.eventTimestamp)
      .eq("estado", "sin_verificar")
      .select("id");
    if (updated.error) fail("recordEvent", updated.error);
    return updated.data && updated.data.length > 0 ? "updated" : "duplicate";
  }

  async claimNotification(txId: string): Promise<boolean> {
    const supabase = getSupabaseAdmin();
    const claimed = await supabase
      .from("pagos_avisos")
      .upsert({ tx_id: txId }, { onConflict: "tx_id", ignoreDuplicates: true })
      .select("tx_id");
    if (claimed.error) fail("claimNotification", claimed.error);
    if (claimed.data && claimed.data.length > 0) return true;

    // Reclamo huérfano: alguien reclamó, no marcó el envío y pasó demasiado
    // tiempo (lambda muerta). Un solo UPDATE condicional: Postgres serializa.
    const retaken = await supabase
      .from("pagos_avisos")
      .update({ claimed_at: new Date().toISOString() })
      .eq("tx_id", txId)
      .is("sent_at", null)
      .lt("claimed_at", isoAgo(AVISO_HUERFANO_MINUTOS * 60_000))
      .select("tx_id");
    if (retaken.error) fail("claimNotification", retaken.error);
    return Boolean(retaken.data && retaken.data.length > 0);
  }

  async releaseNotification(txId: string): Promise<void> {
    const { error } = await getSupabaseAdmin().from("pagos_avisos").delete().eq("tx_id", txId).is("sent_at", null);
    if (error) fail("releaseNotification", error);
  }

  async markNotified(txId: string): Promise<void> {
    const supabase = getSupabaseAdmin();
    const now = new Date().toISOString();
    const aviso = await supabase.from("pagos_avisos").update({ sent_at: now }).eq("tx_id", txId);
    if (aviso.error) fail("markNotified", aviso.error);
    const evento = await supabase.from("pagos_eventos").update({ notified_at: now }).eq("tx_id", txId).is("notified_at", null);
    if (evento.error) fail("markNotified", evento.error);
  }

  async trace(txId: string): Promise<EventoPagoRow[]> {
    const { data, error } = await getSupabaseAdmin()
      .from("pagos_eventos")
      .select(COLUMNS)
      .eq("tx_id", txId)
      .order("received_at", { ascending: false });
    if (error) fail("trace", error);
    return ((data ?? []) as Row[]).map(rowToEvento);
  }

  async recentEvents(days: number): Promise<EventoPagoRow[]> {
    const { data, error } = await getSupabaseAdmin()
      .from("pagos_eventos")
      .select(COLUMNS)
      .gte("received_at", isoAgo(days * 86_400_000))
      .order("received_at", { ascending: false });
    if (error) fail("recentEvents", error);
    return ((data ?? []) as Row[]).map(rowToEvento);
  }

  async referencesWithoutEvents(minutes: number, days: number): Promise<ReferenciaRow[]> {
    const supabase = getSupabaseAdmin();
    const refs = await supabase
      .from("pagos_referencias")
      .select("reference, plan_id, amount_in_cents, created_at")
      .is("revisada_at", null)
      .lt("created_at", isoAgo(minutes * 60_000))
      .gte("created_at", isoAgo(days * 86_400_000))
      .order("created_at", { ascending: false })
      .limit(100);
    if (refs.error) fail("referencesWithoutEvents", refs.error);
    const list = (refs.data ?? []) as { reference: string; plan_id: string; amount_in_cents: number; created_at: string }[];
    if (list.length === 0) return [];

    const seen = await supabase
      .from("pagos_eventos")
      .select("reference")
      .in("reference", list.map((r) => r.reference));
    if (seen.error) fail("referencesWithoutEvents", seen.error);
    const conEvento = new Set(((seen.data ?? []) as { reference: string | null }[]).map((r) => r.reference));

    return list
      .filter((r) => !conEvento.has(r.reference))
      .map((r) => ({ reference: r.reference, planId: r.plan_id, amountInCents: Number(r.amount_in_cents), createdAt: r.created_at }));
  }

  async markReferenceChecked(reference: string): Promise<void> {
    const { error } = await getSupabaseAdmin()
      .from("pagos_referencias")
      .update({ revisada_at: new Date().toISOString() })
      .eq("reference", reference);
    if (error) fail("markReferenceChecked", error);
  }

  async purgeRaw(): Promise<number> {
    const { data, error } = await getSupabaseAdmin().rpc("pagos_purgar_raw");
    if (error) fail("purgeRaw", error);
    return typeof data === "number" ? data : 0;
  }
}

let store: PagosStore | null = null;

export function isPagosStoreConfigured(): boolean {
  return isSupabaseConfigured();
}

export function getPagosStore(): PagosStore {
  if (!store) store = new SupabasePagosStore();
  return store;
}
