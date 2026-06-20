import { CalendarDays } from "lucide-react";

export default function AdminAgendaPage() {
  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-2xl font-bold text-slate-900">Agenda</h1>
        <p className="text-slate-500">Visitas y disponibilidad de agentes.</p>
      </div>
      <div className="flex flex-col items-center justify-center rounded-xl border border-dashed border-slate-300 bg-white py-20 text-center">
        <CalendarDays className="h-12 w-12 text-brand-300" />
        <h2 className="mt-4 text-lg font-semibold text-slate-800">Próximamente (Fase 2)</h2>
        <p className="mt-1 max-w-md text-sm text-slate-500">
          Aquí los agentes definirán su disponibilidad y se gestionarán las visitas
          reservadas desde el sitio, con confirmaciones y recordatorios.
        </p>
      </div>
    </div>
  );
}
