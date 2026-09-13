import { AVISO_HUERFANO_MINUTOS, type EventoPagoInput, type EventoPagoRow, type PagosStore, type ReferenciaRow } from "./store";

/**
 * Store en memoria con la misma semántica que Supabase (UNIQUE por
 * tx_id+status+event_timestamp, reclamo atómico del aviso, ventanas de
 * tiempo). Solo para pruebas. `now` es inyectable para simular el paso del
 * tiempo.
 */
export class MemoryPagosStore implements PagosStore {
  eventos: EventoPagoRow[] = [];
  referencias: (ReferenciaRow & { revisadaAt: string | null })[] = [];
  avisos = new Map<string, { claimedAt: number; sentAt: number | null }>();
  now = () => Date.now();
  private seq = 1;
  failNext: string | null = null;

  private guard(op: string) {
    if (this.failNext === op || this.failNext === "*") {
      this.failNext = null;
      throw new Error(`[memory] fallo simulado en ${op}`);
    }
  }

  async recordReference(ref: { reference: string; planId: string; amountInCents: number }) {
    this.guard("recordReference");
    if (!this.referencias.some((r) => r.reference === ref.reference)) {
      this.referencias.push({ ...ref, createdAt: new Date(this.now()).toISOString(), revisadaAt: null });
    }
  }

  async recordEvent(e: EventoPagoInput): Promise<"inserted" | "updated" | "duplicate"> {
    this.guard("recordEvent");
    const existing = this.eventos.find(
      (x) => x.txId === e.txId && x.status === e.status && x.eventTimestamp === e.eventTimestamp,
    );
    if (!existing) {
      this.eventos.push({ ...e, id: this.seq++, notifiedAt: null, receivedAt: new Date(this.now()).toISOString() });
      return "inserted";
    }
    if (existing.estado === "sin_verificar" && e.estado !== "sin_verificar") {
      Object.assign(existing, { reference: e.reference, amountInCents: e.amountInCents, planId: e.planId, amountOk: e.amountOk, estado: e.estado });
      return "updated";
    }
    return "duplicate";
  }

  async claimNotification(txId: string) {
    this.guard("claimNotification");
    const cur = this.avisos.get(txId);
    if (!cur) {
      this.avisos.set(txId, { claimedAt: this.now(), sentAt: null });
      return true;
    }
    if (cur.sentAt == null && cur.claimedAt < this.now() - AVISO_HUERFANO_MINUTOS * 60_000) {
      cur.claimedAt = this.now();
      return true;
    }
    return false;
  }

  async releaseNotification(txId: string) {
    this.guard("releaseNotification");
    const cur = this.avisos.get(txId);
    if (cur && cur.sentAt == null) this.avisos.delete(txId);
  }

  async markNotified(txId: string) {
    this.guard("markNotified");
    const now = this.now();
    const cur = this.avisos.get(txId);
    if (cur) cur.sentAt = now;
    const iso = new Date(now).toISOString();
    for (const x of this.eventos) if (x.txId === txId && !x.notifiedAt) x.notifiedAt = iso;
  }

  async trace(txId: string) {
    return this.eventos.filter((x) => x.txId === txId).slice().reverse();
  }

  async recentEvents(days: number) {
    const since = this.now() - days * 86_400_000;
    return this.eventos.filter((x) => Date.parse(x.receivedAt) >= since).slice().reverse();
  }

  async referencesWithoutEvents(minutes: number, days: number) {
    const con = new Set(this.eventos.map((e) => e.reference));
    const before = this.now() - minutes * 60_000;
    const since = this.now() - days * 86_400_000;
    return this.referencias
      .filter((r) => !r.revisadaAt && !con.has(r.reference))
      .filter((r) => Date.parse(r.createdAt) < before && Date.parse(r.createdAt) >= since)
      .map(({ revisadaAt: _r, ...r }) => r);
  }

  async markReferenceChecked(reference: string) {
    const r = this.referencias.find((x) => x.reference === reference);
    if (r) r.revisadaAt = new Date(this.now()).toISOString();
  }

  async purgeRaw() {
    let n = 0;
    const limit = this.now() - 72 * 3_600_000;
    for (const e of this.eventos) if (e.raw != null && Date.parse(e.receivedAt) < limit) { e.raw = null; n++; }
    return n;
  }
}
