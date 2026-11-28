import { getPlan } from "@/lib/config/plans";
import type { Lead, Property } from "@/lib/domain";
import type { Servicio } from "@/lib/servicios/vigencia";
import { sinTildes, validarContacto } from "./reglas";
import type { CrmStore } from "./store";
import { marcaDe, type Contacto, type EstadoCaptacion } from "./tipos";

/**
 * Lo que enlaza el CRM con el resto de la plataforma: los leads del formulario, los inmuebles con su
 * propietario y los planes de publicación pagados. Todo es idempotente (repetirlo no duplica nada) y se
 * usa tanto a mano (botón «Sincronizar») como solo, cada vez que llega un lead, se paga un plan o se guarda un inmueble.
 */

/**
 * Persona del CRM para estos datos: por teléfono si lo hay; si no, por correo (los compradores de planes suelen
 * traer correo y no teléfono, y con otro nombre legal) y, por último, por nombre exacto entre los que no tienen teléfono.
 */
export async function contactoDe(
  crm: CrmStore,
  datos: { nombre: string; telefono?: string; email?: string; ciudad?: string; origen: Contacto["origen"] },
): Promise<{ contacto: Contacto; creado: boolean } | null> {
  const base = { nombre: datos.nombre, email: datos.email, ciudad: datos.ciudad, origen: datos.origen };
  const completo = validarContacto({ ...base, telefono: datos.telefono });
  // Un teléfono mal escrito no debe impedir el registro: se guarda la persona y el número queda en la nota.
  const v = completo.ok ? completo : validarContacto({ ...base, notas: datos.telefono ? `Teléfono recibido (no válido): ${datos.telefono}` : undefined });
  if (!v.ok) return null;

  if (!v.valor.telefonoE164 && v.valor.email) {
    const porCorreo = await crm.buscarPorEmail(v.valor.email);
    if (porCorreo) return { contacto: porCorreo, creado: false };
  }
  if (!v.valor.telefonoE164) {
    const clave = sinTildes(v.valor.nombre);
    // Una página filtrada por el nombre basta: el que coincide exacto está entre los que lo contienen.
    const { filas } = await crm.paginaContactos({ q: v.valor.nombre, incluirArchivados: true, porPagina: 200 });
    const mismo = filas.find((c) => !c.telefonoE164 && sinTildes(c.nombre) === clave);
    if (mismo) return { contacto: mismo, creado: false };
  }
  return crm.crearContacto(v.valor);
}

/** Lo que buscaba, sin el arranque «Avísenme si llega:» que pone el formulario del catálogo. */
export function especificacionDeAlerta(mensaje: string | undefined): string | undefined {
  const t = mensaje?.replace(/^\s*av[ií]s[ae]nme(\s+si\s+llega)?\s*[:,-]?\s*/i, "").trim();
  return t || undefined;
}

export interface VinculoLead {
  contactoId: string;
  /** false si este lead ya estaba pasado al CRM. */
  nuevo: boolean;
}

/**
 * Pasa un lead del formulario al CRM: persona, captación o búsqueda, e inmueble propuesto si preguntó por uno.
 * Idempotente por llave (0013): la captación o búsqueda y la nota llevan el id del lead con índice único, así que
 * repetirlo (o dos envíos a la vez) no duplica nada. Sin la 0013 se reconoce por la marca `[lead:<id>]` de la nota.
 * Un lead suprimido (Ley 1581) no vuelve a entrar.
 */
