import { siteConfig } from "@/lib/config/site";
import { NOMBRE_SUPRIMIDO } from "@/lib/domain/lead";
import { formatPrice } from "@/lib/utils/format";
import { enlaceWhatsApp } from "@/lib/utils/telefono";

/**
 * Mensajes de WhatsApp por etapa del CRM. Son funciones puras: arman el texto con lo que se sabe de la
 * persona y del inmueble, y nunca dejan un hueco («Hola ,», «undefined», «el  a las»): si falta un dato,
 * la frase se arma sin él o la plantilla no se ofrece. Tuteo y tono directo, como habla CIC.
 */

export interface InmuebleMensaje {
  titulo: string;
  slug: string;
  precio?: number;
  sector?: string;
}

export const PLANTILLAS = ["primer_comprador", "primer_propietario", "confirmar_visita", "despues_visita", "similar", "seguimiento_vendedor"] as const;
export type IdPlantilla = (typeof PLANTILLAS)[number];

export const ETIQUETA_PLANTILLA: Record<IdPlantilla, string> = {
  primer_comprador: "Primer contacto (comprador)",
  primer_propietario: "Primer contacto (propietario)",
  confirmar_visita: "Confirmar la visita",
  despues_visita: "Después de la visita",
  similar: "Proponer un inmueble similar",
  seguimiento_vendedor: "Seguimiento al vendedor",
};

/** Primer nombre con mayúscula inicial ("MARÍA josé" → "María"); vacío si no hay nombre útil. */
export function primerNombre(nombre: string | undefined): string {
  const p = (nombre ?? "").trim().split(/\s+/)[0] ?? "";
  if (p.length < 2 || p === NOMBRE_SUPRIMIDO) return "";
  return p.charAt(0).toLocaleUpperCase("es-CO") + p.slice(1).toLocaleLowerCase("es-CO");
}

const hola = (nombre: string | undefined) => {
  const n = primerNombre(nombre);
  return n ? `Hola ${n}` : "Hola";
};

/** Enlace a la ficha pública, etiquetado para saber que el lead volvió por un mensaje del equipo. */
export function enlaceFicha(slug: string): string {
  const s = encodeURIComponent(slug.trim());
  return `${siteConfig.url}/inmuebles/${s}?utm_source=whatsapp&utm_medium=mensaje&utm_campaign=${s}`;
}

/** "el apartamento en Cedritos" → se usa tal cual; el título ya describe el inmueble. */
const nombreInmueble = (i: InmuebleMensaje) => {
  const t = i.titulo.trim();
  return i.sector && !t.toLowerCase().includes(i.sector.trim().toLowerCase()) ? `${t} (${i.sector.trim()})` : t;
};

/** "jueves 4 de diciembre a las 3:00 p. m." en hora de Bogotá. */
export function cuandoLegible(iso: string): string {
  const d = new Date(iso);
  const dia = d.toLocaleDateString("es-CO", { timeZone: "America/Bogota", weekday: "long", day: "numeric", month: "long" }).replace(",", "");
  const hora = d.toLocaleTimeString("es-CO", { timeZone: "America/Bogota", hour: "numeric", minute: "2-digit" });
  return `${dia} a las ${hora}`;
}

export function mensajePrimerContactoComprador(d: { nombre?: string; inmueble?: InmuebleMensaje }): string {
  if (!d.inmueble) {
    return `${hola(d.nombre)}, te escribo de CIC Inmuebles por tu mensaje en la página. Cuéntame qué estás buscando (zona, presupuesto y cuántas alcobas) y te mando opciones que encajen.`;
  }
  return `${hola(d.nombre)}, te escribo de CIC Inmuebles. Vi que te interesó ${nombreInmueble(d.inmueble)}. Aquí tienes la ficha con fotos y precio: ${enlaceFicha(d.inmueble.slug)} ¿Te queda bien que hablemos hoy o prefieres agendar una visita?`;
}

export function mensajePrimerContactoPropietario(d: { nombre?: string; queVende?: string }): string {
  const que = d.queVende?.trim() ? `vender ${d.queVende.trim()}` : "vender tu inmueble";
  return `${hola(d.nombre)}, te escribo de CIC Inmuebles. Recibimos tu solicitud para ${que}. No cobramos nada por adelantado: solo el 3 % cuando se cierra la venta. ¿Cuándo te queda bien que hablemos para conocerlo?`;
}

