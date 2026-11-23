"use server";

import { revalidatePath } from "next/cache";
import { redirect, unstable_rethrow } from "next/navigation";
import { exigirAdmin } from "@/lib/auth";
import { CrmNoDisponibleError, CrmStoreError, getCrmStore } from "@/lib/crm/store";
import { diaBogota, fechaDeSeguimiento, leerDia, leerPorcentaje, leerPrecio, validarCierre, validarContacto } from "@/lib/crm/reglas";
import {
  ESTADOS_BUSQUEDA,
  ESTADOS_CAPTACION,
  ESTADOS_PROPUESTA,
  ESTATUS_PAGO,
  MULTIMEDIA,
  TIPOS_ACTIVIDAD,
  TIPOS_COMPRADOR,
  TIPOS_SEGUIMIENTO,
  type EstadoBusqueda,
  type EstadoCaptacion,
  type EstadoPropuesta,
  type EstatusPago,
  type Multimedia,
  type TipoActividad,
  type TipoComprador,
  type Cierre,
} from "@/lib/crm/tipos";
import { getRepository } from "@/lib/data";
import { revalidarCatalogoPublico } from "@/lib/data/inventario-tag";
import { isSheetsConfigured, syncPropertyToSheet } from "@/lib/integrations/sheets";
import { fetchTransaction } from "@/lib/integrations/wompi";
import { formatPrice } from "@/lib/utils/format";
import { desdeHoraBogota } from "@/lib/utils/hora-bogota";
import { getServiciosStore } from "@/lib/servicios/store";
import { sincronizarTodo, vincularLead } from "@/lib/crm/vinculos";

/**
 * Acciones del CRM. Todas exigen sesión de administrador (el CRM es solo para el equipo).
 * Los errores de validación vuelven a la misma pantalla con `?error=` en vez de lanzar.
 */

const UUID = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;
/** Los inmuebles se identifican con uuid en la base y con otro formato en el catálogo de ejemplo: basta con que sea un id razonable. */
const ID_INMUEBLE = /^[\w-]{1,64}$/;

function texto(fd: FormData, k: string): string {
  return String(fd.get(k) ?? "").trim();
}

function elegir<T extends string>(valor: string, lista: readonly T[]): T | null {
  return (lista as readonly string[]).includes(valor) ? (valor as T) : null;
}

function volver(ruta: string, error?: string): never {
  const sep = ruta.includes("?") ? "&" : "?";
  redirect(error ? `${ruta}${sep}error=${encodeURIComponent(error)}` : ruta);
}

const FICHA = (id: string) => `/admin/crm/contactos/${id}`;

function refrescar(contactoId?: string) {
  revalidatePath("/admin/crm");
  if (contactoId) revalidatePath(FICHA(contactoId));
}

/** Convierte un fallo del almacén en un mensaje para la pantalla. */
function mensajeDe(err: unknown): string {
  // Un `volver()` (redirect) dentro del try llega aquí como error: se deja pasar en vez de mostrar
  // «No se pudo guardar» sobre el mensaje correcto.
  unstable_rethrow(err);
  if (err instanceof CrmNoDisponibleError) {
    return err.migracion === "0010"
      ? "Falta aplicar la migración 0010 en Supabase (próximo contacto y ventas cerradas)."
      : "Falta crear las tablas del CRM (migración 0007 en Supabase).";
  }
  if (err instanceof CrmStoreError) {
    // Antes del 23505 genérico: dos envíos simultáneos de la misma venta chocan con el índice único.
    if (/cierres_captacion_unica/i.test(err.message)) return "Esa venta ya está registrada.";
    if (/captación vigente|captaci.n vigente|captaciones_property_vigente/i.test(err.message)) return "Ese inmueble ya tiene una captación vigente.";
    if (/23505|duplicate|ya existe otro contacto/i.test(err.message)) return "Ya existe otro contacto con ese teléfono.";
    if (/llave for|foreign key|23503/i.test(err.message)) return "El registro enlazado ya no existe.";
  }
  console.error("[crm]", err instanceof Error ? err.message : err);
  return "No se pudo guardar. Intenta de nuevo.";
}

