import type { Property } from "@/lib/domain";
import { PROPERTY_STATUS_LABELS, PROPERTY_TYPE_LABELS } from "@/lib/domain";
import { siteConfig } from "@/lib/config/site";
import { getGoogleAccessToken, isGoogleServiceAccountConfigured } from "./google-auth";

/**
 * Catálogo plano del inventario en Google Sheets.
 *
 * Mantiene una hoja con TODA la información de cada inmueble, sincronizada
 * automáticamente al crear/editar/eliminar (incluido el estado). Usa la misma
 * cuenta de servicio que Drive + GOOGLE_SHEETS_SPREADSHEET_ID. La hoja debe
 * estar compartida con la cuenta de servicio como editor.
 */

const SHEETS_SCOPE = "https://www.googleapis.com/auth/spreadsheets";

export function isSheetsConfigured(): boolean {
  return isGoogleServiceAccountConfigured() && Boolean(process.env.GOOGLE_SHEETS_SPREADSHEET_ID);
}

/** URL editable de la hoja (para el botón "Abrir catálogo"). */
export function sheetUrl(): string | null {
  const id = process.env.GOOGLE_SHEETS_SPREADSHEET_ID;
  return id ? `https://docs.google.com/spreadsheets/d/${id}/edit` : null;
}

/** Encabezado del catálogo (el orden define las columnas). */
export const SHEET_HEADER = [
  "ID",
  "Código",
  "Título",
  "Tipo",
  "Estado",
  "Precio",
  "Administración",
  "Ciudad",
  "Sector",
  "Conjunto",
  "Dirección",
  "Habitaciones",
  "Baños",
  "Área (m²)",
  "Descripción",
  "Propietario",
  "Tel. propietario",
  "Email propietario",
  "Notas internas",
  "Publicado",
  "Destacado",
  "Carpeta Drive",
  "Fotos",
  "Slug",
  "Actualizado",
  "URL pública",
] as const;

type Cell = string | number;

/** Convierte un inmueble en una fila del catálogo (en el orden del encabezado). */
export function propertyToSheetRow(p: Property): Cell[] {
  const c = p.caracteristicas;
  const u = p.ubicacion;
  const fotos = p.medios.filter((m) => m.type === "image").length;
  return [
    p.id,
    p.codigo ?? "",
    p.titulo,
    PROPERTY_TYPE_LABELS[p.tipo],
    PROPERTY_STATUS_LABELS[p.estado],
    p.precio,
    p.administracion ?? "",
    u.ciudad,
    u.sector ?? "",
    u.conjunto ?? "",
    u.direccion ?? "",
    c.habitaciones ?? "",
    c.banos ?? "",
    c.area ?? "",
    p.descripcion,
    p.propietario?.nombre ?? "",
    p.propietario?.telefono ?? "",
    p.propietario?.email ?? "",
    p.notasInternas ?? "",
    p.publicado ? "Sí" : "No",
    p.destacado ? "Sí" : "No",
    p.driveFolderId ?? "",
    fotos,
    p.slug,
    p.actualizadoEn ?? "",
    `${siteConfig.url}/inmuebles/${p.slug}`,
  ];
}

/** Letra de columna (1 → A, 27 → AA, ...). */
function colLetter(n: number): string {
  let s = "";
  while (n > 0) {
    const r = (n - 1) % 26;
    s = String.fromCharCode(65 + r) + s;
    n = Math.floor((n - 1) / 26);
  }
  return s;
}

const LAST_COL = colLetter(SHEET_HEADER.length);
const API = "https://sheets.googleapis.com/v4/spreadsheets";

function spreadsheetId(): string {
  return process.env.GOOGLE_SHEETS_SPREADSHEET_ID!;
}

async function valuesGet(token: string, range: string): Promise<Cell[][]> {
  const res = await fetch(`${API}/${spreadsheetId()}/values/${encodeURIComponent(range)}`, {
    headers: { Authorization: `Bearer ${token}` },
  });
  if (!res.ok) throw new Error(`Sheets get error: ${res.status} ${await res.text()}`);
  const data = (await res.json()) as { values?: Cell[][] };
  return data.values ?? [];
}

async function valuesUpdate(token: string, range: string, values: Cell[][]): Promise<void> {
  const res = await fetch(
    `${API}/${spreadsheetId()}/values/${encodeURIComponent(range)}?valueInputOption=RAW`,
    {
      method: "PUT",
      headers: { Authorization: `Bearer ${token}`, "Content-Type": "application/json" },
      body: JSON.stringify({ values }),
    },
  );
  if (!res.ok) throw new Error(`Sheets update error: ${res.status} ${await res.text()}`);
}

async function valuesAppend(token: string, values: Cell[][]): Promise<void> {
  const res = await fetch(
    `${API}/${spreadsheetId()}/values/A1:append?valueInputOption=RAW&insertDataOption=INSERT_ROWS`,
    {
      method: "POST",
      headers: { Authorization: `Bearer ${token}`, "Content-Type": "application/json" },
      body: JSON.stringify({ values }),
    },
  );
  if (!res.ok) throw new Error(`Sheets append error: ${res.status} ${await res.text()}`);
}

async function valuesClear(token: string, range: string): Promise<void> {
  await fetch(`${API}/${spreadsheetId()}/values/${encodeURIComponent(range)}:clear`, {
    method: "POST",
    headers: { Authorization: `Bearer ${token}` },
  });
}

async function ensureHeader(token: string): Promise<void> {
  const head = await valuesGet(token, `A1:${LAST_COL}1`);
  if (!head.length || head[0]?.[0] !== SHEET_HEADER[0]) {
    await valuesUpdate(token, `A1:${LAST_COL}1`, [[...SHEET_HEADER]]);
  }
}

/**
 * Inserta o actualiza la fila de un inmueble (match por ID en la columna A).
 * Best-effort: nunca lanza, no bloquea las acciones del panel.
 */
export async function syncPropertyToSheet(p: Property): Promise<void> {
  if (!isSheetsConfigured()) return;
  try {
    const token = await getGoogleAccessToken(SHEETS_SCOPE);
    await ensureHeader(token);
    const ids = await valuesGet(token, "A2:A100000");
    const idx = ids.findIndex((row) => row[0] === p.id);
    const row = propertyToSheetRow(p);
    if (idx >= 0) {
      const rowNumber = idx + 2; // +2: salta encabezado y base 1
      await valuesUpdate(token, `A${rowNumber}:${LAST_COL}${rowNumber}`, [row]);
    } else {
      await valuesAppend(token, [row]);
    }
  } catch (err) {
    console.error("[sheets] No se pudo sincronizar el inmueble:", err);
  }
}

/**
 * Reescribe todo el catálogo (encabezado + todas las filas). Se usa al eliminar
 * y para la sincronización manual completa. Best-effort.
 */
export async function syncAllPropertiesToSheet(properties: Property[]): Promise<void> {
  if (!isSheetsConfigured()) return;
  try {
    const token = await getGoogleAccessToken(SHEETS_SCOPE);
    await valuesClear(token, `A1:${LAST_COL}100000`);
    const values: Cell[][] = [[...SHEET_HEADER], ...properties.map(propertyToSheetRow)];
    await valuesUpdate(token, `A1:${LAST_COL}${values.length}`, values);
  } catch (err) {
    console.error("[sheets] No se pudo reescribir el catálogo:", err);
  }
}
