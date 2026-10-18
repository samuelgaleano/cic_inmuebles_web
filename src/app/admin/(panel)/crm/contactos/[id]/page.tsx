import { ArrowLeft, MessageCircle } from "lucide-react";
import Link from "next/link";
import { notFound } from "next/navigation";
import { BotonEnviar } from "@/components/admin/boton-enviar";
import { PropuestaEstadoForm } from "@/components/admin/propuesta-estado-form";
import {
  actualizarBusquedaAction,
  actualizarCaptacionAction,
  actualizarContactoAction,
  archivarContactoAction,
  crearBusquedaAction,
  crearCaptacionAction,
  proponerInmuebleAction,
  quitarPropuestaAction,
  registrarActividadAction,
} from "@/lib/actions/admin-crm";
import { sugerirInmuebles } from "@/lib/crm/reglas";
import { getCrmStore } from "@/lib/crm/store";
import {
  ESTADOS_BUSQUEDA,
  ESTADOS_CAPTACION,
  ESTADO_BUSQUEDA_LABELS,
  ESTADO_CAPTACION_LABELS,
  ESTATUS_PAGO,
  ESTATUS_PAGO_LABELS,
  MULTIMEDIA,
  MULTIMEDIA_LABELS,
  ORIGEN_LABELS,
  TIPOS_ACTIVIDAD,
  TIPOS_COMPRADOR,
  TIPO_ACTIVIDAD_LABELS,
  TIPO_COMPRADOR_LABELS,
} from "@/lib/crm/tipos";
import { getRepository } from "@/lib/data";
import { getPlan } from "@/lib/config/plans";
import { getPagosStore } from "@/lib/pagos/store";
import { getServiciosStore } from "@/lib/servicios/store";
import { DIAS_DE_GRACIA, diasDePeriodo, ETIQUETA_ESTADO, ETIQUETA_PERIODO, fechaHora as fechaHoraBogota, finDeGracia, type Periodo, type Servicio } from "@/lib/servicios/vigencia";
import { formatPrice } from "@/lib/utils/format";
import { enlaceWhatsApp, normalizarTelefono } from "@/lib/utils/telefono";

export const dynamic = "force-dynamic";

const UUID = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;

const campo =
  "h-9 w-full rounded-lg border border-line bg-surface px-2.5 text-sm text-ink transition-colors focus:border-brand-500 focus:bg-white focus:outline-none focus:ring-2 focus:ring-brand-200";
const etiqueta = "block text-xs font-semibold text-ink-soft";
const primario = "rounded-lg bg-brand-700 px-3 py-1.5 text-xs font-semibold text-white hover:bg-brand-800";
const secundario = "rounded-lg border border-line bg-white px-2.5 py-1.5 text-xs font-semibold text-ink-soft transition-colors hover:border-ink hover:text-ink";
const tarjeta = "rounded-2xl border border-line bg-white p-5";

function fechaHora(iso: string): string {
  return new Date(iso).toLocaleString("es-CO", { timeZone: "America/Bogota", day: "2-digit", month: "short", year: "numeric", hour: "2-digit", minute: "2-digit" });
}