/** Busca un inmueble por su código ("1006") o por su slug. Vacío = sin inmueble (undefined); no encontrado = null. */
async function inmuebleDe(codigo: string): Promise<{ id: string } | undefined | null> {
  const c = codigo.trim().toLowerCase();
  if (!c) return undefined;
  const todos = await getRepository().properties.list();
  const p = todos.find((x) => x.codigo.toLowerCase() === c || x.slug.toLowerCase() === c);
  return p ? { id: p.id } : null;
}

// ---------------------------------------------------------------- Contactos

export async function crearContactoAction(fd: FormData): Promise<void> {
  await exigirAdmin();
  const v = validarContacto({ nombre: texto(fd, "nombre"), telefono: texto(fd, "telefono"), email: texto(fd, "email"), ciudad: texto(fd, "ciudad"), notas: texto(fd, "notas") });
  if (!v.ok) volver("/admin/crm?vista=contactos", Object.values(v.errores)[0]);
  let id: string;
  try {
    const { contacto } = await getCrmStore().crearContacto(v.valor);
    id = contacto.id;
  } catch (err) {
    volver("/admin/crm?vista=contactos", mensajeDe(err));
  }
  refrescar();
  redirect(FICHA(id));
}

export async function actualizarContactoAction(fd: FormData): Promise<void> {
  await exigirAdmin();
  const id = texto(fd, "id");
  if (!UUID.test(id)) return;
  const v = validarContacto({ nombre: texto(fd, "nombre"), telefono: texto(fd, "telefono"), email: texto(fd, "email"), ciudad: texto(fd, "ciudad"), notas: texto(fd, "notas") });
  if (!v.ok) volver(FICHA(id), Object.values(v.errores)[0]);
  try {
    // Un campo que se deja vacío se borra: se envía explícitamente para limpiar el valor anterior.
    await getCrmStore().actualizarContacto(id, {
      nombre: v.valor.nombre,
      telefono: v.valor.telefono,
      telefonoE164: v.valor.telefonoE164,
      email: v.valor.email,
      ciudad: v.valor.ciudad,
      notas: v.valor.notas,
    });
  } catch (err) {
    volver(FICHA(id), mensajeDe(err));
  }
  refrescar(id);
}

export async function archivarContactoAction(fd: FormData): Promise<void> {
  await exigirAdmin();
  const id = texto(fd, "id");
  if (!UUID.test(id)) return;
  await getCrmStore().archivarContacto(id, texto(fd, "archivado") === "1");
  refrescar(id);
}

// ---------------------------------------------------------------- Vendedores

export async function crearCaptacionAction(fd: FormData): Promise<void> {
  await exigirAdmin();
  const contactoId = texto(fd, "contactoId");
  if (!UUID.test(contactoId)) return;
  const ruta = FICHA(contactoId);
  const precio = leerPrecio(texto(fd, "precio"));
  const pct = leerPorcentaje(texto(fd, "pct"));
  if (precio === null) volver(ruta, "Revisa el precio: usa solo números.");
  if (pct === null) volver(ruta, "Revisa el porcentaje: debe estar entre 0 y 100.");
  const inmueble = await inmuebleDe(texto(fd, "codigo"));
  if (inmueble === null) volver(ruta, "No encontré ese código de inmueble.");
  try {
    await getCrmStore().crearCaptacion({
      contactoId,
      ...(inmueble ? { propertyId: inmueble.id } : {}),
      ...(texto(fd, "ubicacion") ? { ubicacion: texto(fd, "ubicacion").slice(0, 160) } : {}),
      ...(precio !== undefined ? { precioEsperado: precio } : {}),
      comisionPct: pct,
      estatusPago: elegir(texto(fd, "estatusPago"), ESTATUS_PAGO) ?? "pendiente",
      aprobada: false,
      multimedia: "por_coordinar",
      estado: "nueva",
      ...(texto(fd, "notas") ? { notas: texto(fd, "notas").slice(0, 2000) } : {}),
    });
  } catch (err) {
    volver(ruta, mensajeDe(err));
  }
  refrescar(contactoId);
}

