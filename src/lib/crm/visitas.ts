import type { Appointment, Property } from "@/lib/domain";
import type { CrmStore } from "./store";
import { marcaDe } from "./tipos";
import { contactoDe } from "./vinculos";

/**
 * Una sola visita en todo el sistema: la cita de la agenda, cuando se marca «realizada», queda en la línea de
 * tiempo de la persona (actividad «visita») y la propuesta de ese inmueble pasa a «visitó». Antes la visita se
 * anotaba en cuatro lugares que no se hablaban.
 */

export type ResultadoPropuesta = "visito" | "ya_avanzada" | "propuesta_creada" | "sin_busqueda";

export interface ResultadoVisita {
  contactoId: string;
  /** false si la cita ya se había registrado (marcarla «realizada» dos veces no duplica). */
  actividadNueva: boolean;
  propuesta: ResultadoPropuesta;
}

/** "5 dic 2026, 3:00 p. m." en hora de Bogotá. */
function fechaCorta(iso: string): string {
  return new Date(iso).toLocaleString("es-CO", { timeZone: "America/Bogota", day: "numeric", month: "short", year: "numeric", hour: "numeric", minute: "2-digit" });
}

/**
 * Registra en el CRM una cita realizada. La persona es la de la cita (`contactoId`) o, si la cita no la trae,
 * la que tenga su teléfono (se crea si no existe). Idempotente: la actividad lleva la llave de la cita.
 */
export async function registrarVisitaRealizada(crm: CrmStore, cita: Appointment, inmueble?: Pick<Property, "id" | "codigo" | "titulo"> | null): Promise<ResultadoVisita | null> {
  let contactoId = cita.contactoId;
  if (!contactoId || !(await crm.obtenerContacto(contactoId))) {
    const r = await contactoDe(crm, { nombre: cita.clienteNombre, telefono: cita.clienteTelefono, email: cita.clienteEmail, origen: "manual" });
    if (!r) return null;
    contactoId = r.contacto.id;
  }

  const llave = { tipo: "cita" as const, id: cita.id };
  const que = inmueble ? `${inmueble.codigo} («${inmueble.titulo}»)` : "el inmueble";
  const actividad = { contactoId, tipo: "visita" as const, detalle: `Visitó ${que} el ${fechaCorta(cita.inicioEn)}. ${marcaDe(llave)}`, ocurrioEn: cita.inicioEn };
  // Si el inmueble ya no existe, la visita queda igual, sin enlazarlo.
  const { nueva } = await crm
    .registrarActividadUnica({ ...actividad, propertyId: cita.propertyId }, llave)
    .catch(() => crm.registrarActividadUnica(actividad, llave));

  const propuesta = await avanzarPropuesta(crm, contactoId, cita.propertyId);
  return { contactoId, actividadNueva: nueva, propuesta };
}

/**
 * La propuesta de ese inmueble pasa a «visitó» (nunca retrocede una que ya ofertó). Si la persona busca algo
 * pero ese inmueble no se le había propuesto, se le propone ya visitado en su búsqueda viva más reciente.
 */
async function avanzarPropuesta(crm: CrmStore, contactoId: string, propertyId: string): Promise<ResultadoPropuesta> {
  const busquedas = (await crm.listarBusquedas(contactoId)).filter((b) => b.estado !== "descartada" && b.estado !== "cerrada");
  if (!busquedas.length) return "sin_busqueda";
  const propuestas = await crm.listarPropuestas(busquedas.map((b) => b.id));
  const suya = propuestas.find((p) => p.propertyId === propertyId);
  let resultado: ResultadoPropuesta;
  let busquedaId: string;
  if (suya) {
    busquedaId = suya.busquedaId;
    if (suya.estado === "propuesto" || suya.estado === "descartado") {
      await crm.cambiarEstadoPropuesta(suya.busquedaId, propertyId, "visito");
      resultado = "visito";
    } else resultado = "ya_avanzada";
  } else {
    const viva = [...busquedas].sort((a, b) => b.creadoEn.localeCompare(a.creadoEn))[0];
    busquedaId = viva.id;
    try {
      await crm.proponer(viva.id, propertyId);
      await crm.cambiarEstadoPropuesta(viva.id, propertyId, "visito");
      resultado = "propuesta_creada";
    } catch {
      return "sin_busqueda"; // el inmueble ya no existe
    }
  }
  const b = busquedas.find((x) => x.id === busquedaId);
  if (b?.estado === "activa") await crm.actualizarBusqueda(b.id, { estado: "en_visitas" });
  return resultado;
}
