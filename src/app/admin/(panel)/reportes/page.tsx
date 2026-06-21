import { getRepository } from "@/lib/data";
import {
  LEAD_STATUS_LABELS,
  PROPERTY_STATUS_LABELS,
  PROPERTY_STATUSES,
  LEAD_STATUSES,
} from "@/lib/domain";
import { formatPrice } from "@/lib/utils/format";

export const dynamic = "force-dynamic";

export default async function AdminReportesPage() {
  const repo = getRepository();
  const [properties, leads, appointments] = await Promise.all([
    repo.properties.list(),
    repo.leads.list(),
    repo.appointments.list(),
  ]);

  const valorDisponible = properties
    .filter((p) => p.estado === "disponible")
    .reduce((s, p) => s + p.precio, 0);
  const valorVendido = properties
    .filter((p) => p.estado === "vendido")
    .reduce((s, p) => s + p.precio, 0);

  const porCiudad = properties.reduce<Record<string, number>>((acc, p) => {
    acc[p.ubicacion.ciudad] = (acc[p.ubicacion.ciudad] ?? 0) + 1;
    return acc;
  }, {});

  const cards = [
    { label: "Inmuebles", value: String(properties.length) },
    { label: "Valor disponible", value: formatPrice(valorDisponible) },
    { label: "Valor vendido", value: formatPrice(valorVendido) },
    { label: "Leads totales", value: String(leads.length) },
    { label: "Leads vendedores", value: String(leads.filter((l) => l.tipo === "vendedor").length) },
    { label: "Visitas agendadas", value: String(appointments.length) },
  ];

  return (
    <div className="space-y-8">
      <div>
        <h1 className="text-2xl font-bold text-slate-900">Reportes</h1>
        <p className="text-slate-500">Indicadores del negocio.</p>
      </div>

      <div className="grid grid-cols-2 gap-4 lg:grid-cols-3">
        {cards.map((c) => (
          <div key={c.label} className="rounded-xl border border-slate-200 bg-white p-5">
            <p className="text-sm text-slate-500">{c.label}</p>
            <p className="mt-1 text-2xl font-bold text-slate-900">{c.value}</p>
          </div>
        ))}
      </div>

      <div className="grid gap-6 lg:grid-cols-3">
        <section className="rounded-xl border border-slate-200 bg-white p-5">
          <h2 className="mb-3 font-semibold text-slate-900">Inventario por estado</h2>
          <dl className="space-y-2 text-sm">
            {PROPERTY_STATUSES.map((s) => (
              <div key={s} className="flex justify-between">
                <dt className="text-slate-600">{PROPERTY_STATUS_LABELS[s]}</dt>
                <dd className="font-semibold">{properties.filter((p) => p.estado === s).length}</dd>
              </div>
            ))}
          </dl>
        </section>

        <section className="rounded-xl border border-slate-200 bg-white p-5">
          <h2 className="mb-3 font-semibold text-slate-900">Leads por estado</h2>
          <dl className="space-y-2 text-sm">
            {LEAD_STATUSES.map((s) => (
              <div key={s} className="flex justify-between">
                <dt className="text-slate-600">{LEAD_STATUS_LABELS[s]}</dt>
                <dd className="font-semibold">{leads.filter((l) => l.estado === s).length}</dd>
              </div>
            ))}
          </dl>
        </section>

        <section className="rounded-xl border border-slate-200 bg-white p-5">
          <h2 className="mb-3 font-semibold text-slate-900">Inmuebles por ciudad</h2>
          <dl className="space-y-2 text-sm">
            {Object.entries(porCiudad)
              .sort((a, b) => b[1] - a[1])
              .map(([ciudad, n]) => (
                <div key={ciudad} className="flex justify-between">
                  <dt className="text-slate-600">{ciudad}</dt>
                  <dd className="font-semibold">{n}</dd>
                </div>
              ))}
            {Object.keys(porCiudad).length === 0 && (
              <p className="text-slate-400">Sin datos.</p>
            )}
          </dl>
        </section>
      </div>
    </div>
  );
}