export async function actualizarCaptacionAction(fd: FormData): Promise<void> {
  await exigirAdmin();
  const id = texto(fd, "id");
  const contactoId = texto(fd, "contactoId");
  if (!UUID.test(id) || !UUID.test(contactoId)) return;
  const ruta = FICHA(contactoId);
  const precio = leerPrecio(texto(fd, "precio"));
  const pct = leerPorcentaje(texto(fd, "pct"));
  if (precio === null) volver(ruta, "Revisa el precio: usa solo números.");
  if (pct === null) volver(ruta, "Revisa el porcentaje: debe estar entre 0 y 100.");
  const inmueble = await inmuebleDe(texto(fd, "codigo"));
  if (inmueble === null) volver(ruta, "No encontré ese código de inmueble.");
  try {
    await getCrmStore().actualizarCaptacion(id, {
      propertyId: inmueble?.id,
      ubicacion: texto(fd, "ubicacion").slice(0, 160) || undefined,
      notas: texto(fd, "notas").slice(0, 2000) || undefined,
      precioEsperado: precio,
      comisionPct: pct,
      estatusPago: elegir(texto(fd, "estatusPago"), ESTATUS_PAGO) ?? ("pendiente" as EstatusPago),
      aprobada: fd.get("aprobada") === "on",
      multimedia: elegir(texto(fd, "multimedia"), MULTIMEDIA) ?? ("por_coordinar" as Multimedia),
      estado: elegir(texto(fd, "estado"), ESTADOS_CAPTACION) ?? ("nueva" as EstadoCaptacion),
    });
  } catch (err) {
    volver(ruta, mensajeDe(err));
  }
  refrescar(contactoId);
}

// ---------------------------------------------------------------- Compradores

export async function crearBusquedaAction(fd: FormData): Promise<void> {
  await exigirAdmin();
  const contactoId = texto(fd, "contactoId");
  if (!UUID.test(contactoId)) return;
  const ruta = FICHA(contactoId);
  const precio = leerPrecio(texto(fd, "precioMax"));
  if (precio === null) volver(ruta, "Revisa el presupuesto: usa solo números.");
  try {
    await getCrmStore().crearBusqueda({
      contactoId,
      tipo: elegir(texto(fd, "tipo"), TIPOS_COMPRADOR) ?? "comprador",
      ...(texto(fd, "ubicacion") ? { ubicacion: texto(fd, "ubicacion").slice(0, 160) } : {}),
      ...(precio !== undefined ? { precioMax: precio } : {}),
      ...(texto(fd, "especificacion") ? { especificacion: texto(fd, "especificacion").slice(0, 600) } : {}),
      potencial: fd.get("potencial") === "on",
      estado: "activa",
    });
  } catch (err) {
    volver(ruta, mensajeDe(err));
  }
  refrescar(contactoId);
}

export async function actualizarBusquedaAction(fd: FormData): Promise<void> {
  await exigirAdmin();
  const id = texto(fd, "id");
  const contactoId = texto(fd, "contactoId");
  if (!UUID.test(id) || !UUID.test(contactoId)) return;
  const ruta = FICHA(contactoId);
  const precio = leerPrecio(texto(fd, "precioMax"));
  if (precio === null) volver(ruta, "Revisa el presupuesto: usa solo números.");
  try {
    await getCrmStore().actualizarBusqueda(id, {
      tipo: elegir(texto(fd, "tipo"), TIPOS_COMPRADOR) ?? ("comprador" as TipoComprador),
      ubicacion: texto(fd, "ubicacion").slice(0, 160) || undefined,
      precioMax: precio,
      especificacion: texto(fd, "especificacion").slice(0, 600) || undefined,
      potencial: fd.get("potencial") === "on",
      estado: elegir(texto(fd, "estado"), ESTADOS_BUSQUEDA) ?? ("activa" as EstadoBusqueda),
    });
  } catch (err) {
    volver(ruta, mensajeDe(err));
  }
  refrescar(contactoId);
}

