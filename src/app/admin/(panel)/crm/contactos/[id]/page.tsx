import { ArrowLeft, CalendarPlus, Phone } from "lucide-react";
import Link from "next/link";
import { notFound } from "next/navigation";
import { BotonEnviar } from "@/components/admin/boton-enviar";
import { EnlaceContacto } from "@/components/admin/enlace-contacto";
import { MenuWhatsApp } from "@/components/admin/menu-whatsapp";
import { PropuestaEstadoForm } from "@/components/admin/propuesta-estado-form";
import {
  actualizarBusquedaAction,
  actualizarCaptacionAction,
  actualizarContactoAction,
  archivarContactoAction,
  completarSeguimientoAction,
  crearBusquedaAction,
  crearCaptacionAction,
  fijarProximoContactoAction,
  marcarComisionCobradaAction,
  proponerInmuebleAction,
  quitarPropuestaAction,
  quitarProximoContactoAction,
  registrarActividadAction,
  registrarCierreAction,
  suprimirDatosAction,
} from "@/lib/actions/admin-crm";
import { opcionesWhatsApp } from "@/lib/crm/plantillas-whatsapp";
import { aHoraLocalBogota, clasificarSeguimiento, diaBogota, diasDeAtraso, sugerirInmuebles } from "@/lib/crm/reglas";
import { getCrmStore } from "@/lib/crm/store";
import {
  ESTADOS_BUSQUEDA,
  ESTADOS_CAPTACION,
  ESTADO_BUSQUEDA_LABELS,
  ESTADO_CAPTACION_LABELS,
  ESTADO_PROPUESTA_LABELS,
  ESTATUS_PAGO,
  ESTATUS_PAGO_LABELS,
  MULTIMEDIA,
  MULTIMEDIA_LABELS,
  ORIGEN_LABELS,
  TIPOS_ACTIVIDAD,
  TIPOS_COMPRADOR,
  TIPOS_SEGUIMIENTO,
  TIPO_ACTIVIDAD_LABELS,
  TIPO_COMPRADOR_LABELS,
} from "@/lib/crm/tipos";
import { getRepository } from "@/lib/data";
import { getPlan } from "@/lib/config/plans";
import { getPagosStore } from "@/lib/pagos/store";
import { getServiciosStore } from "@/lib/servicios/store";
import { DIAS_DE_GRACIA, diasDePeriodo, ETIQUETA_ESTADO, ETIQUETA_PERIODO, fechaHora as fechaHoraBogota, finDeGracia, type Periodo, type Servicio } from "@/lib/servicios/vigencia";
import { formatPrice } from "@/lib/utils/format";
import { enlaceWhatsApp, normalizarTelefono, variantesTelefono } from "@/lib/utils/telefono";
import { APPOINTMENT_STATUS_LABELS } from "@/lib/domain";

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

/** "2026-11-20" (día, sin hora) → "20 nov 2026". Se lee a mediodía UTC para que ninguna zona lo corra de día. */
function dia(ymd: string): string {
  return new Date(`${ymd}T12:00:00.000Z`).toLocaleDateString("es-CO", { timeZone: "UTC", day: "2-digit", month: "short", year: "numeric" });
}

