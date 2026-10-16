import { getPlan } from "@/lib/config/plans";
import { siteConfig, whatsappLink } from "@/lib/config/site";
import { tokenDeRenovacion } from "./token";
import { fechaLarga, type Servicio, type TipoAviso } from "./vigencia";

export interface CorreoSaliente {
  to: string;
  subject: string;
  text: string;
}

function saludo(s: Servicio): string {
  const nombre = s.clienteNombre?.trim().split(/\s+/)[0];
  return nombre ? `Hola ${nombre},` : "Hola,";
}

function pie(): string {
  return [
    "Si tienes dudas, escríbenos por WhatsApp:",
    whatsappLink(`Hola ${siteConfig.name}, tengo una duda sobre mi publicación.`),
    "",
    `${siteConfig.name} · ${siteConfig.email} · ${siteConfig.phoneDisplay}`,
  ].join("\n");
}

/** Enlace que abre los planes con el plan y los datos precargados. */
export function enlaceDeRenovacion(s: Servicio): string {
  const token = tokenDeRenovacion(s.id);
  return token ? `${siteConfig.url}/publica/agente?renovar=${token}` : `${siteConfig.url}/publica/agente`;
}

function nombreDePlan(s: Servicio): string {
  return getPlan(s.planId)?.nombre ?? "tu plan de publicación";
}

/** Confirmación al comprador: cómo sigue y desde cuándo corre la vigencia. */
export function correoPagoRecibido(s: Servicio): CorreoSaliente | null {
  if (!s.clienteEmail) return null;
  const plan = nombreDePlan(s);
  return {
    to: s.clienteEmail,
    subject: `Recibimos tu pago: ${plan}`,
    text: [
      saludo(s),
      "",
      `Recibimos tu pago del plan «${plan}». Gracias por confiar en ${siteConfig.name}.`,
      "",
      "Cómo sigue: un asesor se comunica contigo por WhatsApp para recibir los datos y las fotos del inmueble. La vigencia del plan " +
        `(${s.dias} días) empieza a contar el día en que publiquemos tu inmueble, no el día del pago, y te lo confirmamos por este correo.`,
      "",
      "Antes de que venza te escribiremos 7 días y 1 día antes, con un enlace para renovar con un clic.",
      "",
      pie(),
    ].join("\n"),
  };
}

/** Confirmación de que la publicación ya corre (al activarla desde el panel). */
export function correoPublicacionActiva(s: Servicio): CorreoSaliente | null {
  if (!s.clienteEmail || !s.venceAt) return null;
  const plan = nombreDePlan(s);
  return {
    to: s.clienteEmail,
    subject: "Tu inmueble ya está publicado",
    text: [
      saludo(s),
      "",
      `Tu publicación del plan «${plan}» ya está activa y vence el ${fechaLarga(s.venceAt)}.`,
      s.propertySlug ? `Puedes verla aquí: ${siteConfig.url}/inmuebles/${s.propertySlug}` : null,
      "",
      "Te avisaremos 7 días y 1 día antes del vencimiento, con un enlace para renovar con un clic.",
      "",
      pie(),
    ]
      .filter((l): l is string => l !== null)
      .join("\n"),
  };
}

/** Aviso de vencimiento próximo o consumado, con el enlace de renovación. */
export function correoDeAviso(s: Servicio, tipo: TipoAviso): CorreoSaliente | null {
  if (!s.clienteEmail || !s.venceAt) return null;
  const plan = nombreDePlan(s);
  const vence = fechaLarga(s.venceAt);
  const enlace = enlaceDeRenovacion(s);
  const inmueble = s.propertySlug ? `Inmueble: ${siteConfig.url}/inmuebles/${s.propertySlug}` : null;

  const cuerpo: Record<TipoAviso, { asunto: string; lineas: (string | null)[] }> = {
    "7d": {
      asunto: "Tu publicación vence en 7 días",
      lineas: [
        `Tu publicación del plan «${plan}» vence el ${vence}.`,
        inmueble,
        "",
        "Para que siga activa sin interrupciones, renuévala con un clic:",
        enlace,
        "",
        "Si no quieres renovarla, no tienes que hacer nada: la desactivamos automáticamente al vencer.",
      ],
    },
    "1d": {
      asunto: "Tu publicación vence en menos de 24 horas",
      lineas: [
        `Tu publicación del plan «${plan}» vence en menos de 24 horas (${vence}).`,
        inmueble,
        "",
        "Si quieres que siga activa, renuévala ahora con un clic:",
        enlace,
        "",
        "Si no la renuevas, la desactivamos automáticamente al vencer.",
      ],
    },
    vencido: {
      asunto: "Tu publicación venció",
      lineas: [
        `Tu publicación del plan «${plan}» venció el ${vence} y la desactivamos.`,
        inmueble,
        "",
        "Para volver a publicarla, renueva con un clic:",
        enlace,
      ],
    },
  };

  const c = cuerpo[tipo];
  return {
    to: s.clienteEmail,
    subject: c.asunto,
    text: [saludo(s), "", ...c.lineas.filter((l): l is string => l !== null), "", pie()].join("\n"),
  };
}