export async function vincularLead(crm: CrmStore, lead: Lead): Promise<VinculoLead | null> {
  if (lead.suprimidoAt) return null;
  const r = await contactoDe(crm, { nombre: lead.nombre, telefono: lead.telefono, email: lead.email, ciudad: lead.ciudad, origen: lead.fuente });
  if (!r) return null;
  const { contacto } = r;
  // Si la persona estaba archivada y vuelve a escribir, vuelve a la lista: si no, su lead quedaría colgado de alguien invisible.
  if (contacto.archivado) {
    await crm.archivarContacto(contacto.id, false).catch((err) => console.error("[crm] no se pudo desarchivar:", err instanceof Error ? err.message : err));
  }
  // La llave foránea se asegura siempre, también para leads que ya se habían pasado antes de existir.
  await crm.enlazarLead(lead.id, contacto.id).catch((err) => console.error("[crm] no se pudo enlazar el lead:", err instanceof Error ? err.message : err));

  const llave = { tipo: "lead" as const, id: lead.id };
  if (await crm.existeActividad(llave, contacto.id)) return { contactoId: contacto.id, nuevo: false };

  if (lead.tipo === "vendedor") {
    await crm.crearCaptacion(
      {
        contactoId: contacto.id,
        ...(lead.tipoInmueble || lead.ciudad ? { ubicacion: [lead.tipoInmueble, lead.ciudad].filter(Boolean).join(" · ") } : {}),
        comisionPct: 3,
        estatusPago: "pendiente",
        aprobada: false,
        multimedia: "por_coordinar",
        estado: "nueva",
      },
      { leadId: lead.id },
    );
  } else {
    // «Avísenme cuando llegue uno»: lo que escribió ES la búsqueda (sin el «Avísenme si llega:» del formulario).
    const especificacion = lead.intencion === "alerta" ? especificacionDeAlerta(lead.mensaje) : lead.mensaje?.trim();
    const b = await crm.crearBusqueda(
      {
        contactoId: contacto.id,
        tipo: "comprador",
        ...(especificacion ? { especificacion: especificacion.slice(0, 600) } : {}),
        potencial: false,
        estado: "activa",
        ...(lead.intencion === "alerta" ? { notas: "Pidió aviso desde el catálogo: no encontró lo que buscaba." } : {}),
      },
      { leadId: lead.id },
    );
    if (lead.propertyId) {
      await crm.proponer(b.id, lead.propertyId).catch((err) => console.warn("[crm] no se pudo proponer el inmueble del lead:", err instanceof Error ? err.message : err));
    }
  }
  const intencion =
    lead.intencion === "visita"
      ? "quiere agendar una visita"
      : lead.intencion === "info"
        ? "pidió más información"
        : lead.intencion === "alerta"
          ? "pidió que le avisen cuando llegue un inmueble así"
          : "dejó sus datos";
  const nota = {
    contactoId: contacto.id,
    tipo: "nota" as const,
    detalle: `Lead del formulario web ${marcaDe(llave)}: ${intencion}${lead.propertySlug ? ` (${lead.propertySlug})` : ""}.${lead.mensaje ? ` Mensaje: ${lead.mensaje}` : ""}`.slice(0, 2000),
  };
  // Si el inmueble por el que preguntó ya no existe, la nota se guarda igual, sin enlazarlo.
  const r2 = await crm
    .registrarActividadUnica({ ...nota, ...(lead.propertyId ? { propertyId: lead.propertyId } : {}) }, llave)
    .catch(() => crm.registrarActividadUnica(nota, llave));
  return { contactoId: contacto.id, nuevo: r2.nueva };
}

/** Estado de la captación que corresponde al estado del inmueble en el catálogo. */
export function estadoCaptacionDe(p: Pick<Property, "estado" | "publicado">): EstadoCaptacion {
  if (p.estado === "vendido") return "vendida";
  if (p.estado === "en_proceso") return "en_gestion";
  if (p.publicado) return "publicada";
  return "nueva";
}

export type ResultadoInmueble = "creada" | "existia" | "actualizada" | "sin_propietario" | "sin_datos";

/**
 * Enlaza el inmueble con su propietario: crea a la persona y su captación (vendedor) apuntando al inmueble,
 * con el precio del catálogo, o la mantiene al día con el estado del inmueble. No toca lo que el equipo ya
 * gestionó (pago, comisión, aprobación) ni las captaciones descartadas.
 */
export async function vincularInmueble(crm: CrmStore, p: Property): Promise<ResultadoInmueble> {
  const dueno = p.propietario;
  if (!dueno?.nombre?.trim()) return "sin_propietario";

  const vigente = await crm.captacionVigenteDe(p.id);
  const deseado = estadoCaptacionDe(p);
  if (vigente) {
    const automatico: EstadoCaptacion[] = ["nueva", "en_gestion", "publicada"];
    if (vigente.estado !== deseado && (automatico.includes(vigente.estado) || deseado === "vendida")) {
      await crm.actualizarCaptacion(vigente.id, { estado: deseado });
      return "actualizada";
    }
    return "existia";
  }

  const r = await contactoDe(crm, { nombre: dueno.nombre, telefono: dueno.telefono, email: dueno.email, ciudad: p.ubicacion.ciudad, origen: "manual" });
  if (!r) return "sin_datos";
  const ubicacion = [p.ubicacion.sector, p.ubicacion.ciudad].filter(Boolean).join(", ");
  await crm.crearCaptacion({
    contactoId: r.contacto.id,
    propertyId: p.id,
    ...(ubicacion ? { ubicacion: ubicacion.slice(0, 160) } : {}),
    ...(p.precio > 0 ? { precioEsperado: p.precio } : {}),
    comisionPct: 3,
    estatusPago: "pendiente",
    // Si CIC ya lo publicó, está aprobado; las fotos cargadas indican que la coordinación terminó.
    aprobada: p.publicado,
    multimedia: p.medios.length > 0 ? "listo" : "por_coordinar",
    estado: deseado,
  });
  await crm.registrarActividad({
    contactoId: r.contacto.id,
    tipo: "nota",
    detalle: `Inmueble ${p.codigo} («${p.titulo}») enlazado desde el catálogo. [inmueble:${p.id}]`,
    propertyId: p.id,
  });
  return "creada";
}