/** Propone un inmueble a una búsqueda: por su código escrito o por el id de una sugerencia. */
export async function proponerInmuebleAction(fd: FormData): Promise<void> {
  await exigirAdmin();
  const busquedaId = texto(fd, "busquedaId");
  const contactoId = texto(fd, "contactoId");
  if (!UUID.test(busquedaId) || !UUID.test(contactoId)) return;
  const ruta = FICHA(contactoId);
  let propertyId = texto(fd, "propertyId");
  if (propertyId) {
    // Viene de una sugerencia: se comprueba que el inmueble exista antes de enlazarlo.
    if (!ID_INMUEBLE.test(propertyId) || !(await getRepository().properties.getById(propertyId))) volver(ruta, "Ese inmueble ya no existe.");
  } else {
    const inmueble = await inmuebleDe(texto(fd, "codigo"));
    if (!inmueble) volver(ruta, inmueble === null ? "No encontré ese código de inmueble." : "Escribe el código del inmueble.");
    propertyId = inmueble.id;
  }
  try {
    await getCrmStore().proponer(busquedaId, propertyId);
  } catch (err) {
    volver(ruta, mensajeDe(err));
  }
  refrescar(contactoId);
}

export async function estadoPropuestaAction(fd: FormData): Promise<void> {
  await exigirAdmin();
  const busquedaId = texto(fd, "busquedaId");
  const propertyId = texto(fd, "propertyId");
  const contactoId = texto(fd, "contactoId");
  const estado = elegir(texto(fd, "estado"), ESTADOS_PROPUESTA) as EstadoPropuesta | null;
  if (!UUID.test(busquedaId) || !ID_INMUEBLE.test(propertyId) || !UUID.test(contactoId) || !estado) return;
  await getCrmStore().cambiarEstadoPropuesta(busquedaId, propertyId, estado);
  refrescar(contactoId);
}

export async function quitarPropuestaAction(fd: FormData): Promise<void> {
  await exigirAdmin();
  const busquedaId = texto(fd, "busquedaId");
  const propertyId = texto(fd, "propertyId");
  const contactoId = texto(fd, "contactoId");
  if (!UUID.test(busquedaId) || !ID_INMUEBLE.test(propertyId) || !UUID.test(contactoId)) return;
  await getCrmStore().quitarPropuesta(busquedaId, propertyId);
  refrescar(contactoId);
}

// ---------------------------------------------------------------- Línea de tiempo

export async function registrarActividadAction(fd: FormData): Promise<void> {
  await exigirAdmin();
  const contactoId = texto(fd, "contactoId");
  if (!UUID.test(contactoId)) return;
  const ruta = FICHA(contactoId);
  const detalle = texto(fd, "detalle").slice(0, 2000);
  if (!detalle) volver(ruta, "Escribe qué pasó.");
  const inmueble = await inmuebleDe(texto(fd, "codigo"));
  if (inmueble === null) volver(ruta, "No encontré ese código de inmueble.");
  // Opcional: en el mismo envío se agenda el siguiente contacto (en 1, 3 o 7 días).
  const proximo = diasDeBoton(texto(fd, "proximo"));
  const crm = getCrmStore();
  try {
    await crm.registrarActividad({
      contactoId,
      tipo: elegir(texto(fd, "tipo"), TIPOS_ACTIVIDAD) ?? ("nota" as TipoActividad),
      detalle,
      ...(inmueble ? { propertyId: inmueble.id } : {}),
    });
  } catch (err) {
    volver(ruta, mensajeDe(err));
  }
  if (proximo !== undefined) {
    // La actividad ya quedó: si solo falla la fecha (p. ej. sin la 0010), se dice así para que no la repitan.
    let fallo: string | undefined;
    try {
      await crm.fijarProximoContacto(contactoId, fechaDeSeguimiento(proximo, new Date()), texto(fd, "proximoNota").slice(0, 300));
    } catch (err) {
      fallo = `La actividad quedó registrada, pero no pude agendar el próximo contacto: ${mensajeDe(err)}`;
    }
    if (fallo) {
      refrescar(contactoId);
      volver(ruta, fallo);
    }
  }
  refrescar(contactoId);
}

