import { CalendarPlus, Clock, Trash2, UserPlus } from "lucide-react";
import { getRepository } from "@/lib/data";
import {
  AGENT_ROLES,
  AGENT_ROLE_LABELS,
  WEEKDAY_LABELS,
  type AgentAvailability,
} from "@/lib/domain";
import {
  createAgentAction,
  createAppointmentAction,
  deleteAgentAction,
  deleteAppointmentAction,
  setAvailabilityAction,
} from "@/lib/actions/admin-agenda";
import { AppointmentStatusForm } from "@/components/admin/appointment-status-form";

export const dynamic = "force-dynamic";

const inputClass =
  "h-10 w-full rounded-lg border border-slate-300 px-3 text-sm focus:border-brand-500 focus:outline-none focus:ring-2 focus:ring-brand-200";

function AvailabilityEditor({
  agentId,
  slots,
}: {
  agentId: string;
  slots: AgentAvailability[];
}) {
  const byDay = new Map(slots.map((s) => [s.diaSemana, s]));
  return (
    <form action={setAvailabilityAction} className="mt-3 space-y-2 border-t border-slate-100 pt-3">
      <input type="hidden" name="agentId" value={agentId} />
      <p className="text-xs font-medium uppercase text-slate-400">Disponibilidad semanal</p>
      {WEEKDAY_LABELS.map((label, dia) => {
        const s = byDay.get(dia);
        return (
          <div key={dia} className="flex items-center gap-2 text-sm">
            <label className="flex w-28 items-center gap-2">
              <input type="checkbox" name={`dia_${dia}`} defaultChecked={Boolean(s)} className="h-4 w-4" />
              {label}
            </label>
            <input type="time" name={`inicio_${dia}`} defaultValue={s?.horaInicio ?? "09:00"} className="h-9 rounded-lg border border-slate-300 px-2 text-sm" />
            <span className="text-slate-400">–</span>
            <input type="time" name={`fin_${dia}`} defaultValue={s?.horaFin ?? "18:00"} className="h-9 rounded-lg border border-slate-300 px-2 text-sm" />
          </div>
        );
      })}
      <button className="inline-flex h-9 items-center gap-1.5 rounded-lg bg-brand-700 px-3 text-xs font-semibold text-white hover:bg-brand-800">
        <Clock className="h-3.5 w-3.5" /> Guardar disponibilidad
      </button>
    </form>
  );
}

function formatDateTime(iso: string): string {
  return new Date(iso).toLocaleString("es-CO", {
    weekday: "short",
    day: "2-digit",
    month: "short",
    hour: "2-digit",
    minute: "2-digit",
  });
}

