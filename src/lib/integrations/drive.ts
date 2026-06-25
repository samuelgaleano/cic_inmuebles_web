import crypto from "node:crypto";
import type { Property, PropertyInput } from "@/lib/domain";
import { PROPERTY_STATUS_LABELS, PROPERTY_TYPE_LABELS, OPERATION_LABELS } from "@/lib/domain";
import { getGoogleAccessToken, isGoogleServiceAccountConfigured } from "./google-auth";

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
  return isGoogleServiceAccountConfigured() && Boolean(process.env.GOOGLE_DRIVE_ROOT_FOLDER_ID);
}

/** Access token de la cuenta de servicio con el scope de Drive. */
async function getAccessToken(): Promise<string> {
  return getGoogleAccessToken(DRIVE_SCOPE);
}

/** Enlace directo a una carpeta de Drive (para abrir en el navegador). */
export function driveFolderLink(folderId: string): string {
  return `https://drive.google.com/drive/folders/${folderId}`;
}

export interface DriveFile {
  id: string;
  name: string;
  mimeType: string;
  webViewLink?: string;
  thumbnailLink?: string;
  iconLink?: string;
  modifiedTime?: string;
}

/** ¿Es una imagen el archivo de Drive? */
export function isDriveImage(file: DriveFile): boolean {
  return file.mimeType.startsWith("image/");
}

/**
 * Lista los archivos de una carpeta del inmueble para verificarlos desde la
 * web. Best-effort: si Drive no está configurado o falla, devuelve []. La
 * carpeta debe estar compartida con la cuenta de servicio.
 */
export async function listFolderFiles(folderId: string): Promise<DriveFile[]> {
  if (!isDriveConfigured() || !folderId) return [];
  try {
    const token = await getAccessToken();
    const params = new URLSearchParams({
      q: `'${folderId}' in parents and trashed = false`,
      fields:
        "files(id,name,mimeType,webViewLink,thumbnailLink,iconLink,modifiedTime)",
      orderBy: "folder,name",
      pageSize: "200",
      supportsAllDrives: "true",
      includeItemsFromAllDrives: "true",
    });
    const res = await fetch(`https://www.googleapis.com/drive/v3/files?${params}`, {
      headers: { Authorization: `Bearer ${token}` },
    });
    if (!res.ok) throw new Error(`Drive list error: ${res.status} ${await res.text()}`);
    const data = (await res.json()) as { files?: DriveFile[] };
    return data.files ?? [];
  } catch (err) {
    console.error("[drive] No se pudieron listar los archivos:", err);
    return [];
  }
}

/** Crea una carpeta dentro de `parentId` (o la raíz) y devuelve su id. */
async function createFolder(
  token: string,
  name: string,
  parentId: string | undefined = process.env.GOOGLE_DRIVE_ROOT_FOLDER_ID,
): Promise<string> {
  const res = await fetch("https://www.googleapis.com/drive/v3/files?fields=id&supportsAllDrives=true", {
    method: "POST",
    headers: { Authorization: `Bearer ${token}`, "Content-Type": "application/json" },
    body: JSON.stringify({
      name,
      mimeType: "application/vnd.google-apps.folder",
      parents: parentId ? [parentId] : undefined,
    }),
  });
  if (!res.ok) throw new Error(`Drive folder error: ${res.status} ${await res.text()}`);
  const data = (await res.json()) as { id: string };
  return data.id;
}

/** Busca una carpeta por nombre dentro de `parentId`; si no existe, la crea. */
async function findOrCreateFolder(token: string, name: string, parentId: string): Promise<string> {
  const q = `'${parentId}' in parents and name = '${name.replace(/'/g, "\\'")}' and mimeType = 'application/vnd.google-apps.folder' and trashed = false`;
  const params = new URLSearchParams({
    q,
    fields: "files(id,name)",
    pageSize: "1",
    supportsAllDrives: "true",
    includeItemsFromAllDrives: "true",
  });
  const res = await fetch(`https://www.googleapis.com/drive/v3/files?${params}`, {
    headers: { Authorization: `Bearer ${token}` },
  });
  if (res.ok) {
    const data = (await res.json()) as { files?: { id: string }[] };
    if (data.files?.[0]) return data.files[0].id;
  }
  return createFolder(token, name, parentId);
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
    const root = process.env.GOOGLE_DRIVE_ROOT_FOLDER_ID!;
    // Organización: raíz (db inmuebles) → Ciudad → Inmueble.
    const cityId = await findOrCreateFolder(token, p.ubicacion.ciudad || "Sin ciudad", root);
    const folderId = await createFolder(token, p.titulo, cityId);
    await uploadTextFile(token, folderId, "especificaciones.md", generateSpecDoc(p));
    return folderId;
  } catch (err) {
    console.error("[drive] No se pudo crear el archivo del inmueble:", err);
    return null;
  }
}

