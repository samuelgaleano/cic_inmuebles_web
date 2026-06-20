import Link from "next/link";
import { Building2, CheckCircle2, Clock, Inbox, Plus } from "lucide-react";
import { getRepository } from "@/lib/data";
import { LEAD_STATUS_LABELS } from "@/lib/domain";
import { formatPrice } from "@/lib/utils/format";

export const dynamic = "force-dynamic";

export default async function AdminDashboard() {
  const repo = getRepository();
  const [properties, leads] = await Promise.all([
    repo.properties.list(),
    repo.leads.list(),
  ]);

  const disponibles = properties.filter((p) => p.estado === "disponible").length;
  const enProceso = properties.filter((p) => p.estado === "en_proceso").length;
  const vendidos = properties.filter((p) => p.estado === "vendido").length;
  const leadsNuevos = leads.filter((l) => l.estado === "nuevo").length;

  const stats = [
    { label: "Inmuebles", value: properties.length, icon: Building2, color: "text-brand-700 bg-brand-50" },
    { label: "Disponibles", value: disponibles, icon: CheckCircle2, color: "text-emerald-700 bg-emerald-50" },
    { label: "En proceso", value: enProceso, icon: Clock, color: "text-amber-700 bg-amber-50" },
    { label: "Leads nuevos", value: leadsNuevos, icon: Inbox, color: "text-rose-700 bg-rose-50" },
  ];

  return (
    <div className="space-y-8">
      <div className="flex flex-wrap items-center justify-between gap-3">
        <div>
          <h1 className="text-2xl font-bold text-slate-900">Dashboard</h1>
          <p className="text-slate-500">Resumen de tu inventario y clientes potenciales.</p>
        </div>
        <Link
          href="/admin/inmuebles/nuevo"
          className="inline-flex h-10 items-center gap-2 rounded-lg bg-brand-700 px-4 text-sm font-semibold text-white hover:bg-brand-800"
        >
          <Plus className="h-4 w-4" /> Nuevo inmueble
        </Link>
      </div>

      <div className="grid grid-cols-2 gap-4 lg:grid-cols-4">
        {stats.map((s) => (
          <div key={s.label} className="rounded-xl border border-slate-200 bg-white p-5">
            <span className={`flex h-10 w-10 items-center justify-center rounded-lg ${s.color}`}>
              <s.icon className="h-5 w-5" />
            </span>
            <p className="mt-3 text-3xl font-bold text-slate-900">{s.value}</p>
            <p className="text-sm text-slate-500">{s.label}</p>
          </div>
        ))}
      </div>

      <div className="grid gap-6 lg:grid-cols-2">
        {/* Leads recientes */}
        <section className="rounded-xl border border-slate-200 bg-white p-5">
          <div className="mb-4 flex items-center justify-between">
            <h2 className="font-semibold text-slate-900">Leads recientes</h2>
            <Link href="/admin/leads" className="text-sm font-medium text-brand-700 hover:underline">
              Ver todos
            </Link>
          </div>
          {leads.length === 0 ? (
            <p className="py-6 text-center text-sm text-slate-400">Aún no hay leads.</p>
          ) : (
            <ul className="divide-y divide-slate-100">
              {leads.slice(0, 6).map((l) => (
                <li key={l.id} className="flex items-center justify-between py-2.5">
                  <div className="min-w-0">
                    <p className="truncate font-medium text-slate-800">{l.nombre}</p>
                    <p className="truncate text-xs text-slate-500">
                      {l.tipo === "vendedor" ? "Vendedor" : "Comprador"} · {l.telefono}
                    </p>
                  </div>
                  <span className="ml-3 shrink-0 rounded-full bg-slate-100 px-2 py-0.5 text-xs text-slate-600">
                    {LEAD_STATUS_LABELS[l.estado]}
                  </span>
                </li>
              ))}
            </ul>
          )}
        </section>

        {/* Resumen de inventario */}
        <section className="rounded-xl border border-slate-200 bg-white p-5">
          <h2 className="mb-4 font-semibold text-slate-900">Inventario por estado</h2>
          <dl className="space-y-3 text-sm">
            <div className="flex justify-between"><dt className="text-slate-600">Disponibles</dt><dd className="font-semibold">{disponibles}</dd></div>
            <div className="flex justify-between"><dt className="text-slate-600">En proceso</dt><dd className="font-semibold">{enProceso}</dd></div>
            <div className="flex justify-between"><dt className="text-slate-600">Vendidos</dt><dd className="font-semibold">{vendidos}</dd></div>
            <div className="flex justify-between border-t border-slate-100 pt-3">
              <dt className="text-slate-600">Valor del inventario disponible</dt>
              <dd className="font-semibold">
                {formatPrice(
                  properties.filter((p) => p.estado === "disponible").reduce((sum, p) => sum + p.precio, 0),
                )}
              </dd>
            </div>
          </dl>
        </section>
      </div>
    </div>
  );
}
