import { getPlan } from "@/lib/config/plans";
import { siteConfig } from "@/lib/config/site";
import type { Lead } from "@/lib/domain";
import { escapeHtml } from "@/lib/servicios/correo-html";
import { ServiciosNoDisponibleError } from "@/lib/servicios/store";
import { diasRestantes, fechaLarga, type Servicio } from "@/lib/servicios/vigencia";
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

/** Quien pagó un plan (servicio de publicación). Sin correo: solo lo que el equipo necesita para llamar. */
export interface PlanDelResumen {
  /** id del servicio. */
  id: string;
  nombre: string;
  telefono?: string;
  plan: string;
}

export interface DatosResumen {
  seguimientos: (PersonaDelResumen & { at: string; nota?: string })[];
  porAprobar: (PersonaDelResumen & { inmueble?: string })[];
  compradoresSinPropuestas: (PersonaDelResumen & { busca?: string })[];
  leadsNuevos: { nombre: string; telefono?: string; tipo: Lead["tipo"]; creadoEn: string }[];
  /** Planes pagados que siguen sin publicar (el reloj no corre hasta activarlos). */
  pagosSinPublicar?: (PlanDelResumen & { diasDesdePago: number })[];
  /** Planes activos que vencen en 7 días o menos (o ya vencieron y siguen en su día de gracia). */
  planesPorVencer?: (PlanDelResumen & { venceAt: string; diasRestantes: number })[];
}

/** Días hacia adelante en los que un plan activo entra en el resumen. */
export const DIAS_PLANES_POR_VENCER = 7;

const DIA_MS = 86_400_000;

/** Regla pura: qué planes van al resumen (pendientes de publicar y por vencer), más urgentes primero. */
export function planesDelResumen(servicios: Servicio[], ahora: Date): Required<Pick<DatosResumen, "pagosSinPublicar" | "planesPorVencer">> {
  const base = (s: Servicio): PlanDelResumen => ({
    id: s.id,
    nombre: s.clienteNombre?.trim() || "(sin nombre)",
    ...(s.clienteTelefono ? { telefono: s.clienteTelefono } : {}),
    plan: getPlan(s.planId)?.nombre ?? s.planId,
  });
  const pagosSinPublicar = servicios
    .filter((s) => s.estado === "pendiente_publicar")
    .map((s) => ({ ...base(s), diasDesdePago: Math.max(0, Math.floor((ahora.getTime() - new Date(s.pagadoAt ?? s.createdAt).getTime()) / DIA_MS)) }))
    .sort((a, b) => b.diasDesdePago - a.diasDesdePago);
  const planesPorVencer = servicios
    .filter((s) => s.estado === "activo" && s.venceAt && new Date(s.venceAt).getTime() - ahora.getTime() <= DIAS_PLANES_POR_VENCER * DIA_MS)
    .map((s) => ({ ...base(s), venceAt: s.venceAt as string, diasRestantes: diasRestantes(s.venceAt as string, ahora) || 0 })) // || 0: sin «-0» en la hora de gracia
    .sort((a, b) => a.venceAt.localeCompare(b.venceAt));
  return { pagosSinPublicar, planesPorVencer };
}

function desdeElPago(dias: number): string {
  return dias === 0 ? "pagó hoy" : dias === 1 ? "pagó ayer" : `pagó hace ${dias} días`;
}

function cuandoVencePlan(p: { venceAt: string; diasRestantes: number }): string {
  if (p.diasRestantes <= 0) return "venció: está en su día de gracia";
  if (p.diasRestantes === 1) return `vence en menos de 24 horas (${fechaLarga(p.venceAt)})`;
  return `vence en ${p.diasRestantes} días (${fechaLarga(p.venceAt)})`;
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
  /** Cómo se presenta el enlace en el texto plano (por defecto, «Ficha»). */
  etiquetaUrl?: string;
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
    {
      titulo: `Pagos sin publicar (${datos.pagosSinPublicar?.length ?? 0})`,
      verTodo: `${base}/admin/vigencias`,
      lineas: (datos.pagosSinPublicar ?? []).map((p) => ({ nombre: p.nombre, telefono: p.telefono, url: `${base}/admin/vigencias`, etiquetaUrl: "Vigencias", detalle: [p.plan, desdeElPago(p.diasDesdePago)] })),
    },
    {
      titulo: `Planes que vencen en ${DIAS_PLANES_POR_VENCER} días o menos (${datos.planesPorVencer?.length ?? 0})`,
      verTodo: `${base}/admin/vigencias`,
      lineas: (datos.planesPorVencer ?? []).map((p) => ({ nombre: p.nombre, telefono: p.telefono, url: `${base}/admin/vigencias`, etiquetaUrl: "Vigencias", detalle: [p.plan, cuandoVencePlan(p)] })),
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
      if (l.url) texto.push(`  ${l.etiquetaUrl ?? "Ficha"}: ${l.url}`);
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

/** Planes del resumen; sin la tabla de servicios (0004 sin aplicar) el resto del resumen sale igual. */
async function leerServicios(servicios: { listar(): Promise<Servicio[]> } | undefined): Promise<Servicio[]> {
  if (!servicios) return [];
  try {
    return await servicios.listar();
  } catch (err) {
    if (err instanceof ServiciosNoDisponibleError) return [];
    throw err;
  }
}

/**
 * Lee lo que va en el resumen: seguimientos hasta hoy, vendedores por aprobar, compradores sin propuestas,
 * leads sin atender y, si se pasa el almacén de servicios, pagos sin publicar y planes por vencer.
 */
export async function reunirResumenDiario(
  crm: CrmStore,
  leads: { list(): Promise<Lead[]> },
  ahora: Date,
  servicios?: { listar(): Promise<Servicio[]> },
): Promise<DatosResumen> {
  const [seguimientos, contactos, captaciones, busquedas, todosLeads, planes] = await Promise.all([
    crm.listarSeguimientos(finDelDiaBogota(ahora)),
    crm.listarContactos({ incluirArchivados: true }),
    crm.listarCaptaciones(),
    crm.listarBusquedas(),
    leads.list(),
    leerServicios(servicios),
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
    ...planesDelResumen(planes, ahora),
  };
}

/** Clave de idempotencia del envío: un reintento del cron el mismo día no manda un segundo correo. */
export function claveDelDia(ahora: Date): string {
  return `crm-diario-${diaBogota(ahora)}`;
}
