import { ExternalLink, FileText, RotateCw } from "lucide-react";
import { getRepository } from "@/lib/data";
import {
  LEAD_STATUS_LABELS,
  PROPERTY_STATUS_LABELS,
  PROPERTY_STATUSES,
  LEAD_STATUSES,
} from "@/lib/domain";
import { formatPrice } from "@/lib/utils/format";
import { isSheetsConfigured, sheetUrl } from "@/lib/integrations/sheets";
import { resyncSheetAction } from "@/lib/actions/admin-sheets";

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

  const sheetsOn = isSheetsConfigured();
  const sheetLink = sheetUrl();

  return (
    <div className="space-y-8">
      <div>
        <h1 className="text-2xl font-bold tracking-tight text-ink">Reportes</h1>
        <p className="mt-0.5 text-sm text-muted">Indicadores del negocio.</p>
      </div>

      <div className="grid grid-cols-2 gap-4 lg:grid-cols-3">
        {cards.map((c) => (
          <div key={c.label} className="rounded-2xl border border-line bg-white p-5">
            <p className="text-sm text-muted">{c.label}</p>
            <p className="mt-1 font-display text-2xl font-extrabold tracking-tight text-ink">{c.value}</p>
          </div>
        ))}
      </div>

      {/* Catálogo en Google Sheets */}
      <section className="rounded-2xl border border-line bg-white p-6">
        <div className="flex flex-wrap items-center justify-between gap-3">
          <h2 className="flex items-center gap-2 font-semibold text-ink">
            <FileText className="h-5 w-5 text-brand-600" /> Catálogo en Google Sheets
          </h2>
          {sheetsOn && (
            <div className="flex flex-wrap items-center gap-2">
              {sheetLink && (
                <a
                  href={sheetLink}
                  target="_blank"
                  rel="noopener noreferrer"
                  className="inline-flex h-9 items-center gap-1.5 rounded-xl border border-line px-3 text-sm font-medium text-ink-soft transition-colors hover:border-brand-300 hover:bg-brand-50 hover:text-brand-700"
                >
                  <ExternalLink className="h-4 w-4" /> Abrir catálogo
                </a>
              )}
              <form action={resyncSheetAction}>
                <button className="inline-flex h-9 items-center gap-1.5 rounded-xl bg-brand-700 px-3.5 text-sm font-semibold text-white transition-colors hover:bg-brand-800">
                  <RotateCw className="h-4 w-4" /> Sincronizar ahora
                </button>
              </form>
            </div>
          )}
        </div>
        <p className="mt-2 text-sm text-muted">
          {sheetsOn
            ? "El catálogo se sincroniza automáticamente al crear, editar o eliminar inmuebles (incluido el estado). Usa “Sincronizar ahora” para reescribir todo de una vez."
            : "Conecta una hoja agregando GOOGLE_SHEETS_SPREADSHEET_ID en Vercel (con la misma cuenta de servicio de Drive) y compártela como editor. El inventario se mantendrá actualizado solo."}
        </p>
      </section>

      <div className="grid gap-6 lg:grid-cols-3">
        <section className="rounded-2xl border border-line bg-white p-6">
          <h2 className="mb-4 font-semibold text-ink">Inventario por estado</h2>
          <dl className="space-y-2.5 text-sm">
            {PROPERTY_STATUSES.map((s) => (
              <div key={s} className="flex justify-between">
                <dt className="text-muted">{PROPERTY_STATUS_LABELS[s]}</dt>
                <dd className="font-semibold text-ink">{properties.filter((p) => p.estado === s).length}</dd>
              </div>
            ))}
          </dl>
        </section>

        <section className="rounded-2xl border border-line bg-white p-6">
          <h2 className="mb-4 font-semibold text-ink">Leads por estado</h2>
          <dl className="space-y-2.5 text-sm">
            {LEAD_STATUSES.map((s) => (
              <div key={s} className="flex justify-between">
                <dt className="text-muted">{LEAD_STATUS_LABELS[s]}</dt>
                <dd className="font-semibold text-ink">{leads.filter((l) => l.estado === s).length}</dd>
              </div>
            ))}
          </dl>
        </section>

        <section className="rounded-2xl border border-line bg-white p-6">
          <h2 className="mb-4 font-semibold text-ink">Inmuebles por ciudad</h2>
          <dl className="space-y-2.5 text-sm">
            {Object.entries(porCiudad)
              .sort((a, b) => b[1] - a[1])
              .map(([ciudad, n]) => (
                <div key={ciudad} className="flex justify-between">
                  <dt className="text-muted">{ciudad}</dt>
                  <dd className="font-semibold text-ink">{n}</dd>
                </div>
              ))}
            {Object.keys(porCiudad).length === 0 && (
              <p className="text-muted">Sin datos.</p>
            )}
          </dl>
        </section>
      </div>
    </div>
  );
}