// ---------------------------------------------------------------- Próximo contacto

/** Solo los atajos que ofrece la ficha: 1, 3 o 7 días. */
function diasDeBoton(v: string): number | undefined {
  return ["1", "3", "7"].includes(v) ? Number(v) : undefined;
}

/** Agenda el próximo contacto: con un atajo (`dias`) o con la fecha y hora escritas (hora de Bogotá). */
export async function fijarProximoContactoAction(fd: FormData): Promise<void> {
  await exigirAdmin();
  const contactoId = texto(fd, "contactoId");
  if (!UUID.test(contactoId)) return;
  const ruta = FICHA(contactoId);
  const ahora = new Date();
  const dias = diasDeBoton(texto(fd, "dias"));
  let at: string | undefined;
  if (dias !== undefined) at = fechaDeSeguimiento(dias, ahora);
  else {
    const local = texto(fd, "fecha");
    if (!local) volver(ruta, "Elige en cuántos días o escribe la fecha del próximo contacto.");
    at = desdeHoraBogota(local);
    if (!at) volver(ruta, "Revisa la fecha del próximo contacto.");
    // Un año de margen basta; más allá casi siempre es un error de tecleo (2062 en vez de 2026).
    if (new Date(at).getTime() > ahora.getTime() + 366 * 24 * 60 * 60 * 1000) volver(ruta, "La fecha del próximo contacto está a más de un año.");
  }
  try {
    await getCrmStore().fijarProximoContacto(contactoId, at, texto(fd, "nota").slice(0, 300));
  } catch (err) {
    volver(ruta, mensajeDe(err));
  }
  refrescar(contactoId);
}

/** «Hecho»: deja en la línea de tiempo lo que se habló y borra la fecha del próximo contacto. */
export async function completarSeguimientoAction(fd: FormData): Promise<void> {
  await exigirAdmin();
  const contactoId = texto(fd, "contactoId");
  if (!UUID.test(contactoId)) return;
  const ruta = FICHA(contactoId);
  const crm = getCrmStore();
  try {
    const contacto = await crm.obtenerContacto(contactoId);
    if (!contacto) volver("/admin/crm", "Ese contacto ya no existe.");
    // Desde otra pestaña o con «Atrás»: si ya no hay pendiente, o es otro, no se anota de nuevo.
    if (!contacto.proximoContactoAt) volver(ruta, "Ese seguimiento ya estaba hecho.");
    const mostrado = texto(fd, "proximoAt");
    if (mostrado && new Date(mostrado).getTime() !== new Date(contacto.proximoContactoAt).getTime()) volver(ruta, "El próximo contacto cambió mientras tanto: revisa la ficha.");
    const nota = texto(fd, "detalle").slice(0, 2000) || contacto.proximoContactoNota || "Seguimiento hecho.";
    // Primero la actividad: si falla, la fecha sigue en pie y el pendiente no se pierde.
    await crm.registrarActividad({ contactoId, tipo: elegir(texto(fd, "tipo"), TIPOS_SEGUIMIENTO) ?? "llamada", detalle: nota });
    await crm.fijarProximoContacto(contactoId, null);
  } catch (err) {
    volver(ruta, mensajeDe(err));
  }
  refrescar(contactoId);
}

