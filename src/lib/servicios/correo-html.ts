import { siteConfig } from "@/lib/config/site";

/**
 * Plantilla de los correos al cliente: HTML con estilos en línea (los clientes de correo no cargan hojas de estilo),
 * tablas para el diseño y colores de la marca. Todo texto que viene de una persona o de la base se escapa.
 * Sin imágenes remotas: así no hay nada que bloquear y el correo se ve igual con o sin «mostrar imágenes».
 */

const VERDE = "#047d5b";
const TINTA = "#0b1a15";
const GRIS = "#5a6b64";
const LINEA = "#e3e9e6";
const FONDO = "#f3f6f4";

export function escapeHtml(t: string): string {
  return t.replace(/&/g, "&amp;").replace(/</g, "&lt;").replace(/>/g, "&gt;").replace(/"/g, "&quot;").replace(/'/g, "&#39;");
}

export interface BloqueCorreo {
  /** Primera línea que muestran las bandejas junto al asunto. */
  preheader: string;
  titulo: string;
  saludo: string;
  parrafos: string[];
  /** Resumen en tabla: [etiqueta, valor]. El valor puede ser un enlace si `url` viene. */
  filas?: { etiqueta: string; valor: string; url?: string }[];
  pasosTitulo?: string;
  pasos?: string[];
  boton?: { texto: string; url: string };
  /** Texto pequeño bajo el botón (por ejemplo, qué pasa si no se renueva). */
  nota?: string;
}

export function htmlDeCorreo(b: BloqueCorreo): string {
  const filas = (b.filas ?? [])
    .map(
      (f) => `<tr>
<td style="padding:10px 0;border-top:1px solid ${LINEA};color:${GRIS};font-size:14px;width:38%;vertical-align:top">${escapeHtml(f.etiqueta)}</td>
<td style="padding:10px 0;border-top:1px solid ${LINEA};color:${TINTA};font-size:15px;font-weight:600;vertical-align:top">${
        f.url ? `<a href="${escapeHtml(f.url)}" style="color:${VERDE};text-decoration:underline">${escapeHtml(f.valor)}</a>` : escapeHtml(f.valor)
      }</td>
</tr>`,
    )
    .join("");

  const pasos = (b.pasos ?? [])
    .map(
      (p, i) => `<tr>
<td style="padding:6px 12px 6px 0;vertical-align:top;width:28px"><div style="width:26px;height:26px;border-radius:13px;background:${VERDE};color:#ffffff;font-size:13px;font-weight:700;line-height:26px;text-align:center">${i + 1}</div></td>
<td style="padding:6px 0;color:${TINTA};font-size:15px;line-height:1.5;vertical-align:top">${escapeHtml(p)}</td>
</tr>`,
    )
    .join("");

  return `<!doctype html>
<html lang="es">
<head><meta charset="utf-8"><meta name="viewport" content="width=device-width,initial-scale=1"><title>${escapeHtml(b.titulo)}</title></head>
<body style="margin:0;padding:0;background:${FONDO}">
<div style="display:none;max-height:0;overflow:hidden;opacity:0">${escapeHtml(b.preheader)}</div>
<table role="presentation" width="100%" cellpadding="0" cellspacing="0" style="background:${FONDO};padding:24px 12px">
<tr><td align="center">
<table role="presentation" width="600" cellpadding="0" cellspacing="0" style="max-width:600px;width:100%;background:#ffffff;border-radius:16px;overflow:hidden;font-family:'Helvetica Neue',Helvetica,Arial,sans-serif">
<tr><td style="background:${TINTA};padding:20px 28px">
<span style="display:inline-block;width:10px;height:10px;border-radius:5px;background:#12c08a;margin-right:8px"></span><span style="color:#ffffff;font-size:18px;font-weight:700;letter-spacing:-0.01em">${escapeHtml(siteConfig.name)}</span>
</td></tr>
<tr><td style="padding:32px 28px 8px">
<h1 style="margin:0 0 18px;font-family:Georgia,'Times New Roman',serif;font-size:26px;line-height:1.25;color:${TINTA};font-weight:700">${escapeHtml(b.titulo)}</h1>
<p style="margin:0 0 14px;color:${TINTA};font-size:16px;line-height:1.55">${escapeHtml(b.saludo)}</p>
${b.parrafos.map((p) => `<p style="margin:0 0 14px;color:${TINTA};font-size:16px;line-height:1.55">${escapeHtml(p)}</p>`).join("\n")}
</td></tr>
${filas ? `<tr><td style="padding:6px 28px 14px"><table role="presentation" width="100%" cellpadding="0" cellspacing="0">${filas}</table></td></tr>` : ""}
${
  pasos
    ? `<tr><td style="padding:8px 28px 14px"><p style="margin:0 0 8px;color:${TINTA};font-size:16px;font-weight:700">${escapeHtml(b.pasosTitulo ?? "Cómo sigue")}</p><table role="presentation" cellpadding="0" cellspacing="0">${pasos}</table></td></tr>`
    : ""
}
${
  b.boton
    ? `<tr><td style="padding:10px 28px 8px" align="left"><a href="${escapeHtml(b.boton.url)}" style="display:inline-block;background:${VERDE};color:#ffffff;font-size:16px;font-weight:700;text-decoration:none;padding:14px 26px;border-radius:999px">${escapeHtml(b.boton.texto)}</a></td></tr>`
    : ""
}
${b.nota ? `<tr><td style="padding:6px 28px 8px"><p style="margin:0;color:${GRIS};font-size:14px;line-height:1.5">${escapeHtml(b.nota)}</p></td></tr>` : ""}
<tr><td style="padding:22px 28px 30px">
<table role="presentation" width="100%" cellpadding="0" cellspacing="0"><tr><td style="border-top:1px solid ${LINEA};padding-top:18px;color:${GRIS};font-size:13px;line-height:1.55">
¿Dudas? Responde este correo o escríbenos por <a href="https://wa.me/${siteConfig.whatsapp}" style="color:${VERDE}">WhatsApp</a>.<br>
${escapeHtml(siteConfig.name)} · ${escapeHtml(siteConfig.email)} · ${escapeHtml(siteConfig.phoneDisplay)}<br>
Recibes este mensaje porque contrataste un plan de publicación en <a href="${siteConfig.url}" style="color:${GRIS}">cicinmuebles.com</a>. Cómo cuidamos tus datos: <a href="${siteConfig.url}/privacidad" style="color:${GRIS}">política de datos</a>.
</td></tr></table>
</td></tr>
</table>
</td></tr>
</table>
</body>
</html>`;
}
