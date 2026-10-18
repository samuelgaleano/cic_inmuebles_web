import { COMERCIO_EN_PASARELA, getPlan } from "@/lib/config/plans";
import { siteConfig, whatsappLink } from "@/lib/config/site";
import { formatPrice } from "@/lib/utils/format";
import { normalizarTelefono } from "@/lib/utils/telefono";
import { htmlDeCorreo, type BloqueCorreo } from "./correo-html";
import { tokenDeRenovacion } from "./token";
import { fechaHora, type Servicio, type TipoAviso } from "./vigencia";

export interface CorreoSaliente {
  to: string;
  subject: string;
  text: string;
  /** Versión con la marca de CIC; el texto queda como respaldo para quien no vea HTML. */
  html?: string;
  /** Las respuestas del cliente llegan a CIC (el remitente automático no tiene buzón). */
  replyTo?: string;
}

/** Primera palabra del nombre con inicial mayúscula: «samuel galeano» se saluda como «Samuel». */
export function nombrePropio(s: Pick<Servicio, "clienteNombre">): string | null {
  const primero = s.clienteNombre?.trim().split(/\s+/)[0];
  if (!primero) return null;
  return primero.charAt(0).toLocaleUpperCase("es-CO") + primero.slice(1);
}

function saludo(s: Servicio): string {
  const nombre = nombrePropio(s);
  return nombre ? `Hola ${nombre},` : "Hola,";
}

const WHATSAPP_DUDAS = () => whatsappLink(`Hola ${siteConfig.name}, tengo una duda sobre mi publicación.`);

/** Versión de texto: mismo contenido que el HTML, para bandejas que no lo muestran. */
function textoDe(b: BloqueCorreo): string {
  const partes: string[] = [b.saludo, "", ...b.parrafos];
  if (b.filas?.length) partes.push("", ...b.filas.map((f) => `${f.etiqueta}: ${f.valor}${f.url ? ` (${f.url})` : ""}`));
  if (b.pasos?.length) partes.push("", `${b.pasosTitulo ?? "Cómo sigue"}:`, ...b.pasos.map((p, i) => `${i + 1}. ${p}`));
  if (b.boton) partes.push("", `${b.boton.texto}: ${b.boton.url}`);
  if (b.nota) partes.push("", b.nota);
  // Si el botón ya es el de WhatsApp, no se repite el mismo enlace en el pie.
  partes.push("", b.boton?.url === WHATSAPP_DUDAS() ? "Si tienes dudas, responde este correo." : `Si tienes dudas, responde este correo o escríbenos por WhatsApp:\n${WHATSAPP_DUDAS()}`);
  partes.push("", `${siteConfig.name} · ${siteConfig.email} · ${siteConfig.phoneDisplay}`);
  return partes.join("\n");
}

function armar(s: Servicio, asunto: string, b: Omit<BloqueCorreo, "saludo">): CorreoSaliente | null {
  if (!s.clienteEmail) return null;
  // Las fechas con hora terminan en «p. m.»: sin esto la frase quedaría con dos puntos seguidos.
  const sinDoble = (t: string) => t.replace(/\.\.$/, ".");
  const bloque: BloqueCorreo = {
    ...b,
    preheader: sinDoble(b.preheader),
    parrafos: b.parrafos.map(sinDoble),
    ...(b.nota ? { nota: sinDoble(b.nota) } : {}),
    saludo: saludo(s),
  };
  return { to: s.clienteEmail, subject: asunto, text: textoDe(bloque), html: htmlDeCorreo(bloque), replyTo: siteConfig.email };
}

/** Enlace que abre los planes con el plan y los datos precargados. */
export function enlaceDeRenovacion(s: Servicio): string {
  const token = tokenDeRenovacion(s.id, { venceAt: s.venceAt });
  return token ? `${siteConfig.url}/publica/agente?renovar=${token}` : `${siteConfig.url}/publica/agente`;
}

function nombreDePlan(s: Servicio): string {
  return getPlan(s.planId)?.nombre ?? "tu plan de publicación";
}