/** Quita la fecha sin registrar nada (se agendó por error). */
export async function quitarProximoContactoAction(fd: FormData): Promise<void> {
  await exigirAdmin();
  const contactoId = texto(fd, "contactoId");
  if (!UUID.test(contactoId)) return;
  try {
    await getCrmStore().fijarProximoContacto(contactoId, null);
  } catch (err) {
    volver(FICHA(contactoId), mensajeDe(err));
  }
  refrescar(contactoId);
}

// ---------------------------------------------------------------- Ventas cerradas

/** Opción del selector de comprador: "<busquedaId>|<contactoId>"; vacío = otro / no registrado. */
function leerComprador(v: string): { busquedaId: string; contactoId: string } | undefined | null {
  if (!v) return undefined;
  const [busquedaId, contactoId] = v.split("|");
  return UUID.test(busquedaId ?? "") && UUID.test(contactoId ?? "") ? { busquedaId, contactoId } : null;
}

/**
 * Registra la venta de una captación: crea el cierre, pone la captación en «vendida», marca el inmueble como
 * vendido en el catálogo (y lo refresca), cierra la búsqueda del comprador con su propuesta en «ofertó» y deja
 * la nota en la línea de tiempo de ambos. Una captación se vende una sola vez.
 */
export async function registrarCierreAction(fd: FormData): Promise<void> {
  await exigirAdmin();
  const captacionId = texto(fd, "captacionId");
  const contactoId = texto(fd, "contactoId");
  if (!UUID.test(captacionId) || !UUID.test(contactoId)) return;
  const ruta = FICHA(contactoId);
  // «Completar venta» solo manda los ids: los datos ya están en el cierre que quedó a medias.
  const completar = texto(fd, "completar") === "1";
  const v = completar ? null : validarCierre({ precio: texto(fd, "precio"), fecha: texto(fd, "fecha"), pct: texto(fd, "pct") }, new Date());
  if (v && !v.ok) volver(ruta, v.error);
  const comprador = completar ? undefined : leerComprador(texto(fd, "comprador"));
  if (comprador === null) volver(ruta, "Revisa el comprador.");
  const notas = texto(fd, "notas").slice(0, 2000);

  const crm = getCrmStore();
  const repo = getRepository();
  let aviso: string | undefined;
  let slug: string | undefined;
  try {
    const captacion = (await crm.listarCaptaciones(contactoId)).find((c) => c.id === captacionId);
    if (!captacion) volver(ruta, "No encontré esa captación.");
    if (captacion.estado === "descartada") volver(ruta, "Esa captación está descartada.");
    const propertyId = captacion.propertyId;
    const p = propertyId ? await repo.properties.getById(propertyId) : null;

    // Sin transacción entre tablas: si un paso falló después de crear el cierre, el reintento lo reutiliza y
    // completa lo que falte (todo lo de abajo es idempotente). Solo se rechaza cuando la venta ya quedó completa.
    const previo = (await crm.listarCierres({ contactoId })).find((c) => c.captacionId === captacionId);
    let cierre: Cierre;
    if (previo) {
      if (captacion.estado === "vendida") volver(ruta, "Esa venta ya está registrada.");
      cierre = previo;
    } else {
      if (!v?.ok) volver(ruta, "Esa venta no quedó a medias: regístrala con el formulario.");
      // El comprador tiene que ser otra persona a quien se le propuso este inmueble (o "otro / no registrado"),
      // con la búsqueda y la propuesta vivas: lo mismo que ofrece la ficha.
      if (comprador) {
        const busqueda = (await crm.listarBusquedas(comprador.contactoId)).find((b) => b.id === comprador.busquedaId);
        const propuesta = propertyId ? (await crm.listarPropuestas([comprador.busquedaId])).find((x) => x.propertyId === propertyId) : undefined;
        if (!busqueda || busqueda.estado === "descartada" || !propuesta || propuesta.estado === "descartado" || comprador.contactoId === contactoId) {
          volver(ruta, "Ese comprador no tiene propuesto este inmueble.");
        }
      }
      cierre = await crm.registrarCierre({
        captacionId,
        ...(propertyId ? { propertyId } : {}),
        vendedorContactoId: contactoId,
        ...(comprador ? { busquedaId: comprador.busquedaId, compradorContactoId: comprador.contactoId } : {}),
        ...v.valor,
        ...(notas ? { notas } : {}),
      });
    }

    const nombreInmueble = p ? `${p.codigo} («${p.titulo}»)` : captacion.ubicacion ? `en ${captacion.ubicacion}` : "sin ficha";
    const resumen =
      `por ${formatPrice(cierre.precioVenta)} el ${cierre.fechaCierre}` +
      (cierre.comisionPactada !== undefined ? `. Comisión pactada: ${formatPrice(cierre.comisionPactada)}` : "") +
      (cierre.comisionPct !== undefined ? ` (${cierre.comisionPct} %)` : "") +
      ".";
    /** En un reintento, la nota que ya quedó no se repite. */
    const anotar = async (quien: string, detalle: string) => {
      if (previo && (await crm.listarActividades(quien)).some((a) => a.detalle === detalle)) return;
      await crm.registrarActividad({ contactoId: quien, tipo: "nota", detalle, ...(propertyId ? { propertyId } : {}) });
    };

    if (cierre.busquedaId) {
      // "Ofertó" es lo más avanzado que tiene una propuesta; la búsqueda queda cerrada.
      if (cierre.propertyId) await crm.cambiarEstadoPropuesta(cierre.busquedaId, cierre.propertyId, "oferto");
      await crm.actualizarBusqueda(cierre.busquedaId, { estado: "cerrada" });
    }
    await anotar(contactoId, `Venta registrada: inmueble ${nombreInmueble} ${resumen}`);
    if (cierre.compradorContactoId) {
      await anotar(cierre.compradorContactoId, `Compró el inmueble ${nombreInmueble} ${resumen}`);
      refrescar(cierre.compradorContactoId);
    }
    // Lo último del CRM: con la captación vendida, la venta se da por completa y no se ofrece reintentar.
    await crm.actualizarCaptacion(captacionId, { estado: "vendida" });

    // El catálogo va aparte: si falla, la venta ya quedó y se avisa para hacerlo a mano.
    if (p && p.estado !== "vendido") {
      try {
        const actualizado = await repo.properties.update(p.id, { estado: "vendido" });
        slug = actualizado?.slug ?? p.slug;
        if (actualizado && isSheetsConfigured()) await syncPropertyToSheet(actualizado).catch((err) => console.error("[crm] Sheets al vender:", err instanceof Error ? err.message : err));
      } catch (err) {
        console.error("[crm] no se pudo marcar el inmueble como vendido:", err instanceof Error ? err.message : err);
        aviso = "La venta quedó registrada, pero no pude marcar el inmueble como vendido en el catálogo: hazlo desde Inmuebles.";
      }
    }
  } catch (err) {
    volver(ruta, mensajeDe(err));
  }
  if (slug) revalidarCatalogoPublico(slug);
  revalidatePath("/admin/reportes");
  refrescar(contactoId);
  if (aviso) volver(ruta, aviso);
}