export function mensajeConfirmarVisita(d: { nombre?: string; inmueble: InmuebleMensaje; inicioEn: string }): string {
  // "3:00 p. m." ya termina en punto: no se le agrega otro.
  const cuando = cuandoLegible(d.inicioEn);
  return `${hola(d.nombre)}, te confirmo la visita a ${nombreInmueble(d.inmueble)} el ${cuando}${cuando.endsWith(".") ? "" : "."} ¿Sigue en pie? Si necesitas cambiar la hora, me dices por aquí.`;
}

export function mensajeDespuesDeVisita(d: { nombre?: string; inmueble: InmuebleMensaje }): string {
  return `${hola(d.nombre)}, gracias por visitar ${nombreInmueble(d.inmueble)}. ¿Qué te pareció? Si te quedó alguna duda sobre el precio, la administración o los papeles, te ayudo.`;
}

export function mensajeInmuebleSimilar(d: { nombre?: string; inmueble: InmuebleMensaje }): string {
  const precio = d.inmueble.precio && d.inmueble.precio > 0 ? `, por ${formatPrice(d.inmueble.precio)}` : "";
  return `${hola(d.nombre)}, me acordé de lo que estás buscando y tenemos ${nombreInmueble(d.inmueble)}${precio}. La ficha completa está aquí: ${enlaceFicha(d.inmueble.slug)} ¿Te interesa verlo?`;
}

export function mensajeSeguimientoVendedor(d: { nombre?: string; inmueble?: InmuebleMensaje }): string {
  const que = d.inmueble ? `la venta de ${nombreInmueble(d.inmueble)}` : "la venta de tu inmueble";
  return `${hola(d.nombre)}, te escribo de CIC Inmuebles para contarte cómo va ${que} y revisar los siguientes pasos. ¿Tienes un momento para hablar esta semana?`;
}

/** Lo que se sabe de la persona para elegir los mensajes que tienen sentido. */
export interface ContextoWhatsApp {
  nombre?: string;
  telefono?: string;
  esComprador?: boolean;
  esVendedor?: boolean;
  /** El inmueble por el que preguntó (lead) o el primero que se le propuso. */
  interes?: InmuebleMensaje;
  /** Lo que vende ("tu apartamento en Cedritos") o su inmueble ya en el catálogo. */
  queVende?: string;
  inmuebleVendedor?: InmuebleMensaje;
  /** La próxima visita agendada. */
  proximaVisita?: { inicioEn: string; inmueble: InmuebleMensaje };
  /** El último inmueble que visitó. */
  visitado?: InmuebleMensaje;
  /** Un sugerido que todavía no se le propuso. */
  similar?: InmuebleMensaje;
}

export interface OpcionWhatsApp {
  id: IdPlantilla;
  etiqueta: string;
  texto: string;
  href: string;
}

/** Los mensajes que aplican a esta persona, ya con el enlace wa.me. Vacío si el teléfono no sirve para WhatsApp. */
export function opcionesWhatsApp(ctx: ContextoWhatsApp): OpcionWhatsApp[] {
  if (!ctx.telefono || !enlaceWhatsApp(ctx.telefono)) return [];
  const textos: [IdPlantilla, string][] = [];
  if (ctx.esComprador) textos.push(["primer_comprador", mensajePrimerContactoComprador({ nombre: ctx.nombre, inmueble: ctx.interes })]);
  if (ctx.esVendedor) textos.push(["primer_propietario", mensajePrimerContactoPropietario({ nombre: ctx.nombre, queVende: ctx.queVende })]);
  if (ctx.proximaVisita) textos.push(["confirmar_visita", mensajeConfirmarVisita({ nombre: ctx.nombre, ...ctx.proximaVisita })]);
  if (ctx.visitado) textos.push(["despues_visita", mensajeDespuesDeVisita({ nombre: ctx.nombre, inmueble: ctx.visitado })]);
  if (ctx.similar) textos.push(["similar", mensajeInmuebleSimilar({ nombre: ctx.nombre, inmueble: ctx.similar })]);
  if (ctx.esVendedor) textos.push(["seguimiento_vendedor", mensajeSeguimientoVendedor({ nombre: ctx.nombre, inmueble: ctx.inmuebleVendedor })]);
  return textos.map(([id, texto]) => ({ id, etiqueta: ETIQUETA_PLANTILLA[id], texto, href: enlaceWhatsApp(ctx.telefono!, texto)! }));
}
