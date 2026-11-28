import { Clock, Phone, Trash2 } from "lucide-react";
import Link from "next/link";
import { getRepository } from "@/lib/data";
import { deleteLeadAction } from "@/lib/actions/admin-leads";
import { pasarLeadAlCrmAction } from "@/lib/actions/admin-crm";
import { BotonEnviar } from "@/components/admin/boton-enviar";
import { EnlaceContacto } from "@/components/admin/enlace-contacto";
import { LeadStatusForm } from "@/components/admin/lead-status-form";
import { MenuWhatsApp } from "@/components/admin/menu-whatsapp";
import { Paginacion, leerPagina } from "@/components/admin/paginacion";
import { esperaSinContactar, type NivelEspera } from "@/lib/crm/reportes";
import { opcionesWhatsApp, type InmuebleMensaje } from "@/lib/crm/plantillas-whatsapp";
import { POR_PAGINA } from "@/lib/crm/tipos";
import { LEAD_INTENT_LABELS, LEAD_STATUSES, LEAD_STATUS_LABELS, type Lead, type LeadStatus, type Property } from "@/lib/domain";
import { enlaceWhatsApp, normalizarTelefono } from "@/lib/utils/telefono";

export const dynamic = "force-dynamic";

function formatDate(iso: string): string {
  return new Date(iso).toLocaleString("es-CO", {
    timeZone: "America/Bogota",
    day: "2-digit",
    month: "short",
    hour: "2-digit",
    minute: "2-digit",
  });
}

const COLOR_ESPERA: Record<NivelEspera, string> = {
  reciente: "bg-brand-50 text-brand-800",
  atrasado: "bg-accent-500/15 text-accent-600",
  urgente: "bg-rose-50 text-rose-700",
};

function Espera({ lead, ahora }: { lead: Lead; ahora: Date }) {
  const e = esperaSinContactar(lead, ahora);
  if (!e) return null;
  return (
    <span className={`inline-flex items-center gap-1 rounded-full px-2 py-0.5 text-[11px] font-bold ${COLOR_ESPERA[e.nivel]}`}>
      <Clock className="h-3 w-3" aria-hidden /> {e.texto}
    </span>
  );
}

/** Los mensajes de WhatsApp que tienen sentido para este lead. */
function opcionesDe(l: Lead, inmueble: Map<string, Property>) {
  const p = (l.propertyId && inmueble.get(l.propertyId)) || (l.propertySlug ? [...inmueble.values()].find((x) => x.slug === l.propertySlug) : undefined);
  const interes: InmuebleMensaje | undefined = p ? { titulo: p.titulo, slug: p.slug, precio: p.precio, sector: p.ubicacion.sector } : undefined;
  return opcionesWhatsApp({
    nombre: l.nombre,
    telefono: l.telefono,
    esComprador: l.tipo === "comprador",
    esVendedor: l.tipo === "vendedor",
    interes,
    queVende: l.tipoInmueble ? `tu ${l.tipoInmueble.toLowerCase()}${l.ciudad ? ` en ${l.ciudad}` : ""}` : undefined,
  }).filter((o) => o.id === "primer_comprador" || o.id === "primer_propietario");
}

function Acciones({ l, inmueble, grande = false }: { l: Lead; inmueble: Map<string, Property>; grande?: boolean }) {
  const tel = normalizarTelefono(l.telefono);
  const wa = enlaceWhatsApp(l.telefono);
  const icono = grande
    ? "inline-flex h-11 w-11 items-center justify-center rounded-xl border border-line bg-white text-ink-soft transition-colors hover:border-ink hover:text-ink"
    : "inline-flex h-9 w-9 items-center justify-center rounded-lg text-muted transition-colors hover:bg-emerald-50 hover:text-emerald-600";
  return (
    <div className={`flex flex-wrap items-center gap-2 ${grande ? "" : "justify-end"}`}>
      <MenuWhatsApp opciones={opcionesDe(l, inmueble)} leadId={l.id} enlaceSimple={wa} />
      {tel?.e164 && (
        <EnlaceContacto href={`tel:${tel.e164}`} leadId={l.id} nuevaPestana={false} aria-label={`Llamar a ${l.nombre}`} className={icono}>
          <Phone className="h-4 w-4" aria-hidden />
        </EnlaceContacto>
      )}
      <form action={pasarLeadAlCrmAction}>
        <input type="hidden" name="leadId" value={l.id} />
        <BotonEnviar className={`rounded-xl border border-line bg-white px-3 text-xs font-semibold text-ink-soft transition-colors hover:border-ink hover:text-ink ${grande ? "min-h-11" : "min-h-9"}`}>Al CRM</BotonEnviar>
      </form>
      <form action={deleteLeadAction}>
        <input type="hidden" name="id" value={l.id} />
        <button className={`${grande ? "h-11 w-11" : "h-9 w-9"} inline-flex items-center justify-center rounded-lg text-muted transition-colors hover:bg-rose-50 hover:text-rose-600`} aria-label={`Eliminar el lead de ${l.nombre}`}>
          <Trash2 className="h-4 w-4" />
        </button>
      </form>
    </div>
  );
}