export async function marcarComisionCobradaAction(fd: FormData): Promise<void> {
  await exigirAdmin();
  const id = texto(fd, "id");
  const contactoId = texto(fd, "contactoId");
  if (!UUID.test(id) || !UUID.test(contactoId)) return;
  const ruta = FICHA(contactoId);
  const monto = leerPrecio(texto(fd, "monto"));
  if (monto === null || monto === undefined) volver(ruta, "Escribe cuánto se cobró de comisión (solo números).");
  const fecha = leerDia(texto(fd, "fecha"));
  if (!fecha) volver(ruta, "Revisa la fecha del cobro.");
  if (fecha > diaBogota(new Date(Date.now() + 24 * 60 * 60 * 1000))) volver(ruta, "La fecha del cobro no puede estar en el futuro.");
  try {
    const crm = getCrmStore();
    const cierre = (await crm.listarCierres({ contactoId })).find((c) => c.id === id);
    if (!cierre) volver(ruta, "No encontré esa venta.");
    await crm.marcarComisionCobrada(id, monto, fecha);
    for (const otro of [cierre.vendedorContactoId, cierre.compradorContactoId]) if (otro && otro !== contactoId) refrescar(otro);
  } catch (err) {
    volver(ruta, mensajeDe(err));
  }
  revalidatePath("/admin/reportes");
  refrescar(contactoId);
}

