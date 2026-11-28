import { MessageCircle, Search } from "lucide-react";
import Link from "next/link";
import { BotonEnviar } from "@/components/admin/boton-enviar";
import { BotonesContacto } from "@/components/admin/botones-contacto";
import { EnlaceContacto } from "@/components/admin/enlace-contacto";
import { Paginacion, leerPagina } from "@/components/admin/paginacion";
import { crearContactoAction, sincronizarCrmAction } from "@/lib/actions/admin-crm";
import { clasificarSeguimiento, diasDeAtraso, finDelDiaBogota } from "@/lib/crm/reglas";
import { getCrmStore } from "@/lib/crm/store";
import {
  ESTADO_BUSQUEDA_LABELS,
  ESTADO_CAPTACION_LABELS,
  ESTATUS_PAGO_LABELS,
  FILTROS_TIPO_CONTACTO,
  MULTIMEDIA_LABELS,
  ORIGENES,
  ORIGEN_LABELS,
  POR_PAGINA,
  TIPO_COMPRADOR_LABELS,
  type ContactoBreve,
  type FiltroTipoContacto,
  type GrupoPendiente,
  type Origen,
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
  "h-11 w-full rounded-xl border border-line bg-surface px-3 text-sm text-ink transition-colors focus:border-brand-500 focus:bg-white focus:outline-none focus:ring-2 focus:ring-brand-200 sm:h-10";
const chip = "rounded-full bg-ink/[0.07] px-2.5 py-0.5 text-xs font-semibold text-ink-soft";

function fecha(iso?: string): string {
  if (!iso) return "—";
  return new Date(iso).toLocaleString("es-CO", { timeZone: "America/Bogota", day: "2-digit", month: "short", year: "numeric" });
}

function Persona({ c }: { c: Pick<ContactoBreve, "id" | "nombre" | "telefono"> | undefined }) {
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

type Params = { vista?: string; q?: string; tipo?: string; origen?: string; sinProximo?: string; pagina?: string; error?: string; listo?: string };

export default async function AdminCrmPage({ searchParams }: { searchParams: Promise<Params> }) {
  const sp = await searchParams;
  const vista: Vista = VISTAS.some((v) => v.id === sp.vista) ? (sp.vista as Vista) : "contactos";
  const q = (sp.q ?? "").slice(0, 80);
  const tipo = FILTROS_TIPO_CONTACTO.includes(sp.tipo as FiltroTipoContacto) ? (sp.tipo as FiltroTipoContacto) : undefined;
  const origen = ORIGENES.includes(sp.origen as Origen) ? (sp.origen as Origen) : undefined;
  const sinProximo = sp.sinProximo === "1";
  const pagina = leerPagina(sp.pagina);

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

  const ahora = new Date();
  // Cada parte lee solo lo suyo: «Por hacer» con totales y los primeros nombres, y la pestaña abierta de 50 en 50.
  const [pendientes, seguimientos, contactos, captaciones, busquedas, propiedades] = await Promise.all([
    crm.pendientes(3),
    crm.listarSeguimientos(finDelDiaBogota(ahora)),
    vista === "contactos" ? crm.paginaContactos({ q, tipo, origen, sinProximo, pagina, porPagina: POR_PAGINA }) : null,
    vista === "vendedores" ? crm.paginaCaptaciones({ pagina, porPagina: POR_PAGINA }) : null,
    vista === "compradores" ? crm.paginaBusquedas({ pagina, porPagina: POR_PAGINA }) : null,
    vista === "vendedores" ? getRepository().properties.list() : Promise.resolve([]),
  ]);
  const inmueble = new Map(propiedades.map((p) => [p.id, p]));

  const grupos: { titulo: string; g: GrupoPendiente }[] = [
    { titulo: "Vendedores por aprobar", g: pendientes.porAprobar },
    { titulo: "Pago del vendedor pendiente", g: pendientes.pagoPendiente },
    { titulo: "Fotos y video por coordinar", g: pendientes.multimedia },
    { titulo: "Compradores sin inmuebles propuestos", g: pendientes.sinPropuestas },
    { titulo: "Contactos sin seguimiento", g: pendientes.sinSeguimiento },
  ];
  const hayPendientes = seguimientos.length > 0 || grupos.some((x) => x.g.total > 0);
  const nVencidos = seguimientos.filter((c) => clasificarSeguimiento(c.proximoContactoAt!, ahora) === "vencido").length;
  const horaBogota = (iso: string) => new Date(iso).toLocaleTimeString("es-CO", { timeZone: "America/Bogota", hour: "numeric", minute: "2-digit" });

  /** URL de esta pestaña con sus filtros y la página p. */
  const href = (p: number) => {
    const u = new URLSearchParams({ vista });
    if (vista === "contactos") {
      if (q) u.set("q", q);
      if (tipo) u.set("tipo", tipo);
      if (origen) u.set("origen", origen);
      if (sinProximo) u.set("sinProximo", "1");
    }
    if (p > 1) u.set("pagina", String(p));
    return `/admin/crm?${u.toString()}`;
  };
  const hayFiltros = Boolean(q || tipo || origen || sinProximo);

  return (
    <div className="space-y-6">
      <div className="flex flex-wrap items-end justify-between gap-4">
        <div>
          <h1 className="text-2xl font-bold tracking-tight text-ink">CRM</h1>
          <p className="mt-0.5 text-sm text-muted">Vendedores, compradores e inmuebles conectados. Solo el equipo ve esta sección.</p>
        </div>
        <form action={sincronizarCrmAction}>
          <BotonEnviar className="min-h-11 rounded-xl border border-line bg-white px-3 py-2 text-xs font-semibold text-ink-soft transition-colors hover:border-ink hover:text-ink sm:min-h-0">Sincronizar con inmuebles, leads y planes</BotonEnviar>
        </form>
        <dl className="flex flex-wrap gap-2 text-xs">
          <div className={chip}>
            <dt className="inline">Contactos </dt>
            <dd className="inline font-bold text-ink">{pendientes.totales.contactos}</dd>
          </div>
          <div className={chip}>
            <dt className="inline">Vendedores vigentes </dt>
            <dd className="inline font-bold text-ink">{pendientes.totales.vendedores}</dd>
          </div>
          <div className={chip}>
            <dt className="inline">Compradores activos </dt>
            <dd className="inline font-bold text-ink">{pendientes.totales.compradores}</dd>
          </div>
        </dl>
      </div>

      {sp.listo && (
        <p role="status" className="rounded-xl border border-brand-200 bg-brand-50 px-4 py-3 text-sm text-brand-800">
          {sp.listo.slice(0, 600)}
        </p>
      )}

      {sp.error && (
        <p role="alert" className="rounded-xl border border-rose-200 bg-rose-50 px-4 py-3 text-sm text-rose-700">
          {sp.error}
        </p>
      )}

      <section aria-labelledby="pendientes" className="rounded-2xl border border-line bg-white p-4 sm:p-5">
        <h2 id="pendientes" className="mb-3 text-sm font-bold text-ink">Por hacer</h2>
        {hayPendientes && (
          <div className="mb-5 rounded-xl border border-line bg-surface p-3 sm:p-4">
            <p className="text-xs font-semibold text-ink-soft">
              Para hoy y vencidos{" "}
              <span className={`ml-1 rounded-full px-2 py-0.5 text-[11px] font-bold ${seguimientos.length ? "bg-accent-500/15 text-accent-600" : "bg-ink/[0.07] text-muted"}`}>{seguimientos.length}</span>
              {nVencidos > 0 && <span className="ml-1 rounded-full bg-rose-50 px-2 py-0.5 text-[11px] font-bold text-rose-700">{nVencidos} vencido{nVencidos === 1 ? "" : "s"}</span>}
            </p>
            <ul className="mt-2 grid gap-2 text-xs sm:grid-cols-2 sm:gap-x-6 sm:gap-y-1.5">
              {seguimientos.slice(0, 10).map((c) => {
                const atraso = diasDeAtraso(c.proximoContactoAt!, ahora);
                return (
                  <li key={c.id} className="flex min-w-0 items-center justify-between gap-3 rounded-xl border border-line bg-white p-3 sm:block sm:border-0 sm:bg-transparent sm:p-0">
                    <div className="min-w-0">
                      {atraso > 0 ? (
                        <span className="mr-1.5 rounded bg-rose-50 px-1.5 py-0.5 text-[11px] font-bold text-rose-700">Vencido {atraso === 1 ? "ayer" : `hace ${atraso} días`}</span>
                      ) : (
                        <span className="mr-1.5 text-muted">Hoy {horaBogota(c.proximoContactoAt!)}</span>
                      )}
                      <Link href={`/admin/crm/contactos/${c.id}`} className="font-medium text-brand-700 underline underline-offset-2">
                        {c.nombre}
                      </Link>
                      {c.proximoContactoNota && <span className="text-ink-soft"> · {c.proximoContactoNota}</span>}
                    </div>
                    <span className="sm:hidden">
                      <BotonesContacto telefono={c.telefono} nombre={c.nombre} contactoId={c.id} />
                    </span>
                  </li>
                );
              })}
              {seguimientos.length > 10 && <li className="text-muted">y {seguimientos.length - 10} más</li>}
              {seguimientos.length === 0 && <li className="text-muted">Nada agendado para hoy. Agenda el próximo contacto desde la ficha de cada persona.</li>}
            </ul>
          </div>
        )}
        {hayPendientes ? (
          <div className="grid gap-4 sm:grid-cols-2 xl:grid-cols-5">
            {grupos.map(({ titulo, g }) => (
              <div key={titulo} className="rounded-xl border border-line p-3 sm:border-0 sm:p-0">
                <p className="text-xs font-semibold text-ink-soft">
                  {titulo} <span className={`ml-1 rounded-full px-2 py-0.5 text-[11px] font-bold ${g.total ? "bg-accent-500/15 text-accent-600" : "bg-ink/[0.07] text-muted"}`}>{g.total}</span>
                </p>
                <ul className="mt-1.5 space-y-1 text-xs">
                  {g.items.map((i, n) => (
                    <li key={`${i.id}-${n}`} className="flex items-center justify-between gap-2">
                      <Link href={`/admin/crm/contactos/${i.id}`} className="inline-flex min-h-11 items-center text-brand-700 underline underline-offset-2 sm:min-h-0">
                        {i.nombre}
                      </Link>
                      <span className="sm:hidden">
                        <BotonesContacto telefono={i.telefono} nombre={i.nombre} contactoId={i.id} />
                      </span>
                    </li>
                  ))}
                  {g.total > g.items.length && <li className="text-muted">y {g.total - g.items.length} más</li>}
                  {g.total === 0 && <li className="text-muted">Al día</li>}
                </ul>
              </div>
            ))}
          </div>
        ) : (
          <p className="text-sm text-muted">Todo al día. Cuando entren leads, pagos o inmuebles con propietario, aparecen aquí lo que falta por hacer.</p>
        )}
      </section>

      <nav aria-label="Secciones del CRM" className="flex gap-1 overflow-x-auto border-b border-line">
        {VISTAS.map((v) => (
          <Link
            key={v.id}
            href={`/admin/crm?vista=${v.id}`}
            aria-current={vista === v.id ? "page" : undefined}
            className={`-mb-px inline-flex min-h-11 items-center border-b-2 px-4 text-sm font-semibold transition-colors ${vista === v.id ? "border-brand-600 text-brand-800" : "border-transparent text-muted hover:text-ink"}`}
          >
            {v.label}
          </Link>
        ))}
      </nav>

      {contactos && (
        <>
          <div className="flex flex-wrap items-start gap-3">
            <form action="/admin/crm" className="grid min-w-60 flex-1 gap-2 sm:grid-cols-[1fr_auto_auto_auto_auto]">
              <input type="hidden" name="vista" value="contactos" />
              <div className="relative">
                <Search className="pointer-events-none absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-muted" aria-hidden />
                <input name="q" defaultValue={q} placeholder="Buscar por nombre, teléfono, correo o ciudad" aria-label="Buscar contactos" className={`${campo} pl-10`} />
              </div>
              <select name="tipo" defaultValue={tipo ?? ""} aria-label="Tipo de contacto" className={`${campo} sm:w-auto`}>
                <option value="">Todos</option>
                <option value="vendedor">Vendedores</option>
                <option value="comprador">Compradores</option>
              </select>
              <select name="origen" defaultValue={origen ?? ""} aria-label="Origen" className={`${campo} sm:w-auto`}>
                <option value="">Cualquier origen</option>
                {ORIGENES.map((o) => (
                  <option key={o} value={o}>
                    {ORIGEN_LABELS[o]}
                  </option>
                ))}
              </select>
              <label className="inline-flex min-h-11 items-center gap-2 text-xs font-semibold text-ink-soft sm:min-h-10">
                <input type="checkbox" name="sinProximo" value="1" defaultChecked={sinProximo} className="h-4 w-4 rounded border-line" /> Sin próximo contacto
              </label>
              <button className="min-h-11 rounded-xl bg-brand-700 px-4 text-sm font-semibold text-white hover:bg-brand-800 sm:min-h-10">Filtrar</button>
            </form>
            <details className="group w-full rounded-2xl border border-line bg-white sm:w-auto sm:min-w-[22rem]">
              <summary className="flex min-h-11 cursor-pointer list-none items-center rounded-2xl px-4 py-2.5 text-sm font-semibold text-brand-800 hover:bg-brand-50">+ Nuevo contacto</summary>
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
                <BotonEnviar className="min-h-11 rounded-xl bg-brand-700 px-4 py-2 text-sm font-semibold text-white hover:bg-brand-800">Crear contacto</BotonEnviar>
              </form>
            </details>
          </div>

          {/* Celular: tarjetas */}
          <ul className="space-y-3 md:hidden" aria-label="Contactos">
            {contactos.filas.map((c) => (
              <li key={c.id} className="flex items-start justify-between gap-3 rounded-2xl border border-line bg-white p-4">
                <div className="min-w-0">
                  <Persona c={c} />
                  <div className="mt-1.5 flex flex-wrap gap-1">
                    {c.captaciones > 0 && <span className="rounded-full bg-accent-500/15 px-2.5 py-0.5 text-xs font-semibold text-accent-600">Vendedor · {c.captaciones}</span>}
                    {c.busquedas > 0 && <span className="rounded-full bg-brand-50 px-2.5 py-0.5 text-xs font-semibold text-brand-700">Comprador · {c.busquedas}</span>}
                  </div>
                  <p className="mt-1 text-xs text-muted">
                    {ORIGEN_LABELS[c.origen]} · última actividad {fecha(c.ultimaActividad)}
                  </p>
                </div>
                <BotonesContacto telefono={c.telefono} nombre={c.nombre} contactoId={c.id} />
              </li>
            ))}
            {contactos.filas.length === 0 && (
              <li className="rounded-2xl border border-line bg-white px-4 py-12 text-center text-sm text-muted">{hayFiltros ? "Ningún contacto coincide con la búsqueda." : "Aún no hay contactos. Crea uno o pasa un lead al CRM desde la pestaña Leads."}</li>
            )}
          </ul>

          <div className="hidden overflow-x-auto rounded-2xl border border-line bg-white md:block">
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
                {contactos.filas.map((c) => {
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
                          <EnlaceContacto href={wa} contactoId={c.id} aria-label={`Escribir a ${c.nombre} por WhatsApp`} className="inline-flex rounded-lg p-2 text-muted transition-colors hover:bg-emerald-50 hover:text-emerald-600">
                            <MessageCircle className="h-4 w-4" />
                          </EnlaceContacto>
                        )}
                      </td>
                    </tr>
                  );
                })}
                {contactos.filas.length === 0 && (
                  <tr>
                    <td colSpan={6} className="px-4 py-12 text-center text-muted">
                      {hayFiltros ? "Ningún contacto coincide con la búsqueda." : "Aún no hay contactos. Crea uno o pasa un lead al CRM desde la pestaña Leads."}
                    </td>
                  </tr>
                )}
              </tbody>
            </table>
          </div>
          <Paginacion pagina={contactos.pagina} porPagina={contactos.porPagina} total={contactos.total} href={href} />
        </>
      )}

      {captaciones && (
        <>
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
                {captaciones.filas.map((c) => {
                  const p = c.propertyId ? inmueble.get(c.propertyId) : undefined;
                  return (
                    <tr key={c.id} className="align-top transition-colors hover:bg-surface">
                      <td className="px-4 py-3">
                        <Persona c={c.contacto} />
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
                {captaciones.filas.length === 0 && (
                  <tr>
                    <td colSpan={8} className="px-4 py-12 text-center text-muted">
                      Aún no hay vendedores. Se crean desde la ficha de un contacto.
                    </td>
                  </tr>
                )}
              </tbody>
            </table>
          </div>
          <Paginacion pagina={captaciones.pagina} porPagina={captaciones.porPagina} total={captaciones.total} href={href} />
        </>
      )}

      {busquedas && (
        <>
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
                {busquedas.filas.map((b) => (
                  <tr key={b.id} className="align-top transition-colors hover:bg-surface">
                    <td className="px-4 py-3">
                      <Persona c={b.contacto} />
                    </td>
                    <td className="px-4 py-3 text-xs text-ink-soft">{TIPO_COMPRADOR_LABELS[b.tipo]}</td>
                    <td className="px-4 py-3 text-xs text-ink-soft">
                      {b.ubicacion ?? "—"}
                      {b.especificacion && <p className="max-w-xs text-muted">{b.especificacion}</p>}
                    </td>
                    <td className="px-4 py-3 text-right text-xs text-ink-soft">{b.precioMax !== undefined ? formatPrice(b.precioMax) : "—"}</td>
                    <td className="px-4 py-3 text-xs text-ink-soft">{b.potencial ? "Sí" : "No"}</td>
                    <td className="px-4 py-3 text-right text-xs text-ink-soft">{b.propuestas}</td>
                    <td className="px-4 py-3">
                      <span className={chip}>{ESTADO_BUSQUEDA_LABELS[b.estado]}</span>
                    </td>
                  </tr>
                ))}
                {busquedas.filas.length === 0 && (
                  <tr>
                    <td colSpan={7} className="px-4 py-12 text-center text-muted">
                      Aún no hay compradores. Se crean desde la ficha de un contacto.
                    </td>
                  </tr>
                )}
              </tbody>
            </table>
          </div>
          <Paginacion pagina={busquedas.pagina} porPagina={busquedas.porPagina} total={busquedas.total} href={href} />
        </>
      )}
    </div>
  );
}