export default async function FichaContactoPage({ params, searchParams }: { params: Promise<{ id: string }>; searchParams: Promise<{ error?: string }> }) {
  const { id } = await params;
  const { error } = await searchParams;
  if (!UUID.test(id)) notFound();

  const crm = getCrmStore();
  const contacto = await crm.obtenerContacto(id);
  if (!contacto) notFound();

  const repo = getRepository();
  // Todo filtrado por esta persona (contacto_id) o por sus inmuebles (property_id): nada de leer tablas completas.
  const [captaciones, busquedas, actividades, propiedades, susLeads, cierres] = await Promise.all([
    crm.listarCaptaciones(id),
    crm.listarBusquedas(id),
    crm.listarActividades(id),
    repo.properties.list(),
    // Los leads enlazados por llave foránea y, para los anteriores al enlace, los de su mismo teléfono o correo.
    crm.leadsDeContacto(id).then((ids) =>
      repo.leads.listarDeContacto({ contactoId: id, ids, telefonos: variantesTelefono(contacto.telefono, contacto.telefonoE164), email: contacto.email }).catch(() => []),
    ),
    crm.listarCierres({ contactoId: id }),
  ]);
  const propuestas = await crm.listarPropuestas(busquedas.map((b) => b.id));
  const inmueble = new Map(propiedades.map((p) => [p.id, p]));
  const ahora = new Date();
  const hoy = diaBogota(ahora);

  // Para «Registrar venta»: quiénes tienen propuesto cada inmueble de este vendedor (el comprador se elige de ahí).
  const vendibles = captaciones.filter((c) => c.estado !== "descartada");
  const vendidas = new Set(cierres.map((c) => c.captacionId).filter(Boolean));
  const conInmueble = new Set(vendibles.filter((c) => c.propertyId && !vendidas.has(c.id)).map((c) => c.propertyId!));
  const candidatos = new Map<string, { value: string; nombre: string; estado: string }[]>();
  // Solo las propuestas de los inmuebles de este vendedor (consulta por property_id).
  for (const pr of conInmueble.size ? await crm.propuestasDeInmuebles([...conInmueble]) : []) {
    if (pr.estado === "descartado" || pr.estadoBusqueda === "descartada" || pr.contacto.id === id) continue;
    const lista = candidatos.get(pr.propertyId) ?? [];
    lista.push({ value: `${pr.busquedaId}|${pr.contacto.id}`, nombre: pr.contacto.nombre, estado: ESTADO_PROPUESTA_LABELS[pr.estado] });
    candidatos.set(pr.propertyId, lista);
  }
  // Nombres de la otra parte de cada venta.
  const otros = cierres.flatMap((c) => [c.vendedorContactoId, c.compradorContactoId]).filter((x): x is string => Boolean(x) && x !== id);
  const nombres = new Map((otros.length ? await crm.contactosPorId(otros) : []).map((c) => [c.id, c.nombre]));
  const seguimiento = contacto.proximoContactoAt ? clasificarSeguimiento(contacto.proximoContactoAt, ahora) : undefined;

  // Sus servicios de publicación: enlazados por llave foránea o, los anteriores al enlace, por correo o teléfono.
  const mismoTelefono = (crudo?: string) => Boolean(contacto.telefonoE164 && crudo && normalizarTelefono(crudo)?.e164 === contacto.telefonoE164);
  const citas = await repo.appointments.listarDe({ contactoId: id, leadIds: susLeads.map((l) => l.id) }).catch(() => []);
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

  const wa = contacto.telefono ? enlaceWhatsApp(contacto.telefono) : undefined;
  const tel = contacto.telefono ? normalizarTelefono(contacto.telefono)?.e164 : undefined;

  // Mensajes de WhatsApp según la etapa de esta persona.
  const aMensaje = (pid?: string) => {
    const p = pid ? inmueble.get(pid) : undefined;
    return p ? { titulo: p.titulo, slug: p.slug, precio: p.precio, sector: p.ubicacion.sector } : undefined;
  };
  const vivas = busquedas.filter((b) => b.estado !== "descartada" && b.estado !== "cerrada");
  const suyasPropuestas = propuestas.filter((p) => vivas.some((b) => b.id === p.busquedaId) && p.estado !== "descartado");
  const proxima = citas.find((c) => (c.estado === "confirmada" || c.estado === "solicitada") && new Date(c.inicioEn) > ahora);
  const ultimaVisita = [...citas].reverse().find((c) => c.estado === "realizada");
  const visitada = ultimaVisita?.propertyId ?? suyasPropuestas.find((p) => p.estado === "visito")?.propertyId;
  const similar = vivas.length ? sugerirInmuebles(vivas[0], propiedades, propuestas.filter((p) => p.busquedaId === vivas[0].id).map((p) => p.propertyId))[0]?.property : undefined;
  const capVigente = captaciones.find((c) => c.estado !== "descartada" && c.estado !== "vendida");
  const inmuebleProxima = proxima ? aMensaje(proxima.propertyId) : undefined;
  const opciones = opcionesWhatsApp({
    nombre: contacto.nombre,
    telefono: contacto.telefono,
    esComprador: vivas.length > 0,
    esVendedor: Boolean(capVigente),
    interes: aMensaje(suyasPropuestas[0]?.propertyId ?? susLeads.find((l) => l.propertyId)?.propertyId),
    queVende: capVigente?.ubicacion ? `tu inmueble en ${capVigente.ubicacion}` : undefined,
    inmuebleVendedor: aMensaje(capVigente?.propertyId),
    ...(proxima && inmuebleProxima ? { proximaVisita: { inicioEn: proxima.inicioEn, inmueble: inmuebleProxima } } : {}),
    visitado: aMensaje(visitada),
    ...(similar ? { similar: { titulo: similar.titulo, slug: similar.slug, precio: similar.precio, sector: similar.ubicacion.sector } } : {}),
  });
  const agendar = (propertyId?: string) => `/admin/agenda?${new URLSearchParams({ contactoId: contacto.id, ...(propertyId ? { propertyId } : {}) }).toString()}#nueva-cita`;

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
          <div className="flex flex-wrap items-center gap-2">
            <MenuWhatsApp opciones={opciones} contactoId={contacto.id} enlaceSimple={wa} />
            {tel && (
              <EnlaceContacto href={`tel:${tel}`} contactoId={contacto.id} nuevaPestana={false} className={`${secundario} inline-flex min-h-11 items-center gap-1.5`}>
                <Phone className="h-3.5 w-3.5" aria-hidden /> Llamar
              </EnlaceContacto>
            )}
            <Link href={agendar()} className={`${secundario} inline-flex min-h-11 items-center gap-1.5`}>
              <CalendarPlus className="h-3.5 w-3.5" aria-hidden /> Agendar visita
            </Link>
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
                const compradores = c.propertyId ? (candidatos.get(c.propertyId) ?? []) : [];
                return (
                  <div key={c.id} className="space-y-2">
                  <form action={actualizarCaptacionAction} className="space-y-3 rounded-xl border border-line p-4">
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
                  {c.estado !== "descartada" && c.estado !== "vendida" && vendidas.has(c.id) && (
                    // La venta se guardó pero un paso posterior falló: se termina con los datos ya guardados.
                    <form action={registrarCierreAction} className="flex flex-wrap items-center gap-2 rounded-xl border border-amber-200 bg-amber-50 p-3">
                      <input type="hidden" name="captacionId" value={c.id} />
                      <input type="hidden" name="contactoId" value={contacto.id} />
                      <input type="hidden" name="completar" value="1" />
                      <span className="flex-1 text-xs text-amber-900">La venta quedó registrada, pero falta pasar la captación a vendida y cerrar lo demás.</span>
                      <BotonEnviar className={`${primario} inline-flex min-h-11 items-center`}>Completar venta</BotonEnviar>
                    </form>
                  )}
                  {c.estado !== "descartada" && !vendidas.has(c.id) && (
                    <details className="rounded-xl border border-dashed border-line">
                      <summary className="flex min-h-11 cursor-pointer list-none items-center px-4 py-2.5 text-xs font-semibold text-brand-800">Registrar venta</summary>
                      <form action={registrarCierreAction} className="grid gap-3 border-t border-line p-4 sm:grid-cols-3">
                        <input type="hidden" name="captacionId" value={c.id} />
                        <input type="hidden" name="contactoId" value={contacto.id} />
                        <label className={etiqueta}>
                          Precio de venta
                          <input name="precio" required defaultValue={c.precioEsperado ?? p?.precio ?? ""} inputMode="numeric" placeholder="450.000.000" className={`${campo} mt-1`} />
                        </label>
                        <label className={etiqueta}>
                          Fecha de la venta
                          <input name="fecha" type="date" required defaultValue={hoy} max={hoy} className={`${campo} mt-1`} />
                        </label>
                        <label className={etiqueta}>
                          Comisión %
                          <input name="pct" defaultValue={c.comisionPct} inputMode="decimal" className={`${campo} mt-1`} />
                        </label>
                        <label className={`${etiqueta} sm:col-span-3`}>
                          Comprador
                          <select name="comprador" defaultValue={compradores[0]?.value ?? ""} className={`${campo} mt-1`}>
                            {compradores.map((o) => (
                              <option key={o.value} value={o.value}>
                                {o.nombre} ({o.estado})
                              </option>
                            ))}
                            <option value="">Otro / no registrado</option>
                          </select>
                          {!c.propertyId && <span className="mt-1 block font-normal text-muted">Sin inmueble enlazado no hay compradores con propuesta: queda como «otro».</span>}
                        </label>
                        <label className={`${etiqueta} sm:col-span-3`}>
                          Notas
                          <textarea name="notas" rows={2} maxLength={2000} placeholder="Notaría, forma de pago, lo que se acordó" className={`${campo} mt-1 h-auto py-2`} />
                        </label>
                        <p className="text-xs text-muted sm:col-span-3">
                          Al guardar: la captación queda vendida{p ? `, el inmueble ${p.codigo} pasa a «Vendido» en el catálogo` : ""} y, si eliges comprador, su búsqueda se cierra. Se registra en la línea de tiempo de ambos.
                        </p>
                        <div className="sm:col-span-3">
                          <BotonEnviar className={`${primario} inline-flex min-h-11 items-center`}>Registrar venta</BotonEnviar>
                        </div>
                      </form>
                    </details>
                  )}
                  </div>
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
                                {p && (
                                  <Link href={agendar(p.id)} className="inline-flex min-h-11 items-center text-xs font-semibold text-brand-700 underline underline-offset-2 sm:min-h-0">
                                    Agendar visita
                                  </Link>
                                )}
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

          {/* Ventas cerradas */}
          {cierres.length > 0 && (
            <section className={tarjeta} aria-labelledby="cierres">
              <h2 id="cierres" className="mb-3 text-sm font-bold text-ink">Ventas cerradas</h2>
              <ul className="space-y-4">
                {cierres.map((ci) => {
                  const p = ci.propertyId ? inmueble.get(ci.propertyId) : undefined;
                  const rol = ci.vendedorContactoId === contacto.id ? "Vendió" : "Compró";
                  const otro = rol === "Vendió" ? ci.compradorContactoId : ci.vendedorContactoId;
                  const pendiente = ci.comisionPactada !== undefined && (ci.comisionCobrada ?? 0) < ci.comisionPactada;
                  return (
                    <li key={ci.id} className="rounded-xl border border-line p-4 text-sm">
                      <div className="flex flex-wrap items-center justify-between gap-2">
                        <p className="font-semibold text-ink">
                          {rol}{" "}
                          {p ? (
                            <Link href={`/admin/inmuebles/${p.id}`} className="text-brand-700 underline underline-offset-2">
                              {p.codigo} · {p.titulo}
                            </Link>
                          ) : (
                            "un inmueble sin ficha"
                          )}
                        </p>
                        <span className="text-xs text-muted">{dia(ci.fechaCierre)}</span>
                      </div>
                      <dl className="mt-3 grid grid-cols-[auto_1fr] gap-x-4 gap-y-1 text-xs">
                        <dt className="text-muted">Precio de venta</dt>
                        <dd className="font-semibold text-ink">{formatPrice(ci.precioVenta)}</dd>
                        <dt className="text-muted">{rol === "Vendió" ? "Comprador" : "Vendedor"}</dt>
                        <dd className="text-ink-soft">
                          {otro ? (
                            <Link href={`/admin/crm/contactos/${otro}`} className="text-brand-700 underline underline-offset-2">
                              {nombres.get(otro) ?? "(contacto)"}
                            </Link>
                          ) : (
                            "Otro / no registrado"
                          )}
                        </dd>
                        <dt className="text-muted">Comisión pactada</dt>
                        <dd className="text-ink-soft">
                          {ci.comisionPactada !== undefined ? formatPrice(ci.comisionPactada) : "—"}
                          {ci.comisionPct !== undefined && <span className="text-muted"> ({ci.comisionPct} %)</span>}
                        </dd>
                        <dt className="text-muted">Comisión cobrada</dt>
                        <dd className={pendiente ? "font-semibold text-accent-600" : "text-ink-soft"}>
                          {ci.comisionCobrada !== undefined ? `${formatPrice(ci.comisionCobrada)}${ci.cobradaAt ? ` el ${dia(ci.cobradaAt)}` : ""}` : "Sin cobrar"}
                        </dd>
                        {ci.notas && (
                          <>
                            <dt className="text-muted">Notas</dt>
                            <dd className="whitespace-pre-wrap text-ink-soft">{ci.notas}</dd>
                          </>
                        )}
                      </dl>
                      <form action={marcarComisionCobradaAction} className="mt-3 flex flex-wrap items-end gap-2">
                        <input type="hidden" name="id" value={ci.id} />
                        <input type="hidden" name="contactoId" value={contacto.id} />
                        <label className={etiqueta}>
                          Cobrado
                          <input name="monto" required defaultValue={ci.comisionCobrada ?? ci.comisionPactada ?? ""} inputMode="numeric" className={`${campo} mt-1 w-40`} />
                        </label>
                        <label className={etiqueta}>
                          Fecha
                          <input name="fecha" type="date" required defaultValue={ci.cobradaAt ?? hoy} max={hoy} className={`${campo} mt-1`} />
                        </label>
                        <BotonEnviar className={secundario}>Marcar comisión cobrada</BotonEnviar>
                      </form>
                    </li>
                  );
                })}
              </ul>
            </section>
          )}
        </div>

        <div className="space-y-6">
          {/* Próximo contacto */}
          <section
            className={`${tarjeta} ${seguimiento === "vencido" ? "border-rose-200" : seguimiento === "hoy" ? "border-accent-500/40" : ""}`}
            aria-labelledby="proximo"
          >
            <div className="mb-3 flex flex-wrap items-center justify-between gap-2">
              <h2 id="proximo" className="text-sm font-bold text-ink">Próximo contacto</h2>
              {seguimiento === "vencido" && contacto.proximoContactoAt && (
                <span className="rounded-full bg-rose-50 px-2.5 py-0.5 text-xs font-semibold text-rose-700">
                  Vencido hace {diasDeAtraso(contacto.proximoContactoAt, ahora)} día{diasDeAtraso(contacto.proximoContactoAt, ahora) === 1 ? "" : "s"}
                </span>
              )}
              {seguimiento === "hoy" && <span className="rounded-full bg-accent-500/15 px-2.5 py-0.5 text-xs font-semibold text-accent-600">Hoy</span>}
            </div>
            {contacto.proximoContactoAt ? (
              <div className="space-y-3">
                <p className="text-sm text-ink">
                  <strong>{fechaHora(contacto.proximoContactoAt)}</strong>
                  {contacto.proximoContactoNota && <span className="block text-ink-soft">{contacto.proximoContactoNota}</span>}
                </p>
                <form action={completarSeguimientoAction} className="space-y-2 rounded-xl bg-surface p-3">
                  <input type="hidden" name="contactoId" value={contacto.id} />
                  <input type="hidden" name="proximoAt" value={contacto.proximoContactoAt} />
                  <div className="grid grid-cols-1 items-end gap-2 sm:grid-cols-[auto_1fr]">
                    <label className={etiqueta}>
                      Cómo fue
                      <select name="tipo" defaultValue="llamada" className={`${campo} mt-1`}>
                        {TIPOS_SEGUIMIENTO.map((s) => (
                          <option key={s} value={s}>{TIPO_ACTIVIDAD_LABELS[s]}</option>
                        ))}
                      </select>
                    </label>
                    <label className={etiqueta}>
                      Qué se habló
                      <input name="detalle" maxLength={2000} placeholder={contacto.proximoContactoNota ?? "(opcional)"} className={`${campo} mt-1`} />
                    </label>
                  </div>
                  <div className="flex flex-wrap items-center gap-2">
                    <BotonEnviar className={`${primario} inline-flex min-h-11 items-center`}>Hecho</BotonEnviar>
                    <span className="text-xs text-muted">Queda en la línea de tiempo y se borra la fecha.</span>
                  </div>
                </form>
                {/* Destructivo y sin rastro: lejos de «Hecho» y con un segundo paso para confirmar. */}
                <details className="mt-3">
                  <summary className="inline-flex min-h-11 cursor-pointer list-none items-center px-1 text-xs font-semibold text-muted underline underline-offset-2 hover:text-rose-600">
                    Quitar la fecha sin registrar nada
                  </summary>
                  <form action={quitarProximoContactoAction} className="mt-1 flex flex-wrap items-center gap-2 rounded-xl border border-rose-200 bg-rose-50 p-3">
                    <input type="hidden" name="contactoId" value={contacto.id} />
                    <span className="flex-1 text-xs text-rose-800">Se borran la fecha y la nota sin dejar nada en la línea de tiempo.</span>
                    <BotonEnviar className="inline-flex min-h-11 items-center rounded-lg bg-rose-600 px-3 text-xs font-semibold text-white hover:bg-rose-700">Sí, quitar la fecha</BotonEnviar>
                  </form>
                </details>
              </div>
            ) : (
              <p className="text-sm text-muted">Sin fecha.</p>
            )}

            <form action={fijarProximoContactoAction} className="mt-4 space-y-2 border-t border-line pt-4">
              <input type="hidden" name="contactoId" value={contacto.id} />
              <label className={etiqueta}>
                Para qué (nota corta)
                <input name="nota" maxLength={300} defaultValue={contacto.proximoContactoNota ?? ""} placeholder="Mandarle el apto de Cedritos" className={`${campo} mt-1`} />
              </label>
              {/* «Agendar/Cambiar» va antes de los atajos: es el botón por defecto, el que usa Enter (o «Ir» en el
                  teclado del celular). Si fuera «En 1 día», Enter mandaría dias=1 y se perdería la fecha escrita. */}
              <div className="flex items-end gap-2">
                <label className={`${etiqueta} flex-1`}>
                  Fecha y hora
                  <input name="fecha" type="datetime-local" defaultValue={contacto.proximoContactoAt ? aHoraLocalBogota(contacto.proximoContactoAt) : ""} className={`${campo} mt-1`} />
                </label>
                <BotonEnviar className={`${primario} inline-flex min-h-11 items-center`}>{contacto.proximoContactoAt ? "Cambiar" : "Agendar"}</BotonEnviar>
              </div>
              <p className="text-xs font-semibold text-ink-soft">O con un atajo</p>
              <div className="flex flex-wrap gap-2">
                <BotonEnviar name="dias" value="1" className={`${secundario} inline-flex min-h-11 items-center`}>En 1 día</BotonEnviar>
                <BotonEnviar name="dias" value="3" className={`${secundario} inline-flex min-h-11 items-center`}>En 3 días</BotonEnviar>
                <BotonEnviar name="dias" value="7" className={`${secundario} inline-flex min-h-11 items-center`}>En 7 días</BotonEnviar>
              </div>
              <p className="text-xs text-muted">Los atajos agendan a las 9:00 a. m. Hora de Bogotá.</p>
            </form>
          </section>

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
              <div className="grid grid-cols-1 gap-2 sm:grid-cols-[auto_1fr]">
                <label className={etiqueta}>
                  Volver a contactar
                  <select name="proximo" defaultValue="" className={`${campo} mt-1`}>
                    <option value="">{contacto.proximoContactoAt ? "Dejar la fecha como está" : "Sin fecha"}</option>
                    <option value="1">En 1 día</option>
                    <option value="3">En 3 días</option>
                    <option value="7">En 7 días</option>
                  </select>
                </label>
                <label className={etiqueta}>
                  Para qué
                  <input name="proximoNota" maxLength={300} placeholder="(opcional)" className={`${campo} mt-1`} />
                </label>
              </div>
              <BotonEnviar className={`${primario} inline-flex min-h-11 items-center`}>Registrar</BotonEnviar>
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

          {/* Visitas de la agenda */}
          <section className={tarjeta} aria-labelledby="visitas">
            <div className="mb-3 flex flex-wrap items-center justify-between gap-2">
              <h2 id="visitas" className="text-sm font-bold text-ink">Visitas</h2>
              <Link href={agendar()} className="inline-flex min-h-11 items-center text-xs font-semibold text-brand-700 underline underline-offset-2 sm:min-h-0">
                + Agendar visita
              </Link>
            </div>
            {citas.length ? (
              <ul className="space-y-2 text-sm">
                {citas.map((c) => {
                  const p = inmueble.get(c.propertyId);
                  return (
                    <li key={c.id} className="flex flex-wrap items-center justify-between gap-2">
                      <span>
                        <span className="text-xs text-muted">{fechaHora(c.inicioEn)}</span>{" "}
                        <span className="text-ink-soft">{p ? `${p.codigo} · ${p.titulo}` : "(inmueble eliminado)"}</span>
                      </span>
                      <span className={`rounded-full px-2.5 py-0.5 text-xs font-semibold ${c.estado === "realizada" ? "bg-brand-50 text-brand-700" : "bg-ink/[0.07] text-ink-soft"}`}>{APPOINTMENT_STATUS_LABELS[c.estado]}</span>
                    </li>
                  );
                })}
              </ul>
            ) : (
              <p className="text-xs text-muted">Sin visitas agendadas. Al marcar una cita como «Realizada» en la Agenda, queda aquí y en su línea de tiempo.</p>
            )}
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

          {/* Ley 1581: supresión a pedido de la persona. Dos pasos: abrir y escribir la palabra de confirmación. */}
          <section className={`${tarjeta} border-rose-200`} aria-labelledby="suprimir">
            <h2 id="suprimir" className="text-sm font-bold text-ink">Datos personales</h2>
            <p className="mt-1 text-xs text-muted">Si la persona pide que borren sus datos (Ley 1581 de 2012).</p>
            <details className="mt-3">
              <summary className="inline-flex min-h-11 cursor-pointer list-none items-center rounded-lg border border-rose-200 px-3 text-xs font-semibold text-rose-700 hover:bg-rose-50">Suprimir datos de esta persona</summary>
              <form action={suprimirDatosAction} className="mt-3 space-y-3 rounded-xl border border-rose-200 bg-rose-50 p-3">
                <input type="hidden" name="contactoId" value={contacto.id} />
                <p className="text-xs text-rose-900">
                  Se reemplaza el nombre por «Suprimido» y se borran teléfono, correo, ciudad y notas del contacto, de sus leads y de sus citas, el texto de su línea de tiempo (quedan el tipo y la fecha) y sus datos de propietario en los inmuebles. Se conservan los montos de ventas y pagos. No se puede deshacer.
                </p>
                <label className={etiqueta}>
                  Escribe SUPRIMIR para confirmar
                  <input name="confirmar" required autoComplete="off" pattern="[Ss][Uu][Pp][Rr][Ii][Mm][Ii][Rr]" className={`${campo} mt-1 h-11 bg-white`} />
                </label>
                <BotonEnviar className="inline-flex min-h-11 items-center rounded-lg bg-rose-600 px-3 text-xs font-semibold text-white hover:bg-rose-700">Sí, suprimir sus datos</BotonEnviar>
              </form>
            </details>
          </section>
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