// ---------------------------------------------------------------- Desde un lead y sincronización

/**
 * Pasa un lead del formulario al CRM: crea (o reutiliza por teléfono) al contacto, abre su captación o
 * su búsqueda y deja la nota con el mensaje. Es idempotente: repetirlo no duplica nada.
 */
export async function pasarLeadAlCrmAction(fd: FormData): Promise<void> {
  await exigirAdmin();
  const leadId = texto(fd, "leadId");
  if (!UUID.test(leadId)) return;
  const lead = (await getRepository().leads.list()).find((l) => l.id === leadId);
  if (!lead) volver("/admin/leads", "No encontré ese lead.");

  let contactoId: string;
  try {
    const v = await vincularLead(getCrmStore(), lead);
    if (!v) volver("/admin/leads", "Revisa el nombre del lead: no se pudo crear el contacto.");
    contactoId = v.contactoId;
  } catch (err) {
    volver("/admin/leads", mensajeDe(err));
  }
  refrescar();
  redirect(FICHA(contactoId));
}

/** Carga en el CRM todo lo que ya existe: propietarios de los inmuebles, leads y compradores de planes. */
export async function sincronizarCrmAction(): Promise<void> {
  await exigirAdmin();
  let mensaje: string;
  try {
    const repo = getRepository();
    const [propiedades, leads] = await Promise.all([repo.properties.list(), repo.leads.list()]);
    const serviciosStore = getServiciosStore();
    const servicios = await serviciosStore.listar().catch(() => []);
    // Los planes sin fecha de pago de Wompi la completan ahora (los anteriores a 0008 solo tenían la de registro).
    let fechasCompletadas = 0;
    for (const s of servicios.filter((x) => !x.pagadoAt && x.txId).slice(0, 50)) {
      try {
        const tx = await fetchTransaction(s.txId);
        const cuando = tx?.finalizedAt ?? tx?.createdAt;
        if (cuando) {
          await serviciosStore.fijarPagadoAt(s.id, cuando);
          fechasCompletadas += 1;
        }
      } catch {
        /* sin Wompi o sin la columna: se deja para la próxima */
      }
    }
    const r = await sincronizarTodo(getCrmStore(), { propiedades, leads, servicios }, { asignarContactoAServicio: (id, contactoId) => serviciosStore.asignarContacto(id, contactoId) });
    const errores = r.inmuebles.errores + r.leads.errores + r.servicios.errores;
    mensaje =
      `Listo. Inmuebles: ${r.inmuebles.creada} vendedores nuevos, ${r.inmuebles.actualizada} al día, ${r.inmuebles.sin_propietario} sin propietario cargado. ` +
      `Leads: ${r.leads.vinculados} nuevos en el CRM (${r.leads.omitidos} descartados u omitidos). ` +
      `Planes: ${r.servicios.creados} compradores nuevos, ${fechasCompletadas} fechas de pago completadas.` +
      (errores ? ` Hubo ${errores} con error (revisa los registros del servidor).` : "");
  } catch (err) {
    volver("/admin/crm", mensajeDe(err));
  }
  refrescar();
  redirect(`/admin/crm?vista=contactos&listo=${encodeURIComponent(mensaje)}`);
}
