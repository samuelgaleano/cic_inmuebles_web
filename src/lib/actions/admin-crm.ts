"use server";

import { revalidatePath } from "next/cache";
import { redirect } from "next/navigation";
import { exigirAdmin } from "@/lib/auth";
import { CrmNoDisponibleError, CrmStoreError, getCrmStore } from "@/lib/crm/store";
import { leerPorcentaje, leerPrecio, validarContacto } from "@/lib/crm/reglas";
import {
  ESTADOS_BUSQUEDA,
  ESTADOS_CAPTACION,
  ESTADOS_PROPUESTA,
  ESTATUS_PAGO,
  MULTIMEDIA,
  TIPOS_ACTIVIDAD,
  TIPOS_COMPRADOR,
  type EstadoBusqueda,
  type EstadoCaptacion,
  type EstadoPropuesta,
  type EstatusPago,
  type Multimedia,
  type TipoActividad,
  type TipoComprador,
} from "@/lib/crm/tipos";
import { getRepository } from "@/lib/data";
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
  if (err instanceof CrmNoDisponibleError) return "Falta crear las tablas del CRM (migración 0007 en Supabase).";
  if (err instanceof CrmStoreError) {
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
  try {
    await getCrmStore().registrarActividad({
      contactoId,
      tipo: elegir(texto(fd, "tipo"), TIPOS_ACTIVIDAD) ?? ("nota" as TipoActividad),
      detalle,
      ...(inmueble ? { propertyId: inmueble.id } : {}),
    });
  } catch (err) {
    volver(ruta, mensajeDe(err));
  }
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
    const servicios = await getServiciosStore().listar().catch(() => []);
    const r = await sincronizarTodo(getCrmStore(), { propiedades, leads, servicios });
    const errores = r.inmuebles.errores + r.leads.errores + r.servicios.errores;
    mensaje =
      `Listo. Inmuebles: ${r.inmuebles.creada} vendedores nuevos, ${r.inmuebles.actualizada} al día, ${r.inmuebles.sin_propietario} sin propietario cargado. ` +
      `Leads: ${r.leads.vinculados} nuevos en el CRM (${r.leads.omitidos} descartados u omitidos). ` +
      `Planes: ${r.servicios.creados} compradores nuevos.` +
      (errores ? ` Hubo ${errores} con error (revisa los registros del servidor).` : "");
  } catch (err) {
    volver("/admin/crm", mensajeDe(err));
  }
  refrescar();
  redirect(`/admin/crm?vista=contactos&listo=${encodeURIComponent(mensaje)}`);
}
