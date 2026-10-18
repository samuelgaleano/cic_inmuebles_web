import { MessageCircle, Search } from "lucide-react";
import Link from "next/link";
import { BotonEnviar } from "@/components/admin/boton-enviar";
import { crearContactoAction } from "@/lib/actions/admin-crm";
import { getCrmStore } from "@/lib/crm/store";
import {
  ESTADO_BUSQUEDA_LABELS,
  ESTADO_CAPTACION_LABELS,
  ESTATUS_PAGO_LABELS,
  MULTIMEDIA_LABELS,
  ORIGEN_LABELS,
  TIPO_COMPRADOR_LABELS,
  type Busqueda,
  type Captacion,
  type ContactoResumen,
} from "@/lib/crm/tipos";
import { getRepository } from "@/lib/data";
import { formatPrice } from "@/lib/utils/format";
import { enlaceWhatsApp } from "@/lib/utils/telefono";

export const dynamic = "force-dynamic";

type Vista = "contactos" | "vendedores" | "compradores";
const VISTAS: { id: Vista; label: string }[] = [
  { id: "contactos", label: "Contactos" },
  { id: "vendedores", label: "Vendedores" },
  { id: "compradores", label: "Compradores" },
];

const campo =
  "h-10 w-full rounded-xl border border-line bg-surface px-3 text-sm text-ink transition-colors focus:border-brand-500 focus:bg-white focus:outline-none focus:ring-2 focus:ring-brand-200";
const chip = "rounded-full bg-ink/[0.07] px-2.5 py-0.5 text-xs font-semibold text-ink-soft";

function fecha(iso?: string): string {
  if (!iso) return "—";
  return new Date(iso).toLocaleString("es-CO", { timeZone: "America/Bogota", day: "2-digit", month: "short", year: "numeric" });
}

function Persona({ c }: { c: Pick<ContactoResumen, "id" | "nombre" | "telefono" | "email"> | undefined }) {
  if (!c) return <span className="text-muted">(contacto no encontrado)</span>;
  return (
    <>
      <Link href={`/admin/crm/contactos/${c.id}`} className="font-medium text-ink underline-offset-2 hover:underline">
        {c.nombre}
      </Link>
      {c.telefono && <p className="text-xs text-muted">{c.telefono}</p>}
    </>
  );
}

