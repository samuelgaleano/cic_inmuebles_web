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
        <h1 className="text-2xl font-bold text-slate-900">Leads</h1>
        <p className="text-slate-500">{leads.length} cliente{leads.length === 1 ? "" : "s"} potencial{leads.length === 1 ? "" : "es"}</p>
      </div>

      <div className="overflow-x-auto rounded-xl border border-slate-200 bg-white">
        <table className="w-full text-left text-sm">
          <thead className="border-b border-slate-200 bg-slate-50 text-xs uppercase text-slate-500">
            <tr>
              <th className="px-4 py-3">Cliente</th>
              <th className="px-4 py-3">Tipo</th>
              <th className="px-4 py-3">Contexto</th>
              <th className="px-4 py-3">Fecha</th>
              <th className="px-4 py-3">Estado</th>
              <th className="px-4 py-3 text-right">Acciones</th>
            </tr>
          </thead>
          <tbody className="divide-y divide-slate-100">
            {leads.map((l) => (
              <tr key={l.id} className="align-top hover:bg-slate-50">
                <td className="px-4 py-3">
                  <p className="font-medium text-slate-800">{l.nombre}</p>
                  <p className="text-xs text-slate-500">{l.telefono}</p>
                  {l.email && <p className="text-xs text-slate-400">{l.email}</p>}
                </td>
                <td className="px-4 py-3">
                  <span className={`rounded-full px-2 py-0.5 text-xs font-medium ${l.tipo === "vendedor" ? "bg-amber-100 text-amber-800" : "bg-brand-50 text-brand-700"}`}>
                    {l.tipo === "vendedor" ? "Vendedor" : "Comprador"}
                  </span>
                </td>
                <td className="px-4 py-3 text-xs text-slate-600">
                  {l.intencion && <p>{LEAD_INTENT_LABELS[l.intencion]}</p>}
                  {l.propertySlug && <p className="text-slate-400">{l.propertySlug}</p>}
                  {l.tipoInmueble && <p>{l.tipoInmueble}{l.ciudad ? ` · ${l.ciudad}` : ""}</p>}
                  {l.preferencia && <p className="text-slate-400">{l.preferencia}</p>}
                  {l.mensaje && <p className="mt-1 max-w-xs italic text-slate-500">“{l.mensaje}”</p>}
                </td>
                <td className="px-4 py-3 text-xs text-slate-500">{formatDate(l.creadoEn)}</td>
                <td className="px-4 py-3"><LeadStatusForm id={l.id} estado={l.estado} /></td>
                <td className="px-4 py-3">
                  <div className="flex items-center justify-end gap-1">
                    <a
                      href={waLink(l.telefono)}
                      target="_blank"
                      rel="noopener noreferrer"
                      className="rounded-md p-2 text-slate-400 hover:bg-emerald-50 hover:text-emerald-600"
                      aria-label="Contactar por WhatsApp"
                    >
                      <MessageCircle className="h-4 w-4" />
                    </a>
                    <form action={deleteLeadAction}>
                      <input type="hidden" name="id" value={l.id} />
                      <button className="rounded-md p-2 text-slate-400 hover:bg-rose-50 hover:text-rose-600" aria-label="Eliminar">
                        <Trash2 className="h-4 w-4" />
                      </button>
                    </form>
                  </div>
                </td>
              </tr>
            ))}
            {leads.length === 0 && (
              <tr>
                <td colSpan={6} className="px-4 py-10 text-center text-slate-400">
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
