import { siteConfig } from "@/lib/config/site";
import type { Lead } from "@/lib/domain";
import { escapeHtml } from "@/lib/servicios/correo-html";
import { enlaceWhatsApp } from "@/lib/utils/telefono";
import { diasDeAtraso, diaBogota, finDelDiaBogota } from "./reglas";
import type { CrmStore } from "./store";

/**
 * Resumen diario del CRM por correo para el equipo (cron /api/cron/crm-diario, 7:00 de Bogotá).
 * `armarResumenDiario` es pura (se prueba sola); `reunirResumenDiario` lee el CRM y los leads.
 * Ley 1581: lleva nombre y teléfono, que es lo que el equipo necesita para llamar, pero nunca el correo
 * de las personas, y el asunto no lleva nombres (las bandejas lo muestran en notificaciones).
 */

export interface PersonaDelResumen {
  /** id del contacto, para enlazar su ficha en el panel. */
  id: string;
  nombre: string;
  telefono?: string;
}

export interface DatosResumen {
  seguimientos: (PersonaDelResumen & { at: string; nota?: string })[];
  porAprobar: (PersonaDelResumen & { inmueble?: string })[];
  compradoresSinPropuestas: (PersonaDelResumen & { busca?: string })[];
  leadsNuevos: { nombre: string; telefono?: string; tipo: Lead["tipo"]; creadoEn: string }[];
}

export interface CorreoResumen {
  asunto: string;
  text: string;
  html: string;
}

// Mismos colores que los correos al cliente (src/lib/servicios/correo-html.ts).
const VERDE = "#047d5b";
const TINTA = "#0b1a15";
const GRIS = "#5a6b64";
const LINEA = "#e3e9e6";
const FONDO = "#f3f6f4";
const ROJO = "#b42318";

/** Cuántos se muestran por grupo; el resto se resume en "y N más" con enlace al panel. */
const TOPE = 25;

function cuandoVence(at: string, ahora: Date): string {
  const atraso = diasDeAtraso(at, ahora);
  if (atraso <= 0) {
    const hora = new Date(at).toLocaleTimeString("es-CO", { timeZone: "America/Bogota", hour: "numeric", minute: "2-digit" });
    return `hoy, ${hora}`;
  }
  return atraso === 1 ? "vencido desde ayer" : `vencido hace ${atraso} días`;
}

function hace(iso: string, ahora: Date): string {
  const horas = Math.max(0, Math.round((ahora.getTime() - new Date(iso).getTime()) / 3_600_000));
  return horas < 1 ? "hace menos de una hora" : horas === 1 ? "hace 1 hora" : `hace ${horas} horas`;
}

interface Linea {
  nombre: string;
  telefono?: string;
  url?: string;
  detalle: string[];
  urgente?: boolean;
}

interface Grupo {
  titulo: string;
  lineas: Linea[];
  /** A dónde llevan "y N más". */
  verTodo: string;
}