export default async function FichaContactoPage({ params, searchParams }: { params: Promise<{ id: string }>; searchParams: Promise<{ error?: string }> }) {
  const { id } = await params;
  const { error } = await searchParams;
  if (!UUID.test(id)) notFound();

  const crm = getCrmStore();
  const contacto = await crm.obtenerContacto(id);
  if (!contacto) notFound();

  const [captaciones, busquedas, actividades, propiedades, leads] = await Promise.all([
    crm.listarCaptaciones(id),
    crm.listarBusquedas(id),
    crm.listarActividades(id),
    getRepository().properties.list(),
    getRepository().leads.list(),
  ]);
  const propuestas = await crm.listarPropuestas(busquedas.map((b) => b.id));
  const inmueble = new Map(propiedades.map((p) => [p.id, p]));

  // Leads del formulario de esta persona (mismo teléfono) y sus servicios de publicación (mismo correo o teléfono).
  const mismoTelefono = (crudo?: string) => Boolean(contacto.telefonoE164 && crudo && normalizarTelefono(crudo)?.e164 === contacto.telefonoE164);
  // Los leads y planes enlazados por llave foránea y, para los anteriores al enlace, los que coinciden por teléfono o correo.
  const idsLeads = new Set(await crm.leadsDeContacto(id));
  const susLeads = leads.filter((l) => idsLeads.has(l.id) || mismoTelefono(l.telefono) || Boolean(contacto.email && l.email?.toLowerCase() === contacto.email));
  const serviciosStore = getServiciosStore();
  let susServicios: Servicio[] = [];
  try {
    susServicios = (await serviciosStore.listar()).filter(
      (s) => s.contactoId === contacto.id || (!s.contactoId && (Boolean(contacto.email && s.clienteEmail?.toLowerCase() === contacto.email) || mismoTelefono(s.clienteTelefono ?? undefined))),
    );
  } catch {
    susServicios = []; // sin la tabla de servicios la ficha funciona igual
  }
  // Por cada plan: el estado real del pago y los tramos de vigencia que concedió.
  const pagosStore = getPagosStore();
  const pagosYPeriodos = new Map<string, { aprobado?: { montoCOP: number; cuando: string }; periodos: Periodo[] }>();
  for (const sv of susServicios) {
    const eventos = await pagosStore.trace(sv.txId).catch(() => []);
    const ok = eventos.find((e) => e.status === "APPROVED");
    pagosYPeriodos.set(sv.id, {
      ...(ok ? { aprobado: { montoCOP: Math.round((ok.amountInCents ?? 0) / 100), cuando: ok.receivedAt } } : {}),
      periodos: await serviciosStore.periodos(sv.id).catch(() => []),
    });
  }

  const wa = contacto.telefono ? enlaceWhatsApp(contacto.telefono, `Hola ${contacto.nombre.split(" ")[0]}, te escribimos de CIC Inmuebles.`) : undefined;

  return (
    <div className="space-y-6">
      <div>
        <Link href="/admin/crm" className="inline-flex items-center gap-1 text-xs font-semibold text-muted hover:text-ink">
          <ArrowLeft className="h-3.5 w-3.5" /> Volver al CRM
        </Link>
        <div className="mt-2 flex flex-wrap items-center justify-between gap-3">
          <div>
            <h1 className="text-2xl font-bold tracking-tight text-ink">
              {contacto.nombre} {contacto.archivado && <span className="ml-2 rounded-full bg-ink/[0.07] px-2.5 py-0.5 align-middle text-xs font-semibold text-muted">Archivado</span>}
            </h1>
            <p className="mt-0.5 text-sm text-muted">
              {[contacto.telefono, contacto.email, contacto.ciudad].filter(Boolean).join(" · ") || "Sin datos de contacto"} · Origen: {ORIGEN_LABELS[contacto.origen]}
            </p>
          </div>
          <div className="flex items-center gap-2">
            {wa && (
              <a href={wa} target="_blank" rel="noopener noreferrer" className={`${secundario} inline-flex items-center gap-1.5`}>
                <MessageCircle className="h-3.5 w-3.5" /> WhatsApp
              </a>
            )}
            <form action={archivarContactoAction}>
              <input type="hidden" name="id" value={contacto.id} />
              <input type="hidden" name="archivado" value={contacto.archivado ? "0" : "1"} />
              <BotonEnviar className={secundario}>{contacto.archivado ? "Restaurar" : "Archivar"}</BotonEnviar>
            </form>
          </div>
        </div>
      </div>

      {error && (
        <p role="alert" className="rounded-xl border border-rose-200 bg-rose-50 px-4 py-3 text-sm text-rose-700">
          {error}
        </p>
      )}

      <div className="grid gap-6 lg:grid-cols-[minmax(0,3fr)_minmax(0,2fr)]">
        <div className="space-y-6">
          {/* Datos */}
          <section className={tarjeta} aria-labelledby="datos">
            <h2 id="datos" className="mb-3 text-sm font-bold text-ink">Datos del contacto</h2>
            <form action={actualizarContactoAction} className="grid gap-3 sm:grid-cols-2">
              <input type="hidden" name="id" value={contacto.id} />
              <label className={etiqueta}>
                Nombre
                <input name="nombre" defaultValue={contacto.nombre} required minLength={2} maxLength={120} className={`${campo} mt-1`} />
              </label>
              <label className={etiqueta}>
                Teléfono
                <input name="telefono" defaultValue={contacto.telefono ?? ""} inputMode="tel" className={`${campo} mt-1`} />
              </label>
              <label className={etiqueta}>
                Correo
                <input name="email" type="email" defaultValue={contacto.email ?? ""} className={`${campo} mt-1`} />
              </label>
              <label className={etiqueta}>
                Ciudad
                <input name="ciudad" defaultValue={contacto.ciudad ?? ""} maxLength={80} className={`${campo} mt-1`} />
              </label>
              <label className={`${etiqueta} sm:col-span-2`}>
                Notas
                <textarea name="notas" defaultValue={contacto.notas ?? ""} rows={2} maxLength={2000} className={`${campo} mt-1 h-auto py-2`} />
              </label>
              <div className="sm:col-span-2">
                <BotonEnviar className={primario}>Guardar datos</BotonEnviar>
              </div>
            </form>
          </section>

          {/* Vendedor */}
          <section className={tarjeta} aria-labelledby="vendedor">
            <h2 id="vendedor" className="mb-3 text-sm font-bold text-ink">Como vendedor</h2>
            <div className="space-y-4">
              {captaciones.map((c) => {
                const p = c.propertyId ? inmueble.get(c.propertyId) : undefined;
                return (
                  <form key={c.id} action={actualizarCaptacionAction} className="space-y-3 rounded-xl border border-line p-4">
                    <input type="hidden" name="id" value={c.id} />
                    <input type="hidden" name="contactoId" value={contacto.id} />
                    <div className="flex flex-wrap items-center justify-between gap-2">
                      <p className="text-sm font-semibold text-ink">
                        {p ? (
                          <Link href={`/admin/inmuebles/${p.id}`} className="text-brand-700 underline underline-offset-2">
                            {p.codigo} · {p.titulo}
                          </Link>
                        ) : (
                          "Captación sin ficha todavía"
                        )}
                      </p>
                      <p className="text-xs text-muted">
                        Comisión: <strong className="text-ink">{c.comisionValor !== undefined ? formatPrice(c.comisionValor) : "—"}</strong> ({c.comisionPct} %)
                      </p>
                    </div>
                    <div className="grid gap-3 sm:grid-cols-3">
                      <label className={etiqueta}>
                        Código del inmueble
                        <input name="codigo" list="codigos" defaultValue={p?.codigo ?? ""} className={`${campo} mt-1`} />
                      </label>
                      <label className={etiqueta}>
                        Ubicación
                        <input name="ubicacion" defaultValue={c.ubicacion ?? ""} maxLength={160} className={`${campo} mt-1`} />
                      </label>
                      <label className={etiqueta}>
                        Precio esperado
                        <input name="precio" defaultValue={c.precioEsperado ?? ""} inputMode="numeric" placeholder="450.000.000" className={`${campo} mt-1`} />
                      </label>
                      <label className={etiqueta}>
                        Comisión %
                        <input name="pct" defaultValue={c.comisionPct} inputMode="decimal" className={`${campo} mt-1`} />
                      </label>
                      <label className={etiqueta}>
                        Pago
                        <select name="estatusPago" defaultValue={c.estatusPago} className={`${campo} mt-1`}>
                          {ESTATUS_PAGO.map((s) => (
                            <option key={s} value={s}>{ESTATUS_PAGO_LABELS[s]}</option>
                          ))}
                        </select>
                      </label>
                      <label className={etiqueta}>
                        Fotos y video
                        <select name="multimedia" defaultValue={c.multimedia} className={`${campo} mt-1`}>
                          {MULTIMEDIA.map((s) => (
                            <option key={s} value={s}>{MULTIMEDIA_LABELS[s]}</option>
                          ))}
                        </select>
                      </label>
                      <label className={etiqueta}>
                        Estado
                        <select name="estado" defaultValue={c.estado} className={`${campo} mt-1`}>
                          {ESTADOS_CAPTACION.map((s) => (
                            <option key={s} value={s}>{ESTADO_CAPTACION_LABELS[s]}</option>
                          ))}
                        </select>
                      </label>
                      <label className="flex items-center gap-2 pt-5 text-xs font-semibold text-ink-soft">
                        <input type="checkbox" name="aprobada" defaultChecked={c.aprobada} className="h-4 w-4 rounded border-line" /> Aprobada
                      </label>
                    </div>
                    <BotonEnviar className={primario}>Guardar</BotonEnviar>
                  </form>
                );
              })}
              {captaciones.length === 0 && <p className="text-sm text-muted">Todavía no es vendedor.</p>}

              <details className="rounded-xl border border-dashed border-line">
                <summary className="cursor-pointer list-none px-4 py-2.5 text-xs font-semibold text-brand-800">+ Registrar como vendedor</summary>
                <form action={crearCaptacionAction} className="grid gap-3 border-t border-line p-4 sm:grid-cols-3">
                  <input type="hidden" name="contactoId" value={contacto.id} />
                  <label className={etiqueta}>
                    Código del inmueble
                    <input name="codigo" list="codigos" placeholder="(opcional)" className={`${campo} mt-1`} />
                  </label>
                  <label className={etiqueta}>
                    Ubicación
                    <input name="ubicacion" maxLength={160} className={`${campo} mt-1`} />
                  </label>
                  <label className={etiqueta}>
                    Precio esperado
                    <input name="precio" inputMode="numeric" placeholder="450.000.000" className={`${campo} mt-1`} />
                  </label>
                  <label className={etiqueta}>
                    Comisión %
                    <input name="pct" defaultValue="3" inputMode="decimal" className={`${campo} mt-1`} />
                  </label>
                  <label className={etiqueta}>
                    Pago
                    <select name="estatusPago" defaultValue="pendiente" className={`${campo} mt-1`}>
                      {ESTATUS_PAGO.map((s) => (
                        <option key={s} value={s}>{ESTATUS_PAGO_LABELS[s]}</option>
                      ))}
                    </select>
                  </label>
                  <div className="flex items-end">
                    <BotonEnviar className={primario}>Crear</BotonEnviar>
                  </div>
                </form>
              </details>
            </div>
          </section>

          {/* Comprador */}
          <section className={tarjeta} aria-labelledby="comprador">
            <h2 id="comprador" className="mb-3 text-sm font-bold text-ink">Como comprador</h2>
            <div className="space-y-4">
              {busquedas.map((b) => {
                const suyas = propuestas.filter((p) => p.busquedaId === b.id);
                const sugeridas = sugerirInmuebles(b, propiedades, suyas.map((p) => p.propertyId));
                return (
                  <div key={b.id} className="space-y-4 rounded-xl border border-line p-4">
                    <form action={actualizarBusquedaAction} className="space-y-3">
                      <input type="hidden" name="id" value={b.id} />
                      <input type="hidden" name="contactoId" value={contacto.id} />
                      <div className="grid gap-3 sm:grid-cols-3">
                        <label className={etiqueta}>
                          Tipo
                          <select name="tipo" defaultValue={b.tipo} className={`${campo} mt-1`}>
                            {TIPOS_COMPRADOR.map((s) => (
                              <option key={s} value={s}>{TIPO_COMPRADOR_LABELS[s]}</option>
                            ))}
                          </select>
                        </label>
                        <label className={etiqueta}>
                          Ubicación que busca
                          <input name="ubicacion" defaultValue={b.ubicacion ?? ""} maxLength={160} className={`${campo} mt-1`} />
                        </label>
                        <label className={etiqueta}>
                          Presupuesto máximo
                          <input name="precioMax" defaultValue={b.precioMax ?? ""} inputMode="numeric" placeholder="450.000.000" className={`${campo} mt-1`} />
                        </label>
                        <label className={`${etiqueta} sm:col-span-2`}>
                          Especificación
                          <input name="especificacion" defaultValue={b.especificacion ?? ""} maxLength={600} placeholder="3 alcobas, parqueadero, zona norte" className={`${campo} mt-1`} />
                        </label>
                        <label className={etiqueta}>
                          Estado
                          <select name="estado" defaultValue={b.estado} className={`${campo} mt-1`}>
                            {ESTADOS_BUSQUEDA.map((s) => (
                              <option key={s} value={s}>{ESTADO_BUSQUEDA_LABELS[s]}</option>
                            ))}
                          </select>
                        </label>
                        <label className="flex items-center gap-2 text-xs font-semibold text-ink-soft">
                          <input type="checkbox" name="potencial" defaultChecked={b.potencial} className="h-4 w-4 rounded border-line" /> Potencial
                        </label>
                      </div>
                      <BotonEnviar className={primario}>Guardar</BotonEnviar>
                    </form>

                    <div>
                      <h3 className="mb-2 text-xs font-bold uppercase tracking-wider text-muted">Inmuebles propuestos</h3>
                      <ul className="space-y-2">
                        {suyas.map((s) => {
                          const p = inmueble.get(s.propertyId);
                          return (
                            <li key={s.propertyId} className="flex flex-wrap items-center justify-between gap-2 text-sm">
                              <span>
                                {p ? (
                                  <Link href={`/admin/inmuebles/${p.id}`} className="font-medium text-brand-700 underline underline-offset-2">
                                    {p.codigo} · {p.titulo}
                                  </Link>
                                ) : (
                                  <span className="text-muted">(inmueble eliminado)</span>
                                )}
                                {p && <span className="ml-2 text-xs text-muted">{formatPrice(p.precio)}</span>}
                              </span>
                              <span className="flex items-center gap-2">
                                <PropuestaEstadoForm busquedaId={b.id} propertyId={s.propertyId} contactoId={contacto.id} estado={s.estado} />
                                <form action={quitarPropuestaAction}>
                                  <input type="hidden" name="busquedaId" value={b.id} />
                                  <input type="hidden" name="propertyId" value={s.propertyId} />
                                  <input type="hidden" name="contactoId" value={contacto.id} />
                                  <button className="text-xs font-semibold text-muted underline underline-offset-2 hover:text-rose-600">Quitar</button>
                                </form>
                              </span>
                            </li>
                          );
                        })}
                        {suyas.length === 0 && <li className="text-xs text-muted">Aún no se le ha propuesto ninguno.</li>}
                      </ul>
                      <form action={proponerInmuebleAction} className="mt-3 flex items-end gap-2">
                        <input type="hidden" name="busquedaId" value={b.id} />
                        <input type="hidden" name="contactoId" value={contacto.id} />
                        <label className={`${etiqueta} flex-1`}>
                          Proponer por código
                          <input name="codigo" list="codigos" className={`${campo} mt-1`} />
                        </label>
                        <BotonEnviar className={primario}>Proponer</BotonEnviar>
                      </form>

                      {sugeridas.length > 0 && (
                        <div className="mt-4 rounded-xl bg-surface p-3">
                          <h3 className="mb-2 text-xs font-bold uppercase tracking-wider text-muted">Sugeridos según lo que busca</h3>
                          <ul className="space-y-2">
                            {sugeridas.map((s) => (
                              <li key={s.property.id} className="flex flex-wrap items-center justify-between gap-2 text-sm">
                                <span>
                                  <span className="font-medium text-ink">{s.property.codigo} · {s.property.titulo}</span>
                                  <span className="ml-2 text-xs text-muted">{formatPrice(s.property.precio)} · {s.motivo}</span>
                                </span>
                                <form action={proponerInmuebleAction}>
                                  <input type="hidden" name="busquedaId" value={b.id} />
                                  <input type="hidden" name="contactoId" value={contacto.id} />
                                  <input type="hidden" name="propertyId" value={s.property.id} />
                                  <BotonEnviar className={secundario}>Proponer</BotonEnviar>
                                </form>
                              </li>
                            ))}
                          </ul>
                        </div>
                      )}
                    </div>
                  </div>
                );
              })}
              {busquedas.length === 0 && <p className="text-sm text-muted">Todavía no es comprador.</p>}

              <details className="rounded-xl border border-dashed border-line">
                <summary className="cursor-pointer list-none px-4 py-2.5 text-xs font-semibold text-brand-800">+ Registrar como comprador</summary>
                <form action={crearBusquedaAction} className="grid gap-3 border-t border-line p-4 sm:grid-cols-3">
                  <input type="hidden" name="contactoId" value={contacto.id} />
                  <label className={etiqueta}>
                    Tipo
                    <select name="tipo" defaultValue="comprador" className={`${campo} mt-1`}>
                      {TIPOS_COMPRADOR.map((s) => (
                        <option key={s} value={s}>{TIPO_COMPRADOR_LABELS[s]}</option>
                      ))}
                    </select>
                  </label>
                  <label className={etiqueta}>
                    Ubicación que busca
                    <input name="ubicacion" maxLength={160} className={`${campo} mt-1`} />
                  </label>
                  <label className={etiqueta}>
                    Presupuesto máximo
                    <input name="precioMax" inputMode="numeric" placeholder="450.000.000" className={`${campo} mt-1`} />
                  </label>
                  <label className={`${etiqueta} sm:col-span-2`}>
                    Especificación
                    <input name="especificacion" maxLength={600} className={`${campo} mt-1`} />
                  </label>
                  <label className="flex items-center gap-2 pt-5 text-xs font-semibold text-ink-soft">
                    <input type="checkbox" name="potencial" className="h-4 w-4 rounded border-line" /> Potencial
                  </label>
                  <div className="sm:col-span-3">
                    <BotonEnviar className={primario}>Crear</BotonEnviar>
                  </div>
                </form>
              </details>
            </div>
          </section>
        </div>

        <div className="space-y-6">
          {/* Línea de tiempo */}
          <section className={tarjeta} aria-labelledby="actividad">
            <h2 id="actividad" className="mb-3 text-sm font-bold text-ink">Seguimiento</h2>
            <form action={registrarActividadAction} className="space-y-2">
              <input type="hidden" name="contactoId" value={contacto.id} />
              <div className="grid grid-cols-2 gap-2">
                <label className={etiqueta}>
                  Tipo
                  <select name="tipo" defaultValue="nota" className={`${campo} mt-1`}>
                    {TIPOS_ACTIVIDAD.map((s) => (
                      <option key={s} value={s}>{TIPO_ACTIVIDAD_LABELS[s]}</option>
                    ))}
                  </select>
                </label>
                <label className={etiqueta}>
                  Inmueble (código)
                  <input name="codigo" list="codigos" placeholder="(opcional)" className={`${campo} mt-1`} />
                </label>
              </div>
              <label className={etiqueta}>
                Qué pasó
                <textarea name="detalle" required rows={2} maxLength={2000} className={`${campo} mt-1 h-auto py-2`} />
              </label>
              <BotonEnviar className={primario}>Registrar</BotonEnviar>
            </form>
            <ol className="mt-5 space-y-4 border-l border-line pl-4">
              {actividades.map((a) => {
                const p = a.propertyId ? inmueble.get(a.propertyId) : undefined;
                return (
                  <li key={a.id} className="relative text-sm">
                    <span className="absolute -left-[1.4rem] top-1.5 h-2 w-2 rounded-full bg-brand-500" aria-hidden />
                    <p className="text-xs text-muted">
                      {TIPO_ACTIVIDAD_LABELS[a.tipo]} · {fechaHora(a.ocurrioEn)}
                      {p && <> · {p.codigo}</>}
                    </p>
                    <p className="whitespace-pre-wrap text-ink-soft">{a.detalle}</p>
                  </li>
                );
              })}
              {actividades.length === 0 && <li className="text-xs text-muted">Sin actividad registrada.</li>}
            </ol>
          </section>

          {susLeads.length > 0 && (
            <section className={tarjeta} aria-labelledby="leads">
              <h2 id="leads" className="mb-3 text-sm font-bold text-ink">Leads del formulario</h2>
              <ul className="space-y-2 text-sm">
                {susLeads.map((l) => (
                  <li key={l.id}>
                    <span className="text-xs text-muted">{fechaHora(l.creadoEn)} · {l.tipo === "vendedor" ? "Vendedor" : "Comprador"}</span>
                    {l.mensaje && <p className="italic text-ink-soft">“{l.mensaje}”</p>}
                  </li>
                ))}
              </ul>
            </section>
          )}

          {susServicios.length > 0 && (
            <section className={tarjeta} aria-labelledby="servicios">
              <h2 id="servicios" className="mb-3 text-sm font-bold text-ink">Pagos y vigencia</h2>
              <ul className="space-y-5">
                {susServicios.map((sv) => {
                  const d = pagosYPeriodos.get(sv.id);
                  const plan = getPlan(sv.planId);
                  const pagadoEn = sv.pagadoAt ?? d?.aprobado?.cuando ?? sv.createdAt;
                  const enGracia = sv.estado === "activo" && sv.venceAt && new Date() > new Date(sv.venceAt) && new Date() < finDeGracia(sv.venceAt);
                  return (
                    <li key={sv.id} className="rounded-xl border border-line p-4 text-sm">
                      <div className="flex flex-wrap items-center justify-between gap-2">
                        <p className="font-semibold text-ink">{plan?.nombre ?? sv.planId}</p>
                        <span className="rounded-full bg-ink/[0.07] px-2.5 py-0.5 text-xs font-semibold text-ink-soft">{ETIQUETA_ESTADO[sv.estado]}</span>
                      </div>

                      <dl className="mt-3 grid grid-cols-[auto_1fr] gap-x-4 gap-y-1 text-xs">
                        <dt className="text-muted">Pago</dt>
                        <dd className={d?.aprobado ? "font-semibold text-brand-700" : "text-ink-soft"}>
                          {d?.aprobado ? "Aprobado" : "Sin confirmación en el registro de pagos"}
                          {d?.aprobado && d.aprobado.montoCOP > 0 ? ` · ${formatPrice(d.aprobado.montoCOP)}` : plan?.precioCOP ? ` · ${formatPrice(plan.precioCOP)}` : ""}
                        </dd>
                        <dt className="text-muted">Pagado el</dt>
                        <dd className="text-ink-soft">
                          {fechaHoraBogota(pagadoEn)}
                          {!sv.pagadoAt && <span className="text-muted"> (fecha de registro)</span>}
                        </dd>
                        <dt className="text-muted">Referencia</dt>
                        <dd className="break-all font-mono text-ink-soft">{sv.reference ?? "—"}</dd>
                        <dt className="text-muted">Transacción</dt>
                        <dd className="break-all font-mono text-ink-soft">{sv.txId}</dd>
                      </dl>

                      <h3 className="mb-1 mt-4 text-xs font-bold uppercase tracking-wider text-muted">Rangos de vigencia</h3>
                      {d && d.periodos.length > 0 ? (
                        <ol className="space-y-1.5 border-l border-line pl-3 text-xs">
                          {d.periodos.map((p) => (
                            <li key={p.id} className={p.tipo === "recorte" ? "text-rose-700" : "text-ink-soft"}>
                              <span className="font-semibold">{ETIQUETA_PERIODO[p.tipo]}</span>: {fechaHoraBogota(p.desde)} → {fechaHoraBogota(p.hasta)} · {diasDePeriodo(p)} día{diasDePeriodo(p) === 1 ? "" : "s"}
                            </li>
                          ))}
                        </ol>
                      ) : sv.inicioAt && sv.venceAt ? (
                        <p className="text-xs text-ink-soft">
                          {fechaHoraBogota(sv.inicioAt)} → {fechaHoraBogota(sv.venceAt)} <span className="text-muted">(anterior al libro de periodos)</span>
                        </p>
                      ) : (
                        <p className="text-xs text-muted">Todavía no empieza: la vigencia corre desde que CIC publique el inmueble.</p>
                      )}
                      {sv.venceAt && (
                        <p className="mt-2 text-xs text-ink-soft">
                          {sv.estado === "activo" ? "Vence" : "Terminó"} el <strong className="text-ink">{fechaHoraBogota(sv.venceAt)}</strong>
                          {enGracia && sv.venceAt ? ` · en gracia hasta ${fechaHoraBogota(finDeGracia(sv.venceAt).toISOString())} (${DIAS_DE_GRACIA} día)` : ""}
                        </p>
                      )}
                    </li>
                  );
                })}
              </ul>
              <Link href="/admin/vigencias" className="mt-3 inline-block text-xs font-semibold text-brand-700 underline underline-offset-2">
                Ir a Vigencias
              </Link>
            </section>
          )}
        </div>
      </div>

      <datalist id="codigos">
        {propiedades.map((p) => (
          <option key={p.id} value={p.codigo}>
            {p.titulo}
          </option>
        ))}
      </datalist>
    </div>
  );
}