/* ───────────────────────── Importación desde Drive ───────────────────────── */

export interface DriveFolder {
  id: string;
  name: string;
}

/** Lista las subcarpetas de una carpeta dada. */
export async function listSubfolders(parentId: string): Promise<DriveFolder[]> {
  if (!isDriveConfigured() || !parentId) return [];
  try {
    const token = await getAccessToken();
    const params = new URLSearchParams({
      q: `'${parentId}' in parents and mimeType = 'application/vnd.google-apps.folder' and trashed = false`,
      fields: "files(id,name)",
      orderBy: "name",
      pageSize: "200",
      supportsAllDrives: "true",
      includeItemsFromAllDrives: "true",
    });
    const res = await fetch(`https://www.googleapis.com/drive/v3/files?${params}`, {
      headers: { Authorization: `Bearer ${token}` },
    });
    if (!res.ok) throw new Error(`Drive subfolders error: ${res.status} ${await res.text()}`);
    const data = (await res.json()) as { files?: DriveFolder[] };
    return data.files ?? [];
  } catch (err) {
    console.error("[drive] No se pudieron listar subcarpetas:", err);
    return [];
  }
}

/** Subcarpetas de la carpeta raíz (ciudades o inmuebles directos). */
export async function listRootFolders(): Promise<DriveFolder[]> {
  return listSubfolders(process.env.GOOGLE_DRIVE_ROOT_FOLDER_ID ?? "");
}

/** Descarga el contenido de texto de un archivo (p. ej. la ficha .md). */
export async function getFileText(fileId: string): Promise<string | null> {
  if (!isDriveConfigured()) return null;
  try {
    const token = await getAccessToken();
    const res = await fetch(
      `https://www.googleapis.com/drive/v3/files/${fileId}?alt=media&supportsAllDrives=true`,
      { headers: { Authorization: `Bearer ${token}` } },
    );
    if (!res.ok) return null;
    return await res.text();
  } catch {
    return null;
  }
}

/** Comparte un archivo como "cualquiera con el enlace puede ver" (best-effort). */
export async function makeFilePublic(fileId: string): Promise<void> {
  try {
    const token = await getAccessToken();
    await fetch(
      `https://www.googleapis.com/drive/v3/files/${fileId}/permissions?supportsAllDrives=true`,
      {
        method: "POST",
        headers: { Authorization: `Bearer ${token}`, "Content-Type": "application/json" },
        body: JSON.stringify({ role: "reader", type: "anyone" }),
      },
    );
  } catch (err) {
    console.error("[drive] No se pudo hacer pública la imagen:", err);
  }
}

/** URL embebible de una imagen pública de Drive (compatible con next/image). */
export function drivePublicImageUrl(fileId: string): string {
  return `https://lh3.googleusercontent.com/d/${fileId}=w1600`;
}

export interface ParsedSpec {
  fields: Record<string, string>;
  descripcionCorta: string;
  descripcion: string;
}

/**
 * Parsea el documento de especificaciones (el que genera `generateSpecDoc`).
 * Tolerante: ignora líneas vacías y admite el formato `clave: valor` antes del
 * separador `---`, y el bloque de descripción después.
 */
export function parseSpecDoc(text: string): ParsedSpec {
  const fields: Record<string, string> = {};
  let descripcionCorta = "";
  const descLines: string[] = [];

  const [head, ...rest] = text.split(/^---\s*$/m);
  for (const line of head.split("\n")) {
    const m = line.match(/^([a-z_]+):\s*(.*)$/i);
    if (m) fields[m[1].trim().toLowerCase()] = m[2].trim();
  }

  const tail = rest.join("---");
  let inDesc = false;
  for (const line of tail.split("\n")) {
    const corta = line.match(/^descripcion_corta:\s*(.*)$/i);
    if (corta) {
      descripcionCorta = corta[1].trim();
      continue;
    }
    if (/^descripcion:\s*$/i.test(line)) {
      inDesc = true;
      continue;
    }
    if (inDesc) descLines.push(line);
  }

  return { fields, descripcionCorta, descripcion: descLines.join("\n").trim() };
}
