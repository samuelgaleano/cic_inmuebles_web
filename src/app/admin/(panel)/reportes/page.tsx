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
import { cierresPorMes } from "@/lib/crm/reglas";
import { getCrmStore } from "@/lib/crm/store";
import type { Cierre } from "@/lib/crm/tipos";

export const dynamic = "force-dynamic";

/** "2026-11" → "nov 2026". */
function nombreMes(ym: string): string {
  return new Date(`${ym}-15T12:00:00.000Z`).toLocaleDateString("es-CO", { timeZone: "UTC", month: "short", year: "numeric" });
}

export default async function AdminReportesPage() {
  const repo = getRepository();
  const [properties, leads, appointments, cierres] = await Promise.all([
    repo.properties.list(),
    repo.leads.list(),
    repo.appointments.list(),
    // Sin el CRM (migraciones 0007/0010 sin aplicar) el resto del reporte funciona igual.
    getCrmStore()
      .listarCierres()
      .catch((): Cierre[] => []),
  ]);
  const ventasPorMes = cierresPorMes(cierres, new Date());
  const totalVentas = ventasPorMes.reduce(
    (t, m) => ({ cantidad: t.cantidad + m.cantidad, valorVendido: t.valorVendido + m.valorVendido, comisionPactada: t.comisionPactada + m.comisionPactada, comisionCobrada: t.comisionCobrada + m.comisionCobrada }),
    { cantidad: 0, valorVendido: 0, comisionPactada: 0, comisionCobrada: 0 },
  );

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

      {/* Ventas cerradas (registradas desde la ficha del vendedor en el CRM) */}
      <section className="rounded-2xl border border-line bg-white p-6" aria-labelledby="ventas-cerradas">
        <h2 id="ventas-cerradas" className="font-semibold text-ink">Ventas cerradas</h2>
        <p className="mt-0.5 text-sm text-muted">Últimos 6 meses, por la fecha de la venta. Se registran desde la ficha del vendedor en el CRM.</p>
        <div className="mt-4 overflow-x-auto">
          <table className="w-full text-left text-sm">
            <thead className="border-b border-line text-xs uppercase tracking-wider text-muted">
              <tr>
                <th scope="col" className="py-2 pr-4 font-semibold">Mes</th>
                <th scope="col" className="py-2 pr-4 text-right font-semibold">Ventas</th>
                <th scope="col" className="py-2 pr-4 text-right font-semibold">Valor vendido</th>
                <th scope="col" className="py-2 pr-4 text-right font-semibold">Comisión pactada</th>
                <th scope="col" className="py-2 text-right font-semibold">Comisión cobrada</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-line">
              {ventasPorMes.map((m) => (
                <tr key={m.mes} className={m.cantidad ? "" : "text-muted"}>
                  <th scope="row" className="py-2 pr-4 font-medium capitalize text-ink">{nombreMes(m.mes)}</th>
                  <td className="py-2 pr-4 text-right tabular-nums">{m.cantidad}</td>
                  <td className="py-2 pr-4 text-right tabular-nums">{m.cantidad ? formatPrice(m.valorVendido) : "—"}</td>
                  <td className="py-2 pr-4 text-right tabular-nums">{m.cantidad ? formatPrice(m.comisionPactada) : "—"}</td>
                  <td className={`py-2 text-right tabular-nums ${m.comisionCobrada < m.comisionPactada ? "font-semibold text-accent-600" : ""}`}>{m.cantidad ? formatPrice(m.comisionCobrada) : "—"}</td>
                </tr>
              ))}
            </tbody>
            <tfoot className="border-t-2 border-line font-semibold text-ink">
              <tr>
                <th scope="row" className="py-2 pr-4">Total</th>
                <td className="py-2 pr-4 text-right tabular-nums">{totalVentas.cantidad}</td>
                <td className="py-2 pr-4 text-right tabular-nums">{formatPrice(totalVentas.valorVendido)}</td>
                <td className="py-2 pr-4 text-right tabular-nums">{formatPrice(totalVentas.comisionPactada)}</td>
                <td className="py-2 text-right tabular-nums">{formatPrice(totalVentas.comisionCobrada)}</td>
              </tr>
            </tfoot>
          </table>
        </div>
        {totalVentas.comisionCobrada < totalVentas.comisionPactada && (
          <p className="mt-3 text-sm text-ink-soft">
            Falta cobrar <strong className="text-ink">{formatPrice(totalVentas.comisionPactada - totalVentas.comisionCobrada)}</strong> de comisión en estos 6 meses.
          </p>
        )}
      </section>

      {/* Catálogo en Google Sheets */}
      <section className="rounded-2xl border border-line bg-white p-6">
        <div className="flex flex-wrap items-center justify-between gap-3">
          <h2 className="flex items-center gap-2 font-semibold text-ink">
            <FileText className="h-5 w-5 text-brand-600" /> Copia opcional en Google Sheets
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
            ? "El catálogo se copia a la hoja al crear, editar o eliminar inmuebles. La plataforma ya no depende de ella: todo se ve y se descarga desde Datos y se revisa en Conexiones."
            : "No hace falta: todo se gestiona en el panel y se descarga desde Datos (CSV para Excel o Google Sheets) cuando se necesite."}
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
