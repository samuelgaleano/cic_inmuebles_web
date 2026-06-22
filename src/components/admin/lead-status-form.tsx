"use client";

import { useRef } from "react";
import { setLeadStatusAction } from "@/lib/actions/admin-leads";
import { LEAD_STATUSES, LEAD_STATUS_LABELS, type LeadStatus } from "@/lib/domain";

export function LeadStatusForm({ id, estado }: { id: string; estado: LeadStatus }) {
  const ref = useRef<HTMLFormElement>(null);
  return (
    <form action={setLeadStatusAction} ref={ref}>
      <input type="hidden" name="id" value={id} />
      <select
        name="estado"
        defaultValue={estado}
        onChange={() => ref.current?.requestSubmit()}
        className="h-9 rounded-lg border border-line bg-surface px-2.5 text-xs font-semibold text-ink-soft transition-colors focus:border-brand-500 focus:bg-white focus:outline-none focus:ring-2 focus:ring-brand-200"
      >
        {LEAD_STATUSES.map((s) => (
          <option key={s} value={s}>{LEAD_STATUS_LABELS[s]}</option>
        ))}
      </select>
    </form>
  );
}