/** Un paquete no tiene una ficha enlazada que se apague sola: sus correos no deben decir que se desactivó. */
function esPaquete(s: Servicio): boolean {
  return !s.propertySlug && Boolean(getPlan(s.planId)?.espacios);
}

function urlFicha(s: Servicio): string | undefined {
  return s.propertySlug ? `${siteConfig.url}/inmuebles/${s.propertySlug}` : undefined;
}

/** Confirmación al comprador: qué pagó, cuándo y cómo sigue; la vigencia corre desde la publicación. */
export function correoPagoRecibido(s: Servicio): CorreoSaliente | null {
  const plan = nombreDePlan(s);
  const precio = getPlan(s.planId)?.precioCOP;
  const tel = s.clienteTelefono ? normalizarTelefono(s.clienteTelefono)?.legible : undefined;
  return armar(s, `Recibimos tu pago: ${plan}`, {
    preheader: `Plan «${plan}»${precio ? ` · ${formatPrice(precio)}` : ""}. Así sigue tu publicación.`,
    titulo: "Recibimos tu pago",
    parrafos: [
      `Gracias por confiar en ${siteConfig.name}. Recibimos el pago del plan «${plan}» y ya quedó registrado.`,
      `La vigencia del plan (${s.dias} días) empieza a contar el día en que publiquemos tu inmueble, no el día del pago, y te lo confirmamos por este correo.`,
    ],
    filas: [
      { etiqueta: "Plan", valor: plan },
      ...(precio ? [{ etiqueta: "Valor pagado", valor: formatPrice(precio) }] : []),
      { etiqueta: "Registrado el", valor: fechaHora(s.createdAt) },
      ...(s.reference ? [{ etiqueta: "Referencia", valor: s.reference }] : []),
      { etiqueta: "En tu extracto", valor: COMERCIO_EN_PASARELA },
      { etiqueta: "Vigencia", valor: `${s.dias} días desde la publicación` },
    ],
    pasosTitulo: "Cómo sigue",
    pasos: [
      `Un asesor te escribe por WhatsApp${tel ? ` al ${tel}` : ""} para recibir los datos y las fotos del inmueble.`,
      "Creamos la ficha y la publicamos.",
      "Te confirmamos por este correo la fecha en que empieza y vence tu vigencia.",
    ],
    boton: { texto: "Escribir a un asesor", url: WHATSAPP_DUDAS() },
    nota: "Antes de que venza te escribiremos 7 días y 1 día antes, con un enlace para renovar con un clic.",
  });
}

/** Confirmación de que la publicación ya corre (al activarla desde el panel). */
export function correoPublicacionActiva(s: Servicio): CorreoSaliente | null {
  if (!s.venceAt) return null;
  const plan = nombreDePlan(s);
  const ficha = urlFicha(s);
  return armar(s, "Tu inmueble ya está publicado", {
    preheader: `Tu publicación está activa hasta el ${fechaHora(s.venceAt)}.`,
    titulo: "Tu inmueble ya está publicado",
    parrafos: [
      `Tu publicación del plan «${plan}» ya está activa. Desde hoy corre su vigencia de ${s.dias} días.`,
    ],
    filas: [
      { etiqueta: "Plan", valor: plan },
      ...(s.inicioAt ? [{ etiqueta: "Empezó", valor: fechaHora(s.inicioAt) }] : []),
      { etiqueta: "Vence", valor: fechaHora(s.venceAt) },
      ...(ficha ? [{ etiqueta: "Tu publicación", valor: "Ver la ficha", url: ficha }] : []),
    ],
    ...(ficha ? { boton: { texto: "Ver mi publicación", url: ficha } } : {}),
    nota: "Te avisaremos 7 días y 1 día antes del vencimiento, con un enlace para renovar con un clic.",
  });
}

