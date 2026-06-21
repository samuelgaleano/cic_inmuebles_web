import crypto from "node:crypto";
import type { Property, PropertyInput } from "@/lib/domain";
import { PROPERTY_STATUS_LABELS, PROPERTY_TYPE_LABELS, OPERATION_LABELS } from "@/lib/domain";

/**
 * Integración con Google Drive (archivo operativo por inmueble).
 *
 * Implementación *lean*: autenticación con cuenta de servicio firmando un JWT
 * (RS256) y llamadas REST a la API de Drive con fetch, sin dependencias
 * pesadas. Todo está gated por variables de entorno; si no está configurado,
 * las funciones no hacen nada (el resto del sistema funciona igual).
 *
 * Requiere: GOOGLE_SERVICE_ACCOUNT_EMAIL, GOOGLE_PRIVATE_KEY,
 * GOOGLE_DRIVE_ROOT_FOLDER_ID (la carpeta raíz debe estar compartida con la
 * cuenta de servicio con permiso de edición).
 */

const DRIVE_SCOPE = "https://www.googleapis.com/auth/drive";

export function isDriveConfigured(): boolean {
  return Boolean(
    process.env.GOOGLE_SERVICE_ACCOUNT_EMAIL &&
      process.env.GOOGLE_PRIVATE_KEY &&
      process.env.GOOGLE_DRIVE_ROOT_FOLDER_ID,
  );
}

function b64url(input: string | Buffer): string {
  return Buffer.from(input).toString("base64url");
}

async function getAccessToken(): Promise<string> {
  const email = process.env.GOOGLE_SERVICE_ACCOUNT_EMAIL!;
  const privateKey = (process.env.GOOGLE_PRIVATE_KEY ?? "").replace(/\\n/g, "\n");

  const now = Math.floor(Date.now() / 1000);
  const header = b64url(JSON.stringify({ alg: "RS256", typ: "JWT" }));
  const claim = b64url(
    JSON.stringify({
      iss: email,
      scope: DRIVE_SCOPE,
      aud: "https://oauth2.googleapis.com/token",
      iat: now,
      exp: now + 3600,
    }),
  );
  const signature = crypto
    .createSign("RSA-SHA256")
    .update(`${header}.${claim}`)
    .sign(privateKey, "base64url");
  const assertion = `${header}.${claim}.${signature}`;

  const res = await fetch("https://oauth2.googleapis.com/token", {
    method: "POST",
    headers: { "Content-Type": "application/x-www-form-urlencoded" },
    body: new URLSearchParams({
      grant_type: "urn:ietf:params:oauth:grant-type:jwt-bearer",
      assertion,
    }),
  });
  if (!res.ok) throw new Error(`Drive token error: ${res.status} ${await res.text()}`);
  const data = (await res.json()) as { access_token: string };
  return data.access_token;
}

/** Crea una carpeta dentro de la carpeta raíz y devuelve su id. */
async function createFolder(token: string, name: string): Promise<string> {
  const res = await fetch("https://www.googleapis.com/drive/v3/files?fields=id", {
    method: "POST",
    headers: { Authorization: `Bearer ${token}`, "Content-Type": "application/json" },
    body: JSON.stringify({
      name,
      mimeType: "application/vnd.google-apps.folder",
      parents: [process.env.GOOGLE_DRIVE_ROOT_FOLDER_ID],
    }),
  });
  if (!res.ok) throw new Error(`Drive folder error: ${res.status} ${await res.text()}`);
  const data = (await res.json()) as { id: string };
  return data.id;
}

/** Sube un archivo de texto a una carpeta (multipart). */
async function uploadTextFile(
  token: string,
  folderId: string,
  filename: string,
  content: string,
): Promise<void> {
  const boundary = "cic-boundary-" + crypto.randomUUID();
  const metadata = { name: filename, parents: [folderId] };
  const body =
    `--${boundary}\r\n` +
    "Content-Type: application/json; charset=UTF-8\r\n\r\n" +
    `${JSON.stringify(metadata)}\r\n` +
    `--${boundary}\r\n` +
    "Content-Type: text/markdown; charset=UTF-8\r\n\r\n" +
    `${content}\r\n` +
    `--${boundary}--`;

  const res = await fetch(
    "https://www.googleapis.com/upload/drive/v3/files?uploadType=multipart",
    {
      method: "POST",
      headers: {
        Authorization: `Bearer ${token}`,
        "Content-Type": `multipart/related; boundary=${boundary}`,
      },
      body,
    },
  );
  if (!res.ok) throw new Error(`Drive upload error: ${res.status} ${await res.text()}`);
}

/** Genera el documento de especificaciones estandarizado (Markdown). */
export function generateSpecDoc(p: Property | PropertyInput): string {
  const c = p.caracteristicas;
  const u = p.ubicacion;
  const lines = [
    `codigo: ${"codigo" in p ? p.codigo ?? "" : ""}`,
    `titulo: ${p.titulo}`,
    `tipo: ${PROPERTY_TYPE_LABELS[p.tipo]}`,
    `operacion: ${OPERATION_LABELS[p.operacion]}`,
    `estado: ${PROPERTY_STATUS_LABELS[p.estado]}`,
    `precio: ${p.precio} ${p.moneda}`,
    `departamento: ${u.departamento}`,
    `ciudad: ${u.ciudad}`,
    `barrio: ${u.barrio ?? ""}`,
    `direccion: ${u.direccion ?? ""}`,
    `habitaciones: ${c.habitaciones ?? ""}`,
    `banos: ${c.banos ?? ""}`,
    `area_construida: ${c.areaConstruida ?? ""}`,
    `area_total: ${c.areaTotal ?? ""}`,
    `parqueaderos: ${c.parqueaderos ?? ""}`,
    `estrato: ${c.estrato ?? ""}`,
    `administracion: ${c.administracion ?? ""}`,
    `amenidades: ${p.amenidades.join(", ")}`,
    `propietario_nombre: ${p.propietario?.nombre ?? ""}`,
    `propietario_telefono: ${p.propietario?.telefono ?? ""}`,
    `propietario_email: ${p.propietario?.email ?? ""}`,
    "---",
    `descripcion_corta: ${p.descripcionCorta}`,
    "",
    "descripcion:",
    p.descripcion,
  ];
  return lines.join("\n");
}

/**
 * Crea la carpeta del inmueble (`Nombre – Ciudad`) y sube el documento de
 * especificaciones. Devuelve el id de la carpeta (o null si no aplica/falla).
 * Nunca lanza: es una operación best-effort.
 */
export async function ensurePropertyArchive(p: Property): Promise<string | null> {
  if (!isDriveConfigured()) return null;
  try {
    const token = await getAccessToken();
    const folderName = `${p.titulo} – ${p.ubicacion.ciudad}`;
    const folderId = await createFolder(token, folderName);
    await uploadTextFile(token, folderId, "especificaciones.md", generateSpecDoc(p));
    return folderId;
  } catch (err) {
    console.error("[drive] No se pudo crear el archivo del inmueble:", err);
    return null;
  }
}
