import { MessageCircle, Trash2 } from "lucide-react";
import { getRepository } from "@/lib/data";
import { deleteLeadAction } from "@/lib/actions/admin-leads";
import { LeadStatusForm } from "@/components/admin/lead-status-form";
import { LEAD_INTENT_LABELS } from "@/lib/domain";

export const dynamic = "force-dynamic";

function waLink(phone: string): string {
  const digits = phone.replace(/\D/g, "");
  return `https://wa.me/${digits}`;
}

function formatDate(iso: string): string {
  return new Date(iso).toLocaleString("es-CO", {
    day: "2-digit",
    month: "short",
    hour: "2-digit",
    minute: "2-digit",
  });
}

export default async function AdminLeadsPage() {
  const leads = await getRepository().leads.list();

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-2xl font-bold tracking-tight text-ink">Leads</h1>
        <p className="mt-0.5 text-sm text-muted">{leads.length} cliente{leads.length === 1 ? "" : "s"} potencial{leads.length === 1 ? "" : "es"}</p>
      </div>

      <div className="overflow-x-auto rounded-2xl border border-line bg-white">
        <table className="w-full text-left text-sm">
          <thead className="border-b border-line bg-surface text-xs uppercase tracking-wider text-muted">
            <tr>
              <th className="px-4 py-3 font-semibold">Cliente</th>
              <th className="px-4 py-3 font-semibold">Tipo</th>
              <th className="px-4 py-3 font-semibold">Contexto</th>
              <th className="px-4 py-3 font-semibold">Fecha</th>
              <th className="px-4 py-3 font-semibold">Estado</th>
              <th className="px-4 py-3 text-right font-semibold">Acciones</th>
            </tr>
          </thead>
          <tbody className="divide-y divide-line">
            {leads.map((l) => (
              <tr key={l.id} className="align-top transition-colors hover:bg-surface">
                <td className="px-4 py-3">
                  <p className="font-medium text-ink">{l.nombre}</p>
                  <p className="text-xs text-muted">{l.telefono}</p>
                  {l.email && <p className="text-xs text-muted">{l.email}</p>}
                </td>
                <td className="px-4 py-3">
                  <span className={`rounded-full px-2.5 py-0.5 text-xs font-semibold ${l.tipo === "vendedor" ? "bg-accent-500/15 text-accent-600" : "bg-brand-50 text-brand-700"}`}>
                    {l.tipo === "vendedor" ? "Vendedor" : "Comprador"}
                  </span>
                </td>
                <td className="px-4 py-3 text-xs text-ink-soft">
                  {l.intencion && <p>{LEAD_INTENT_LABELS[l.intencion]}</p>}
                  {l.propertySlug && <p className="text-muted">{l.propertySlug}</p>}
                  {l.tipoInmueble && <p>{l.tipoInmueble}{l.ciudad ? ` · ${l.ciudad}` : ""}</p>}
                  {l.preferencia && <p className="text-muted">{l.preferencia}</p>}
                  {l.mensaje && <p className="mt-1 max-w-xs italic text-muted">“{l.mensaje}”</p>}
                </td>
                <td className="px-4 py-3 text-xs text-muted">{formatDate(l.creadoEn)}</td>
                <td className="px-4 py-3"><LeadStatusForm id={l.id} estado={l.estado} /></td>
                <td className="px-4 py-3">
                  <div className="flex items-center justify-end gap-1">
                    <a
                      href={waLink(l.telefono)}
                      target="_blank"
                      rel="noopener noreferrer"
                      className="rounded-lg p-2 text-muted transition-colors hover:bg-emerald-50 hover:text-emerald-600"
                      aria-label="Contactar por WhatsApp"
                    >
                      <MessageCircle className="h-4 w-4" />
                    </a>
                    <form action={deleteLeadAction}>
                      <input type="hidden" name="id" value={l.id} />
                      <button className="rounded-lg p-2 text-muted transition-colors hover:bg-rose-50 hover:text-rose-600" aria-label="Eliminar">
                        <Trash2 className="h-4 w-4" />
                      </button>
                    </form>
                  </div>
                </td>
              </tr>
            ))}
            {leads.length === 0 && (
              <tr>
                <td colSpan={6} className="px-4 py-12 text-center text-muted">
                  Aún no hay leads. Llegarán desde los formularios del sitio.
                </td>
              </tr>
            )}
          </tbody>
        </table>
      </div>
    </div>
  );
}