function Contexto({ l }: { l: Lead }) {
  return (
    <>
      {l.intencion && <p>{LEAD_INTENT_LABELS[l.intencion]}</p>}
      {l.propertySlug && <p className="text-muted">{l.propertySlug}</p>}
      {l.tipoInmueble && (
        <p>
          {l.tipoInmueble}
          {l.ciudad ? ` · ${l.ciudad}` : ""}
        </p>
      )}
      {l.preferencia && <p className="text-muted">{l.preferencia}</p>}
      {l.mensaje && <p className="mt-1 max-w-xs italic text-muted">“{l.mensaje}”</p>}
    </>
  );
}

export default async function AdminLeadsPage({ searchParams }: { searchParams: Promise<{ pagina?: string; estado?: string }> }) {
  const sp = await searchParams;
  const pagina = leerPagina(sp.pagina);
  const estado = LEAD_STATUSES.includes(sp.estado as LeadStatus) ? (sp.estado as LeadStatus) : undefined;
  const repo = getRepository();
  const [{ leads, total }, propiedades] = await Promise.all([repo.leads.listPage({ pagina, porPagina: POR_PAGINA, estado }), repo.properties.list()]);
  const inmueble = new Map(propiedades.map((p) => [p.id, p]));
  const ahora = new Date();
  const href = (p: number) => `/admin/leads?${new URLSearchParams({ ...(estado ? { estado } : {}), ...(p > 1 ? { pagina: String(p) } : {}) }).toString()}`;
  const filtro = (e?: LeadStatus) =>
    `inline-flex min-h-11 shrink-0 items-center whitespace-nowrap rounded-full px-3.5 text-xs font-semibold transition-colors sm:min-h-9 ${estado === e ? "bg-brand-700 text-white" : "border border-line bg-white text-ink-soft hover:border-ink"}`;

  return (
    <div className="space-y-5">
      <div>
        <h1 className="text-2xl font-bold tracking-tight text-ink">Leads</h1>
        <p className="mt-0.5 text-sm text-muted">
          {total} cliente{total === 1 ? "" : "s"} potencial{total === 1 ? "" : "es"}
          {estado ? ` en «${LEAD_STATUS_LABELS[estado]}»` : ""}. Al escribirle o llamarle desde aquí queda la hora de la primera respuesta.
        </p>
      </div>

      <nav aria-label="Filtrar por estado" className="-mx-1 flex gap-1.5 overflow-x-auto px-1 pb-1">
        <Link href="/admin/leads" className={filtro(undefined)} aria-current={!estado ? "page" : undefined}>
          Todos
        </Link>
        {LEAD_STATUSES.map((s) => (
          <Link key={s} href={`/admin/leads?estado=${s}`} className={filtro(s)} aria-current={estado === s ? "page" : undefined}>
            {LEAD_STATUS_LABELS[s]}
          </Link>
        ))}
      </nav>

      {/* Celular: tarjetas con botones grandes */}
      <ul className="space-y-3 md:hidden" aria-label="Leads">
        {leads.map((l) => (
          <li key={l.id} className="rounded-2xl border border-line bg-white p-4">
            <div className="flex items-start justify-between gap-3">
              <div className="min-w-0">
                <p className="font-semibold text-ink">{l.nombre}</p>
                <p className="text-xs text-muted">
                  {l.telefono}
                  {l.email ? ` · ${l.email}` : ""}
                </p>
              </div>
              <span className={`shrink-0 rounded-full px-2.5 py-0.5 text-xs font-semibold ${l.tipo === "vendedor" ? "bg-accent-500/15 text-accent-600" : "bg-brand-50 text-brand-700"}`}>
                {l.tipo === "vendedor" ? "Vendedor" : "Comprador"}
              </span>
            </div>
            <div className="mt-2 flex flex-wrap items-center gap-2 text-xs text-muted">
              <span>{formatDate(l.creadoEn)}</span>
              <Espera lead={l} ahora={ahora} />
            </div>
            <div className="mt-2 text-xs text-ink-soft">
              <Contexto l={l} />
            </div>
            <div className="mt-3 flex flex-wrap items-center gap-2">
              <LeadStatusForm id={l.id} estado={l.estado} />
            </div>
            <div className="mt-3">
              <Acciones l={l} inmueble={inmueble} grande />
            </div>
          </li>
        ))}
        {leads.length === 0 && <li className="rounded-2xl border border-line bg-white px-4 py-12 text-center text-sm text-muted">{estado ? "No hay leads en este estado." : "Aún no hay leads. Llegarán desde los formularios del sitio."}</li>}
      </ul>

      {/* Escritorio: tabla */}
      <div className="hidden overflow-x-auto rounded-2xl border border-line bg-white md:block">
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
                  <Contexto l={l} />
                </td>
                <td className="px-4 py-3 text-xs text-muted">
                  <p>{formatDate(l.creadoEn)}</p>
                  <div className="mt-1">
                    <Espera lead={l} ahora={ahora} />
                  </div>
                </td>
                <td className="px-4 py-3">
                  <LeadStatusForm id={l.id} estado={l.estado} />
                </td>
                <td className="px-4 py-3">
                  <Acciones l={l} inmueble={inmueble} />
                </td>
              </tr>
            ))}
            {leads.length === 0 && (
              <tr>
                <td colSpan={6} className="px-4 py-12 text-center text-muted">
                  {estado ? "No hay leads en este estado." : "Aún no hay leads. Llegarán desde los formularios del sitio."}
                </td>
              </tr>
            )}
          </tbody>
        </table>
      </div>

      <Paginacion pagina={pagina} porPagina={POR_PAGINA} total={total} href={href} />
    </div>
  );
}
