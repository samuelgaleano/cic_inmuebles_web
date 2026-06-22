"use client";

import { useRef } from "react";
import { setAppointmentStatusAction } from "@/lib/actions/admin-agenda";
import {
  APPOINTMENT_STATUSES,
  APPOINTMENT_STATUS_LABELS,
  type AppointmentStatus,
} from "@/lib/domain";

export function AppointmentStatusForm({ id, estado }: { id: string; estado: AppointmentStatus }) {
  const ref = useRef<HTMLFormElement>(null);
  return (
    <form action={setAppointmentStatusAction} ref={ref}>
      <input type="hidden" name="id" value={id} />
      <select
        name="estado"
        defaultValue={estado}
        onChange={() => ref.current?.requestSubmit()}
        className="h-9 rounded-lg border border-line bg-surface px-2.5 text-xs font-semibold text-ink-soft transition-colors focus:border-brand-500 focus:bg-white focus:outline-none focus:ring-2 focus:ring-brand-200"
      >
        {APPOINTMENT_STATUSES.map((s) => (
          <option key={s} value={s}>{APPOINTMENT_STATUS_LABELS[s]}</option>
        ))}
      </select>
    </form>
  );
}
