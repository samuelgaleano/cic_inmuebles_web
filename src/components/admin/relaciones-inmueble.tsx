import Link from "next/link";
import { getCrmStore } from "@/lib/crm/store";
import { ESTADO_CAPTACION_LABELS, ESTADO_PROPUESTA_LABELS, ESTATUS_PAGO_LABELS, type PropuestaDeInmueble } from "@/lib/crm/tipos";
import { getPlan } from "@/lib/config/plans";
import type { Property } from "@/lib/domain";
import { getRepository } from "@/lib/data";
import { getServiciosStore } from "@/lib/servicios/store";
import { ETIQUETA_ESTADO, fechaLarga } from "@/lib/servicios/vigencia";
import { formatPrice } from "@/lib/utils/format";

const lista = "divide-y divide-line text-sm";

/**
 * Todo lo que el resto de la plataforma sabe de este inmueble: quién lo vende y a qué precio, a quién se le
 * propuso, qué plan de publicación lo cubre y qué leads preguntaron por él. Si el CRM o las vigencias no
 * tienen sus tablas, esa parte se omite sin romper la ficha.
 */
export async function RelacionesInmueble({ property }: { property: Property }) {
  const crm = getCrmStore();
  // Consultas por el inmueble (property_id / slug): ni las búsquedas de todos ni la tabla de leads completa.
  const [vigente, propuestas, susLeads] = await Promise.all([
    crm.captacionVigenteDe(property.id).catch(() => null),
    crm.propuestasDeInmuebles([property.id]).catch((): PropuestaDeInmueble[] => []),
    getRepository().leads.listarDeInmueble(property.id, property.slug).catch(() => []),
  ]);
  const suyas = vigente ? [vigente] : [];
  const vendedores = new Map((await crm.contactosPorId(suyas.map((c) => c.contactoId)).catch(() => [])).map((c) => [c.id, c]));
  const persona = new Map([...vendedores, ...propuestas.map((p) => [p.contacto.id, p.contacto] as const)]);
  const servicios = (await getServiciosStore().listar().catch(() => [])).filter((s) => s.propertySlug === property.slug && s.estado !== "descartado");

  const nada = !suyas.length && !propuestas.length && !servicios.length && !susLeads.length;
  const nombre = (id: string) => {
    const c = persona.get(id);
    return c ? (
      <Link href={`/admin/crm/contactos/${c.id}`} className="font-medium text-brand-700 underline underline-offset-2">
        {c.nombre}
      </Link>
    ) : (
      <span className="text-muted">(contacto no encontrado)</span>
    );
  };

  return (
    <section className="rounded-2xl border border-line bg-white p-6" aria-labelledby="relaciones">
      <h2 id="relaciones" className="mb-1 font-semibold text-ink">
        Conexiones de este inmueble
      </h2>
      <p className="mb-4 text-xs text-muted">Lo que el CRM, los planes y los leads tienen sobre esta propiedad.</p>
      {nada && <p className="text-sm text-muted">Todavía no hay vendedor, compradores, planes ni leads enlazados.</p>}

      {suyas.length > 0 && (
        <div className="mb-4">
          <h3 className="mb-1 text-xs font-bold uppercase tracking-wider text-muted">Vendedor</h3>
          <ul className={lista}>
            {suyas.map((c) => (
              <li key={c.id} className="flex flex-wrap items-center justify-between gap-2 py-2">
                <span>{nombre(c.contactoId)}</span>
                <span className="text-xs text-ink-soft">
                  {c.precioEsperado !== undefined ? formatPrice(c.precioEsperado) : "sin precio"}
                  {c.comisionValor !== undefined ? ` · comisión ${formatPrice(c.comisionValor)} (${c.comisionPct} %)` : ""} · {ESTATUS_PAGO_LABELS[c.estatusPago]} · {ESTADO_CAPTACION_LABELS[c.estado]}
                </span>
              </li>
            ))}
          </ul>
        </div>
      )}

      {propuestas.length > 0 && (
        <div className="mb-4">
          <h3 className="mb-1 text-xs font-bold uppercase tracking-wider text-muted">Compradores a los que se propuso</h3>
          <ul className={lista}>
            {propuestas.map((p) => {
              return (
                <li key={p.busquedaId} className="flex flex-wrap items-center justify-between gap-2 py-2">
                  <span>{nombre(p.contacto.id)}</span>
                  <span className="text-xs text-ink-soft">{ESTADO_PROPUESTA_LABELS[p.estado]}</span>
                </li>
              );
            })}
          </ul>
        </div>
      )}

      {servicios.length > 0 && (
        <div className="mb-4">
          <h3 className="mb-1 text-xs font-bold uppercase tracking-wider text-muted">Plan de publicación</h3>
          <ul className={lista}>
            {servicios.map((s) => (
              <li key={s.id} className="flex flex-wrap items-center justify-between gap-2 py-2">
                <span>{getPlan(s.planId)?.nombre ?? s.planId}</span>
                <span className="text-xs text-ink-soft">
                  {ETIQUETA_ESTADO[s.estado]}
                  {s.venceAt ? ` · vence ${fechaLarga(s.venceAt)}` : ""}
                </span>
              </li>
            ))}
          </ul>
          <Link href="/admin/vigencias" className="mt-1 inline-block text-xs font-semibold text-brand-700 underline underline-offset-2">
            Ir a Vigencias
          </Link>
        </div>
      )}

      {susLeads.length > 0 && (
        <div>
          <h3 className="mb-1 text-xs font-bold uppercase tracking-wider text-muted">Leads que preguntaron por él</h3>
          <ul className={lista}>
            {susLeads.map((l) => (
              <li key={l.id} className="py-2 text-xs text-ink-soft">
                <span className="font-medium text-ink">{l.nombre}</span> · {l.telefono}
                {l.mensaje && <span className="italic text-muted"> · “{l.mensaje.slice(0, 80)}”</span>}
              </li>
            ))}
          </ul>
          <Link href="/admin/leads" className="mt-1 inline-block text-xs font-semibold text-brand-700 underline underline-offset-2">
            Ir a Leads
          </Link>
        </div>
      )}
    </section>
  );
}