/** Aviso de vencimiento próximo o consumado, con el enlace de renovación. */
export function correoDeAviso(s: Servicio, tipo: TipoAviso): CorreoSaliente | null {
  if (!s.venceAt) return null;
  const plan = nombreDePlan(s);
  const vence = fechaHora(s.venceAt);
  const ficha = urlFicha(s);
  const paquete = esPaquete(s);
  const que = paquete ? "paquete" : "publicación";

  const textos: Record<TipoAviso, { asunto: string; titulo: string; parrafos: string[]; boton: string; nota: string }> = {
    "7d": {
      asunto: "Tu publicación vence en 7 días",
      titulo: "Tu publicación vence en 7 días",
      parrafos: [`Tu ${que} del plan «${plan}» vence el ${vence}.`, "Para que siga activa sin interrupciones, renuévala con un clic."],
      boton: "Renovar mi publicación",
      nota: paquete
        ? "Si no lo renuevas, al vencer los inmuebles del paquete dejan de estar cubiertos por el plan y te escribimos para coordinar."
        : "Si no quieres renovarla, no tienes que hacer nada: la desactivamos automáticamente al vencer.",
    },
    "1d": {
      asunto: "Tu publicación vence en menos de 24 horas",
      titulo: "Tu publicación vence en menos de 24 horas",
      parrafos: [`Tu ${que} del plan «${plan}» vence en menos de 24 horas (${vence}).`, "Si quieres que siga activa, renuévala ahora con un clic."],
      boton: "Renovar ahora",
      nota: paquete
        ? "Si no lo renuevas, al vencer los inmuebles del paquete dejan de estar cubiertos por el plan."
        : "Si no la renuevas, la desactivamos automáticamente al vencer.",
    },
    vencido: {
      asunto: "Tu publicación venció",
      titulo: "Tu publicación venció",
      parrafos: paquete
        ? [`Tu paquete «${plan}» venció el ${vence}. Te escribimos para coordinar qué pasa con sus inmuebles.`, "Para mantenerlos publicados, renueva con un clic."]
        : [`Tu publicación del plan «${plan}» venció el ${vence} y la desactivamos.`, "Para volver a publicarla, renueva con un clic."],
      boton: "Volver a publicar",
      nota: "El enlace funciona hasta 30 días después del vencimiento y abre el plan con tus datos ya escritos.",
    },
  };
  const t = textos[tipo];

  return armar(s, t.asunto, {
    preheader: t.parrafos[0],
    titulo: t.titulo,
    parrafos: t.parrafos,
    filas: [
      { etiqueta: "Plan", valor: plan },
      { etiqueta: tipo === "vencido" ? "Venció" : "Vence", valor: vence },
      ...(ficha ? [{ etiqueta: "Inmueble", valor: "Ver la ficha", url: ficha }] : []),
    ],
    boton: { texto: t.boton, url: enlaceDeRenovacion(s) },
    nota: t.nota,
  });
}

/** Confirmación de una renovación pagada desde el enlace del correo: la vigencia ya se extendió. */
export function correoRenovacionPagada(s: Servicio): CorreoSaliente | null {
  if (!s.venceAt) return null;
  const plan = nombreDePlan(s);
  const ficha = urlFicha(s);
  return armar(s, "Renovamos tu publicación", {
    preheader: `Tu publicación queda activa hasta el ${fechaHora(s.venceAt)}.`,
    titulo: "Renovamos tu publicación",
    parrafos: [`Recibimos el pago de la renovación del plan «${plan}». Tu publicación queda activa hasta el ${fechaHora(s.venceAt)}.`],
    filas: [
      { etiqueta: "Plan", valor: plan },
      { etiqueta: "Nuevo vencimiento", valor: fechaHora(s.venceAt) },
      ...(ficha ? [{ etiqueta: "Tu publicación", valor: "Ver la ficha", url: ficha }] : []),
    ],
    ...(ficha ? { boton: { texto: "Ver mi publicación", url: ficha } } : {}),
    nota: "Te avisaremos otra vez 7 días y 1 día antes del nuevo vencimiento.",
  });
}