export default async function AdminCrmPage({ searchParams }: { searchParams: Promise<{ vista?: string; q?: string; error?: string }> }) {
  const sp = await searchParams;
  const vista: Vista = VISTAS.some((v) => v.id === sp.vista) ? (sp.vista as Vista) : "contactos";
  const q = (sp.q ?? "").slice(0, 80);

  const crm = getCrmStore();
  if (!(await crm.disponible())) {
    return (
      <div className="space-y-4">
        <h1 className="text-2xl font-bold tracking-tight text-ink">CRM</h1>
        <p role="status" className="rounded-2xl border border-line bg-surface p-4 text-sm text-ink-soft">
          Falta crear las tablas del CRM. Ejecuta el archivo <code className="rounded bg-white px-1.5 py-0.5">supabase/migrations/0007_crm.sql</code> en el SQL Editor de Supabase.
        </p>
      </div>
    );
  }

  const [contactos, captaciones, busquedas, propiedades] = await Promise.all([
    crm.listarContactos({ q: vista === "contactos" ? q : undefined }),
    crm.listarCaptaciones(),
    crm.listarBusquedas(),
    getRepository().properties.list(),
  ]);
  // Los contactos de la pestaña pueden venir filtrados por la búsqueda: para nombrar a vendedores y compradores se leen todos.
  const todos = q && vista === "contactos" ? await crm.listarContactos({ incluirArchivados: true }) : contactos;
  const porId = new Map(todos.map((c) => [c.id, c]));
  const inmueble = new Map(propiedades.map((p) => [p.id, p]));
  const propuestas = await crm.listarPropuestas(busquedas.map((b) => b.id));
  const nPropuestas = new Map<string, number>();
  for (const p of propuestas) nPropuestas.set(p.busquedaId, (nPropuestas.get(p.busquedaId) ?? 0) + 1);

  const vigentes = (c: Captacion) => c.estado !== "descartada" && c.estado !== "vendida";
  const activas = (b: Busqueda) => b.estado === "activa" || b.estado === "en_visitas";

  return (
    <div className="space-y-6">
      <div className="flex flex-wrap items-end justify-between gap-4">
        <div>
          <h1 className="text-2xl font-bold tracking-tight text-ink">CRM</h1>
          <p className="mt-0.5 text-sm text-muted">Vendedores, compradores e inmuebles conectados. Solo el equipo ve esta sección.</p>
        </div>
        <dl className="flex gap-2 text-xs">
          <div className={chip}>
            <dt className="inline">Contactos </dt>
            <dd className="inline font-bold text-ink">{todos.filter((c) => !c.archivado).length}</dd>
          </div>
          <div className={chip}>
            <dt className="inline">Vendedores vigentes </dt>
            <dd className="inline font-bold text-ink">{captaciones.filter(vigentes).length}</dd>
          </div>
          <div className={chip}>
            <dt className="inline">Compradores activos </dt>
            <dd className="inline font-bold text-ink">{busquedas.filter(activas).length}</dd>
          </div>
        </dl>
      </div>

      {sp.error && (
        <p role="alert" className="rounded-xl border border-rose-200 bg-rose-50 px-4 py-3 text-sm text-rose-700">
          {sp.error}
        </p>
      )}

      <nav aria-label="Secciones del CRM" className="flex gap-1 border-b border-line">
        {VISTAS.map((v) => (
          <Link
            key={v.id}
            href={`/admin/crm?vista=${v.id}`}
            aria-current={vista === v.id ? "page" : undefined}
            className={`-mb-px border-b-2 px-4 py-2 text-sm font-semibold transition-colors ${vista === v.id ? "border-brand-600 text-brand-800" : "border-transparent text-muted hover:text-ink"}`}
          >
            {v.label}
          </Link>
        ))}
      </nav>

      {vista === "contactos" && (
        <>
          <div className="flex flex-wrap items-start gap-3">
            <form action="/admin/crm" className="relative min-w-60 flex-1">
              <input type="hidden" name="vista" value="contactos" />
              <Search className="pointer-events-none absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-muted" aria-hidden />
              <input name="q" defaultValue={q} placeholder="Buscar por nombre, teléfono, correo o ciudad" aria-label="Buscar contactos" className={`${campo} pl-10`} />
            </form>
            <details className="group w-full rounded-2xl border border-line bg-white sm:w-auto sm:min-w-[22rem]">
              <summary className="cursor-pointer list-none rounded-2xl px-4 py-2.5 text-sm font-semibold text-brand-800 hover:bg-brand-50">+ Nuevo contacto</summary>
              <form action={crearContactoAction} className="space-y-3 border-t border-line p-4">
                <label className="block text-xs font-semibold text-ink-soft">
                  Nombre
                  <input name="nombre" required minLength={2} maxLength={120} className={`${campo} mt-1`} />
                </label>
                <div className="grid gap-3 sm:grid-cols-2">
                  <label className="block text-xs font-semibold text-ink-soft">
                    Teléfono
                    <input name="telefono" inputMode="tel" placeholder="300 123 4567" className={`${campo} mt-1`} />
                  </label>
                  <label className="block text-xs font-semibold text-ink-soft">
                    Ciudad
                    <input name="ciudad" maxLength={80} className={`${campo} mt-1`} />
                  </label>
                </div>
                <label className="block text-xs font-semibold text-ink-soft">
                  Correo
                  <input name="email" type="email" className={`${campo} mt-1`} />
                </label>
                <label className="block text-xs font-semibold text-ink-soft">
                  Notas
                  <textarea name="notas" rows={2} maxLength={2000} className={`${campo} mt-1 h-auto py-2`} />
                </label>
                <BotonEnviar className="rounded-xl bg-brand-700 px-4 py-2 text-sm font-semibold text-white hover:bg-brand-800">Crear contacto</BotonEnviar>
              </form>
            </details>
          </div>

          <div className="overflow-x-auto rounded-2xl border border-line bg-white">
            <table className="w-full text-left text-sm">
              <thead className="border-b border-line bg-surface text-xs uppercase tracking-wider text-muted">
                <tr>
                  <th className="px-4 py-3 font-semibold">Contacto</th>
                  <th className="px-4 py-3 font-semibold">Ciudad</th>
                  <th className="px-4 py-3 font-semibold">Relación</th>
                  <th className="px-4 py-3 font-semibold">Origen</th>
                  <th className="px-4 py-3 font-semibold">Última actividad</th>
                  <th className="px-4 py-3 text-right font-semibold">WhatsApp</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-line">
                {contactos.map((c) => {
                  const wa = c.telefono ? enlaceWhatsApp(c.telefono) : undefined;
                  return (
                    <tr key={c.id} className="align-top transition-colors hover:bg-surface">
                      <td className="px-4 py-3">
                        <Persona c={c} />
                        {c.email && <p className="text-xs text-muted">{c.email}</p>}
                      </td>
                      <td className="px-4 py-3 text-xs text-ink-soft">{c.ciudad ?? "—"}</td>
                      <td className="px-4 py-3">
                        <div className="flex flex-wrap gap-1">
                          {c.captaciones > 0 && <span className="rounded-full bg-accent-500/15 px-2.5 py-0.5 text-xs font-semibold text-accent-600">Vendedor · {c.captaciones}</span>}
                          {c.busquedas > 0 && <span className="rounded-full bg-brand-50 px-2.5 py-0.5 text-xs font-semibold text-brand-700">Comprador · {c.busquedas}</span>}
                          {c.captaciones === 0 && c.busquedas === 0 && <span className="text-xs text-muted">Sin relación todavía</span>}
                        </div>
                      </td>
                      <td className="px-4 py-3 text-xs text-ink-soft">{ORIGEN_LABELS[c.origen]}</td>
                      <td className="px-4 py-3 text-xs text-muted">{fecha(c.ultimaActividad)}</td>
                      <td className="px-4 py-3 text-right">
                        {wa && (
                          <a href={wa} target="_blank" rel="noopener noreferrer" aria-label={`Escribir a ${c.nombre} por WhatsApp`} className="inline-flex rounded-lg p-2 text-muted transition-colors hover:bg-emerald-50 hover:text-emerald-600">
                            <MessageCircle className="h-4 w-4" />
                          </a>
                        )}
                      </td>
                    </tr>
                  );
                })}
                {contactos.length === 0 && (
                  <tr>
                    <td colSpan={6} className="px-4 py-12 text-center text-muted">
                      {q ? "Ningún contacto coincide con la búsqueda." : "Aún no hay contactos. Crea uno o pasa un lead al CRM desde la pestaña Leads."}
                    </td>
                  </tr>
                )}
              </tbody>
            </table>
          </div>
        </>
      )}

      {vista === "vendedores" && (
        <div className="overflow-x-auto rounded-2xl border border-line bg-white">
          <table className="w-full text-left text-sm">
            <thead className="border-b border-line bg-surface text-xs uppercase tracking-wider text-muted">
              <tr>
                <th className="px-4 py-3 font-semibold">Vendedor</th>
                <th className="px-4 py-3 font-semibold">Inmueble</th>
                <th className="px-4 py-3 text-right font-semibold">Precio</th>
                <th className="px-4 py-3 text-right font-semibold">Comisión</th>
                <th className="px-4 py-3 font-semibold">Pago</th>
                <th className="px-4 py-3 font-semibold">Aprobada</th>
                <th className="px-4 py-3 font-semibold">Fotos y video</th>
                <th className="px-4 py-3 font-semibold">Estado</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-line">
              {captaciones.map((c) => {
                const p = c.propertyId ? inmueble.get(c.propertyId) : undefined;
                return (
                  <tr key={c.id} className="align-top transition-colors hover:bg-surface">
                    <td className="px-4 py-3">
                      <Persona c={porId.get(c.contactoId)} />
                    </td>
                    <td className="px-4 py-3 text-xs text-ink-soft">
                      {p ? (
                        <Link href={`/admin/inmuebles/${p.id}`} className="font-medium text-brand-700 underline underline-offset-2">
                          {p.codigo} · {p.titulo}
                        </Link>
                      ) : (
                        <span className="text-muted">Sin ficha</span>
                      )}
                      {c.ubicacion && <p className="text-muted">{c.ubicacion}</p>}
                    </td>
                    <td className="px-4 py-3 text-right text-xs text-ink-soft">{c.precioEsperado !== undefined ? formatPrice(c.precioEsperado) : "—"}</td>
                    <td className="px-4 py-3 text-right text-xs text-ink-soft">
                      {c.comisionValor !== undefined ? formatPrice(c.comisionValor) : "—"}
                      <p className="text-muted">{c.comisionPct} %</p>
                    </td>
                    <td className="px-4 py-3 text-xs text-ink-soft">{ESTATUS_PAGO_LABELS[c.estatusPago]}</td>
                    <td className="px-4 py-3 text-xs text-ink-soft">{c.aprobada ? "Sí" : "No"}</td>
                    <td className="px-4 py-3 text-xs text-ink-soft">{MULTIMEDIA_LABELS[c.multimedia]}</td>
                    <td className="px-4 py-3">
                      <span className={chip}>{ESTADO_CAPTACION_LABELS[c.estado]}</span>
                    </td>
                  </tr>
                );
              })}
              {captaciones.length === 0 && (
                <tr>
                  <td colSpan={8} className="px-4 py-12 text-center text-muted">
                    Aún no hay vendedores. Se crean desde la ficha de un contacto.
                  </td>
                </tr>
              )}
            </tbody>
          </table>
        </div>
      )}

      {vista === "compradores" && (
        <div className="overflow-x-auto rounded-2xl border border-line bg-white">
          <table className="w-full text-left text-sm">
            <thead className="border-b border-line bg-surface text-xs uppercase tracking-wider text-muted">
              <tr>
                <th className="px-4 py-3 font-semibold">Comprador</th>
                <th className="px-4 py-3 font-semibold">Tipo</th>
                <th className="px-4 py-3 font-semibold">Busca</th>
                <th className="px-4 py-3 text-right font-semibold">Presupuesto</th>
                <th className="px-4 py-3 font-semibold">Potencial</th>
                <th className="px-4 py-3 text-right font-semibold">Propuestos</th>
                <th className="px-4 py-3 font-semibold">Estado</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-line">
              {busquedas.map((b) => (
                <tr key={b.id} className="align-top transition-colors hover:bg-surface">
                  <td className="px-4 py-3">
                    <Persona c={porId.get(b.contactoId)} />
                  </td>
                  <td className="px-4 py-3 text-xs text-ink-soft">{TIPO_COMPRADOR_LABELS[b.tipo]}</td>
                  <td className="px-4 py-3 text-xs text-ink-soft">
                    {b.ubicacion ?? "—"}
                    {b.especificacion && <p className="max-w-xs text-muted">{b.especificacion}</p>}
                  </td>
                  <td className="px-4 py-3 text-right text-xs text-ink-soft">{b.precioMax !== undefined ? formatPrice(b.precioMax) : "—"}</td>
                  <td className="px-4 py-3 text-xs text-ink-soft">{b.potencial ? "Sí" : "No"}</td>
                  <td className="px-4 py-3 text-right text-xs text-ink-soft">{nPropuestas.get(b.id) ?? 0}</td>
                  <td className="px-4 py-3">
                    <span className={chip}>{ESTADO_BUSQUEDA_LABELS[b.estado]}</span>
                  </td>
                </tr>
              ))}
              {busquedas.length === 0 && (
                <tr>
                  <td colSpan={7} className="px-4 py-12 text-center text-muted">
                    Aún no hay compradores. Se crean desde la ficha de un contacto.
                  </td>
                </tr>
              )}
            </tbody>
          </table>
        </div>
      )}
    </div>
  );
}