/** Arma el correo. null si no hay nada pendiente: no se manda un correo vacío. */
export function armarResumenDiario(datos: DatosResumen, ahora: Date, base: string = siteConfig.url): CorreoResumen | null {
  const ficha = (id: string) => `${base}/admin/crm/contactos/${id}`;
  const vencidos = datos.seguimientos.filter((s) => diasDeAtraso(s.at, ahora) > 0).length;

  const grupos: Grupo[] = [
    {
      titulo: `Seguimientos para hoy y vencidos (${datos.seguimientos.length}${vencidos ? `, ${vencidos} vencido${vencidos === 1 ? "" : "s"}` : ""})`,
      verTodo: `${base}/admin/crm`,
      lineas: datos.seguimientos.map((s) => ({
        nombre: s.nombre,
        telefono: s.telefono,
        url: ficha(s.id),
        urgente: diasDeAtraso(s.at, ahora) > 0,
        detalle: [cuandoVence(s.at, ahora), ...(s.nota ? [s.nota] : [])],
      })),
    },
    {
      titulo: `Vendedores por aprobar (${datos.porAprobar.length})`,
      verTodo: `${base}/admin/crm?vista=vendedores`,
      lineas: datos.porAprobar.map((v) => ({ nombre: v.nombre, telefono: v.telefono, url: ficha(v.id), detalle: v.inmueble ? [v.inmueble] : [] })),
    },
    {
      titulo: `Compradores activos sin inmuebles propuestos (${datos.compradoresSinPropuestas.length})`,
      verTodo: `${base}/admin/crm?vista=compradores`,
      lineas: datos.compradoresSinPropuestas.map((c) => ({ nombre: c.nombre, telefono: c.telefono, url: ficha(c.id), detalle: c.busca ? [`busca: ${c.busca}`] : [] })),
    },
    {
      titulo: `Leads de las últimas 48 horas sin atender (${datos.leadsNuevos.length})`,
      verTodo: `${base}/admin/leads`,
      lineas: datos.leadsNuevos.map((l) => ({ nombre: l.nombre, telefono: l.telefono, detalle: [l.tipo === "vendedor" ? "quiere vender" : "quiere comprar", hace(l.creadoEn, ahora)] })),
    },
  ].filter((g) => g.lineas.length > 0);

  if (!grupos.length) return null;

  const total = grupos.reduce((s, g) => s + g.lineas.length, 0);
  const fecha = new Date(ahora).toLocaleDateString("es-CO", { timeZone: "America/Bogota", weekday: "long", day: "numeric", month: "long" });
  const asunto = `CRM de hoy: ${total} pendiente${total === 1 ? "" : "s"}${vencidos ? ` (${vencidos} seguimiento${vencidos === 1 ? "" : "s"} vencido${vencidos === 1 ? "" : "s"})` : ""}`;

  // ---- texto plano
  const texto: string[] = [`Resumen del CRM · ${fecha}`, ""];
  for (const g of grupos) {
    texto.push(g.titulo.toUpperCase());
    for (const l of g.lineas.slice(0, TOPE)) {
      const wa = l.telefono ? enlaceWhatsApp(l.telefono) : undefined;
      texto.push(`- ${l.urgente ? "[VENCIDO] " : ""}${l.nombre}${l.telefono ? ` · ${l.telefono}` : ""}${l.detalle.length ? ` · ${l.detalle.join(" · ")}` : ""}`);
      if (wa) texto.push(`  WhatsApp: ${wa}`);
      if (l.url) texto.push(`  Ficha: ${l.url}`);
    }
    if (g.lineas.length > TOPE) texto.push(`  y ${g.lineas.length - TOPE} más: ${g.verTodo}`);
    texto.push("");
  }
  texto.push(`Panel: ${base}/admin/crm`);

  // ---- HTML (estilos en línea y tablas, como los demás correos; todo valor escapado)
  const fila = (l: Linea) => {
    const wa = l.telefono ? enlaceWhatsApp(l.telefono) : undefined;
    const nombre = l.url ? `<a href="${escapeHtml(l.url)}" style="color:${TINTA};font-weight:700;text-decoration:none">${escapeHtml(l.nombre)}</a>` : `<span style="color:${TINTA};font-weight:700">${escapeHtml(l.nombre)}</span>`;
    const tel = l.telefono
      ? wa
        ? ` · <a href="${escapeHtml(wa)}" style="color:${VERDE};text-decoration:underline">${escapeHtml(l.telefono)}</a>`
        : ` · <span style="color:${GRIS}">${escapeHtml(l.telefono)}</span>`
      : "";
    const marca = l.urgente ? `<span style="display:inline-block;margin-right:6px;padding:1px 8px;border-radius:999px;background:#fde8e6;color:${ROJO};font-size:12px;font-weight:700">Vencido</span>` : "";
    const detalle = l.detalle.length ? `<div style="margin-top:2px;color:${GRIS};font-size:14px;line-height:1.45">${l.detalle.map(escapeHtml).join(" · ")}</div>` : "";
    return `<tr><td style="padding:10px 0;border-top:1px solid ${LINEA};font-size:15px;line-height:1.45">${marca}${nombre}${tel}${detalle}</td></tr>`;
  };

  const secciones = grupos
    .map(
      (g) => `<tr><td style="padding:14px 28px 6px">
<p style="margin:0 0 6px;color:${TINTA};font-size:16px;font-weight:700">${escapeHtml(g.titulo)}</p>
<table role="presentation" width="100%" cellpadding="0" cellspacing="0">${g.lineas.slice(0, TOPE).map(fila).join("")}${
        g.lineas.length > TOPE
          ? `<tr><td style="padding:10px 0;border-top:1px solid ${LINEA};font-size:14px"><a href="${escapeHtml(g.verTodo)}" style="color:${VERDE}">y ${g.lineas.length - TOPE} más en el panel</a></td></tr>`
          : ""
      }</table>
</td></tr>`,
    )
    .join("\n");

  const html = `<!doctype html>
<html lang="es">
<head><meta charset="utf-8"><meta name="viewport" content="width=device-width,initial-scale=1"><title>${escapeHtml(asunto)}</title></head>
<body style="margin:0;padding:0;background:${FONDO}">
<div style="display:none;max-height:0;overflow:hidden;opacity:0">${escapeHtml(`${total} pendiente${total === 1 ? "" : "s"} en el CRM`)}</div>
<table role="presentation" width="100%" cellpadding="0" cellspacing="0" style="background:${FONDO};padding:24px 12px">
<tr><td align="center">
<table role="presentation" width="600" cellpadding="0" cellspacing="0" style="max-width:600px;width:100%;background:#ffffff;border-radius:16px;overflow:hidden;font-family:'Helvetica Neue',Helvetica,Arial,sans-serif">
<tr><td style="background:${TINTA};padding:20px 28px">
<span style="display:inline-block;width:10px;height:10px;border-radius:5px;background:#12c08a;margin-right:8px"></span><span style="color:#ffffff;font-size:18px;font-weight:700;letter-spacing:-0.01em">${escapeHtml(siteConfig.name)} · CRM</span>
</td></tr>
<tr><td style="padding:28px 28px 4px">
<h1 style="margin:0 0 6px;font-family:Georgia,'Times New Roman',serif;font-size:24px;line-height:1.25;color:${TINTA};font-weight:700">Lo que hay que hacer hoy</h1>
<p style="margin:0;color:${GRIS};font-size:15px">${escapeHtml(fecha)}</p>
</td></tr>
${secciones}
<tr><td style="padding:14px 28px 8px" align="left"><a href="${escapeHtml(`${base}/admin/crm`)}" style="display:inline-block;background:${VERDE};color:#ffffff;font-size:16px;font-weight:700;text-decoration:none;padding:12px 24px;border-radius:999px">Abrir el CRM</a></td></tr>
<tr><td style="padding:18px 28px 26px;color:${GRIS};font-size:13px;line-height:1.55">Correo interno para el equipo de ${escapeHtml(siteConfig.name)}. Llega cada mañana solo si hay algo pendiente. No lo reenvíes: tiene datos personales de clientes.</td></tr>
</table>
</td></tr>
</table>
</body>
</html>`;

  return { asunto, text: texto.join("\n"), html };
}

