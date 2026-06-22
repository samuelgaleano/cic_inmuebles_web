import Link from "next/link";
import { Building2, CheckCircle2, Clock, Inbox, Plus } from "lucide-react";
import { buttonVariants } from "@/components/ui/button";
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
    { label: "Inmuebles", value: properties.length, icon: Building2, color: "bg-brand-50 text-brand-700" },
    { label: "Disponibles", value: disponibles, icon: CheckCircle2, color: "bg-emerald-50 text-emerald-700" },
    { label: "En proceso", value: enProceso, icon: Clock, color: "bg-amber-50 text-amber-700" },
    { label: "Leads nuevos", value: leadsNuevos, icon: Inbox, color: "bg-rose-50 text-rose-700" },
  ];

  return (
    <div className="space-y-8">
      <div className="flex flex-wrap items-center justify-between gap-3">
        <div>
          <h1 className="text-2xl font-bold tracking-tight text-ink">Dashboard</h1>
          <p className="mt-0.5 text-sm text-muted">Resumen de tu inventario y clientes potenciales.</p>
        </div>
        <Link href="/admin/inmuebles/nuevo" className={buttonVariants({ variant: "primary", size: "md" })}>
          <Plus className="h-4 w-4" /> Nuevo inmueble
        </Link>
      </div>

      <div className="grid grid-cols-2 gap-4 lg:grid-cols-4">
        {stats.map((s) => (
          <div
            key={s.label}
            className="rounded-2xl border border-line bg-white p-5 transition-shadow duration-300 hover:shadow-[0_18px_40px_-28px_rgba(11,26,21,0.4)]"
          >
            <span className={`flex h-11 w-11 items-center justify-center rounded-xl ${s.color}`}>
              <s.icon className="h-5 w-5" />
            </span>
            <p className="mt-4 font-display text-3xl font-extrabold tracking-tight text-ink">{s.value}</p>
            <p className="text-sm text-muted">{s.label}</p>
          </div>
        ))}
      </div>

      <div className="grid gap-6 lg:grid-cols-2">
        {/* Leads recientes */}
        <section className="rounded-2xl border border-line bg-white p-6">
          <div className="mb-4 flex items-center justify-between">
            <h2 className="font-semibold text-ink">Leads recientes</h2>
            <Link href="/admin/leads" className="text-sm font-semibold text-brand-700 hover:underline">
              Ver todos
            </Link>
          </div>
          {leads.length === 0 ? (
            <p className="py-8 text-center text-sm text-muted">Aún no hay leads.</p>
          ) : (
            <ul className="divide-y divide-line">
              {leads.slice(0, 6).map((l) => (
                <li key={l.id} className="flex items-center justify-between py-2.5">
                  <div className="min-w-0">
                    <p className="truncate font-medium text-ink">{l.nombre}</p>
                    <p className="truncate text-xs text-muted">
                      {l.tipo === "vendedor" ? "Vendedor" : "Comprador"} · {l.telefono}
                    </p>
                  </div>
                  <span className="ml-3 shrink-0 rounded-full bg-surface px-2.5 py-0.5 text-xs font-medium text-ink-soft">
                    {LEAD_STATUS_LABELS[l.estado]}
                  </span>
                </li>
              ))}
            </ul>
          )}
        </section>

        {/* Resumen de inventario */}
        <section className="rounded-2xl border border-line bg-white p-6">
          <h2 className="mb-4 font-semibold text-ink">Inventario por estado</h2>
          <dl className="space-y-3 text-sm">
            <div className="flex justify-between"><dt className="text-muted">Disponibles</dt><dd className="font-semibold text-ink">{disponibles}</dd></div>
            <div className="flex justify-between"><dt className="text-muted">En proceso</dt><dd className="font-semibold text-ink">{enProceso}</dd></div>
            <div className="flex justify-between"><dt className="text-muted">Vendidos</dt><dd className="font-semibold text-ink">{vendidos}</dd></div>
            <div className="flex justify-between border-t border-line pt-3">
              <dt className="text-muted">Valor del inventario disponible</dt>
              <dd className="font-bold text-brand-700">
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