export default async function AdminAgendaPage() {
  const repo = getRepository();
  const [agents, appointments, properties] = await Promise.all([
    repo.agents.list(),
    repo.appointments.list(),
    repo.properties.list(),
  ]);
  const availabilities = await Promise.all(agents.map((a) => repo.agents.listAvailability(a.id)));
  const propTitle = new Map(properties.map((p) => [p.id, p.titulo]));
  const agentName = new Map(agents.map((a) => [a.id, a.nombre]));

  return (
    <div className="space-y-8">
      <div>
        <h1 className="text-2xl font-bold text-slate-900">Agenda</h1>
        <p className="text-slate-500">Agentes, disponibilidad y visitas.</p>
      </div>

      {/* Agentes */}
      <section className="space-y-4">
        <h2 className="text-lg font-semibold text-slate-900">Agentes</h2>
        <div className="grid gap-4 lg:grid-cols-2">
          {agents.map((a, i) => (
            <div key={a.id} className="rounded-xl border border-slate-200 bg-white p-5">
              <div className="flex items-start justify-between">
                <div>
                  <p className="font-semibold text-slate-900">{a.nombre}</p>
                  <p className="text-sm text-slate-500">{a.email}</p>
                  <span className="mt-1 inline-block rounded-full bg-brand-50 px-2 py-0.5 text-xs font-medium text-brand-700">
                    {AGENT_ROLE_LABELS[a.rol]}
                  </span>
                </div>
                <form action={deleteAgentAction}>
                  <input type="hidden" name="id" value={a.id} />
                  <button className="rounded-md p-2 text-slate-400 hover:bg-rose-50 hover:text-rose-600" aria-label="Eliminar agente">
                    <Trash2 className="h-4 w-4" />
                  </button>
                </form>
              </div>
              <AvailabilityEditor agentId={a.id} slots={availabilities[i]} />
            </div>
          ))}
        </div>

        {/* Nuevo agente */}
        <form action={createAgentAction} className="flex flex-wrap items-end gap-3 rounded-xl border border-dashed border-slate-300 bg-white p-4">
          <div className="flex-1 min-w-40">
            <label className="mb-1 block text-xs font-medium text-slate-600">Nombre</label>
            <input name="nombre" className={inputClass} required />
          </div>
          <div className="flex-1 min-w-48">
            <label className="mb-1 block text-xs font-medium text-slate-600">Email</label>
            <input name="email" type="email" className={inputClass} required />
          </div>
          <div className="min-w-40">
            <label className="mb-1 block text-xs font-medium text-slate-600">Teléfono</label>
            <input name="telefono" className={inputClass} />
          </div>
          <div className="min-w-40">
            <label className="mb-1 block text-xs font-medium text-slate-600">Rol</label>
            <select name="rol" defaultValue="agente_master" className={inputClass}>
              {AGENT_ROLES.map((r) => (
                <option key={r} value={r}>{AGENT_ROLE_LABELS[r]}</option>
              ))}
            </select>
          </div>
          <button className="inline-flex h-10 items-center gap-2 rounded-lg bg-brand-700 px-4 text-sm font-semibold text-white hover:bg-brand-800">
            <UserPlus className="h-4 w-4" /> Agregar
          </button>
        </form>
      </section>

      {/* Citas */}
      <section className="space-y-4">
        <h2 className="text-lg font-semibold text-slate-900">Visitas agendadas</h2>

        {/* Nueva cita */}
        <form action={createAppointmentAction} className="grid gap-3 rounded-xl border border-dashed border-slate-300 bg-white p-4 sm:grid-cols-2 lg:grid-cols-3">
          <div>
            <label className="mb-1 block text-xs font-medium text-slate-600">Inmueble</label>
            <select name="propertyId" className={inputClass} required>
              <option value="">Selecciona...</option>
              {properties.map((p) => (
                <option key={p.id} value={p.id}>{p.titulo}</option>
              ))}
            </select>
          </div>
          <div>
            <label className="mb-1 block text-xs font-medium text-slate-600">Agente</label>
            <select name="agentId" className={inputClass}>
              <option value="">Sin asignar</option>
              {agents.map((a) => (
                <option key={a.id} value={a.id}>{a.nombre}</option>
              ))}
            </select>
          </div>
          <div>
            <label className="mb-1 block text-xs font-medium text-slate-600">Fecha y hora</label>
            <input name="inicioEn" type="datetime-local" className={inputClass} required />
          </div>
          <div>
            <label className="mb-1 block text-xs font-medium text-slate-600">Cliente</label>
            <input name="clienteNombre" className={inputClass} required />
          </div>
          <div>
            <label className="mb-1 block text-xs font-medium text-slate-600">Teléfono</label>
            <input name="clienteTelefono" className={inputClass} required />
          </div>
          <div className="flex items-end">
            <button className="inline-flex h-10 w-full items-center justify-center gap-2 rounded-lg bg-brand-700 px-4 text-sm font-semibold text-white hover:bg-brand-800">
              <CalendarPlus className="h-4 w-4" /> Agendar visita
            </button>
          </div>
        </form>

        <div className="overflow-x-auto rounded-xl border border-slate-200 bg-white">
          <table className="w-full text-left text-sm">
            <thead className="border-b border-slate-200 bg-slate-50 text-xs uppercase text-slate-500">
              <tr>
                <th className="px-4 py-3">Fecha</th>
                <th className="px-4 py-3">Inmueble</th>
                <th className="px-4 py-3">Cliente</th>
                <th className="px-4 py-3">Agente</th>
                <th className="px-4 py-3">Estado</th>
                <th className="px-4 py-3 text-right">Acción</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-100">
              {appointments.map((ap) => (
                <tr key={ap.id} className="hover:bg-slate-50">
                  <td className="px-4 py-3 text-slate-700">{formatDateTime(ap.inicioEn)}</td>
                  <td className="px-4 py-3 text-slate-700">{propTitle.get(ap.propertyId) ?? "—"}</td>
                  <td className="px-4 py-3">
                    <p className="font-medium text-slate-800">{ap.clienteNombre}</p>
                    <p className="text-xs text-slate-500">{ap.clienteTelefono}</p>
                  </td>
                  <td className="px-4 py-3 text-slate-600">{ap.agentId ? agentName.get(ap.agentId) ?? "—" : "Sin asignar"}</td>
                  <td className="px-4 py-3"><AppointmentStatusForm id={ap.id} estado={ap.estado} /></td>
                  <td className="px-4 py-3 text-right">
                    <form action={deleteAppointmentAction} className="inline">
                      <input type="hidden" name="id" value={ap.id} />
                      <button className="rounded-md p-2 text-slate-400 hover:bg-rose-50 hover:text-rose-600" aria-label="Eliminar cita">
                        <Trash2 className="h-4 w-4" />
                      </button>
                    </form>
                  </td>
                </tr>
              ))}
              {appointments.length === 0 && (
                <tr>
                  <td colSpan={6} className="px-4 py-10 text-center text-slate-400">
                    No hay visitas agendadas todavía.
                  </td>
                </tr>
              )}
            </tbody>
          </table>
        </div>
      </section>
    </div>
  );
}