/** Lee lo que va en el resumen: seguimientos hasta hoy, vendedores por aprobar, compradores sin propuestas y leads sin atender. */
export async function reunirResumenDiario(crm: CrmStore, leads: { list(): Promise<Lead[]> }, ahora: Date): Promise<DatosResumen> {
  const [seguimientos, contactos, captaciones, busquedas, todosLeads] = await Promise.all([
    crm.listarSeguimientos(finDelDiaBogota(ahora)),
    crm.listarContactos({ incluirArchivados: true }),
    crm.listarCaptaciones(),
    crm.listarBusquedas(),
    leads.list(),
  ]);
  const activos = new Map(contactos.filter((c) => !c.archivado).map((c) => [c.id, c]));
  const persona = (id: string): PersonaDelResumen | undefined => {
    const c = activos.get(id);
    return c ? { id: c.id, nombre: c.nombre, ...(c.telefono ? { telefono: c.telefono } : {}) } : undefined;
  };

  // Mismas reglas que "Por hacer" en /admin/crm.
  const porAprobar = captaciones
    .filter((c) => c.estado !== "descartada" && c.estado !== "vendida" && !c.aprobada)
    .flatMap((c) => {
      const p = persona(c.contactoId);
      return p ? [{ ...p, ...(c.ubicacion ? { inmueble: c.ubicacion } : {}) }] : [];
    });

  const buscando = busquedas.filter((b) => (b.estado === "activa" || b.estado === "en_visitas") && activos.has(b.contactoId));
  const propuestas = await crm.listarPropuestas(buscando.map((b) => b.id));
  const conPropuestas = new Set(propuestas.map((p) => p.busquedaId));
  const compradoresSinPropuestas = buscando
    .filter((b) => !conPropuestas.has(b.id))
    .flatMap((b) => {
      const p = persona(b.contactoId);
      return p ? [{ ...p, ...(b.ubicacion ? { busca: b.ubicacion } : {}) }] : [];
    });

  const desde = ahora.getTime() - 48 * 3_600_000;
  const leadsNuevos = todosLeads
    .filter((l) => l.estado === "nuevo" && new Date(l.creadoEn).getTime() >= desde)
    .sort((a, b) => b.creadoEn.localeCompare(a.creadoEn))
    .map((l) => ({ nombre: l.nombre, ...(l.telefono ? { telefono: l.telefono } : {}), tipo: l.tipo, creadoEn: l.creadoEn }));

  return {
    seguimientos: seguimientos.map((c) => ({
      id: c.id,
      nombre: c.nombre,
      ...(c.telefono ? { telefono: c.telefono } : {}),
      at: c.proximoContactoAt!,
      ...(c.proximoContactoNota ? { nota: c.proximoContactoNota } : {}),
    })),
    porAprobar,
    compradoresSinPropuestas,
    leadsNuevos,
  };
}

/** Clave de idempotencia del envío: un reintento del cron el mismo día no manda un segundo correo. */
export function claveDelDia(ahora: Date): string {
  return `crm-diario-${diaBogota(ahora)}`;
}