export type ResultadoServicio = "creado" | "existia" | "sin_datos";

/** Un plan de publicación pagado deja a su comprador en el CRM, con la compra en su línea de tiempo. */
export async function vincularServicio(
  crm: CrmStore,
  s: Servicio,
  /** Guarda la persona en el plan (llave foránea servicios_publicacion.contacto_id). */
  asignarContacto?: (servicioId: string, contactoId: string) => Promise<void>,
): Promise<ResultadoServicio> {
  const nombre = s.clienteNombre?.trim() || s.clienteEmail?.split("@")[0]?.trim();
  if (!nombre) return "sin_datos";
  const r = await contactoDe(crm, { nombre, telefono: s.clienteTelefono ?? undefined, email: s.clienteEmail ?? undefined, origen: "web" });
  if (!r) return "sin_datos";
  if (asignarContacto && s.contactoId !== r.contacto.id) {
    await asignarContacto(s.id, r.contacto.id).catch((err) => console.error("[crm] no se pudo enlazar el plan:", err instanceof Error ? err.message : err));
  }
  // Un plan descartado (prueba, reembolso) queda enlazado a su persona como historia, sin sumar a su seguimiento.
  if (s.estado === "descartado") return "sin_datos";

  // Idempotente por llave (actividades.servicio_id, 0013) o, sin ella, por la marca `[servicio:<id>]`.
  const llave = { tipo: "servicio" as const, id: s.id };
  const plan = getPlan(s.planId)?.nombre ?? s.planId;
  const { nueva } = await crm.registrarActividadUnica(
    {
      contactoId: r.contacto.id,
      tipo: "nota",
      detalle: `Compró el plan «${plan}» (${s.dias} días) desde la web. ${marcaDe(llave)}`,
      ocurrioEn: s.createdAt,
    },
    llave,
  );
  return nueva ? "creado" : "existia";
}

export interface ResumenSincronizacion {
  inmuebles: Record<ResultadoInmueble | "errores", number>;
  leads: { vinculados: number; yaEstaban: number; omitidos: number; errores: number };
  servicios: { creados: number; yaEstaban: number; omitidos: number; errores: number };
}

/** Pone al día el CRM con todo lo que ya existe en la plataforma. Un fallo en un registro no frena los demás. */
export async function sincronizarTodo(
  crm: CrmStore,
  datos: { propiedades: Property[]; leads: Lead[]; servicios: Servicio[] },
  opciones: { asignarContactoAServicio?: (servicioId: string, contactoId: string) => Promise<void> } = {},
): Promise<ResumenSincronizacion> {
  const r: ResumenSincronizacion = {
    inmuebles: { creada: 0, existia: 0, actualizada: 0, sin_propietario: 0, sin_datos: 0, errores: 0 },
    leads: { vinculados: 0, yaEstaban: 0, omitidos: 0, errores: 0 },
    servicios: { creados: 0, yaEstaban: 0, omitidos: 0, errores: 0 },
  };
  for (const p of datos.propiedades) {
    try {
      r.inmuebles[await vincularInmueble(crm, p)] += 1;
    } catch (err) {
      r.inmuebles.errores += 1;
      console.error("[crm/sincronizar] inmueble:", err instanceof Error ? err.message : err);
    }
  }
  for (const l of datos.leads) {
    if (l.estado === "descartado" || l.suprimidoAt) {
      r.leads.omitidos += 1; // spam o descartado a mano: no es una persona para el CRM
      continue;
    }
    try {
      const v = await vincularLead(crm, l);
      if (!v) r.leads.omitidos += 1;
      else if (v.nuevo) r.leads.vinculados += 1;
      else r.leads.yaEstaban += 1;
    } catch (err) {
      r.leads.errores += 1;
      console.error("[crm/sincronizar] lead:", err instanceof Error ? err.message : err);
    }
  }
  for (const s of datos.servicios) {
    try {
      const v = await vincularServicio(crm, s, opciones.asignarContactoAServicio);
      if (v === "creado") r.servicios.creados += 1;
      else if (v === "existia") r.servicios.yaEstaban += 1;
      else r.servicios.omitidos += 1;
    } catch (err) {
      r.servicios.errores += 1;
      console.error("[crm/sincronizar] servicio:", err instanceof Error ? err.message : err);
    }
  }
  return r;
}
