"use server";

import { revalidatePath } from "next/cache";
import { getRepository } from "@/lib/data";
import {
  drivePublicImageUrl,
  getDocText,
  isDriveConfigured,
  isDriveImage,
  listFolderFiles,
  listRootFolders,
  listSubfolders,
  makeFilePublic,
  parseSpecDoc,
  type DriveFile,
  type DriveFolder,
} from "@/lib/integrations/drive";
import { isSheetsConfigured, syncAllPropertiesToSheet } from "@/lib/integrations/sheets";
import {
  OPERATIONS,
  OPERATION_LABELS,
  PROPERTY_STATUSES,
  PROPERTY_STATUS_LABELS,
  PROPERTY_TYPES,
  PROPERTY_TYPE_LABELS,
  type Operation,
  type PropertyInput,
  type PropertyMedia,
  type PropertyStatus,
  type PropertyType,
} from "@/lib/domain";

export interface DriveImportState {
  ran?: boolean;
  ok?: boolean;
  message?: string;
  created?: { id: string; titulo: string; slug: string; fotos: number }[];
  skipped?: number;
  errors?: string[];
}

/* ── Utilidades de mapeo ── */

function matchEnum<T extends string>(
  value: string | undefined,
  keys: readonly T[],
  labels: Record<T, string>,
): T | undefined {
  if (!value) return undefined;
  const v = value.trim().toLowerCase();
  for (const k of keys) {
    if (k.toLowerCase() === v || labels[k].toLowerCase() === v) return k;
  }
  return undefined;
}

function parseNum(v?: string): number | undefined {
  if (!v) return undefined;
  const n = Number(v.replace(/[^0-9.-]/g, ""));
  return Number.isFinite(n) ? n : undefined;
}

const CITY_FIX: Record<string, string> = {
  bogota: "Bogotá",
  "bogota dc": "Bogotá",
  "bogota d.c.": "Bogotá",
  medellin: "Medellín",
  cali: "Cali",
  barranquilla: "Barranquilla",
  cartagena: "Cartagena",
  bucaramanga: "Bucaramanga",
  cucuta: "Cúcuta",
  pereira: "Pereira",
  manizales: "Manizales",
  ibague: "Ibagué",
  "santa marta": "Santa Marta",
  villavicencio: "Villavicencio",
  armenia: "Armenia",
  pasto: "Pasto",
  neiva: "Neiva",
  monteria: "Montería",
  popayan: "Popayán",
  "la calera": "La Calera",
  chia: "Chía",
  soacha: "Soacha",
};

function normalizeCity(name: string): string {
  const key = name.trim().toLowerCase();
  if (CITY_FIX[key]) return CITY_FIX[key];
  return name.trim().replace(/\b\p{L}/gu, (c) => c.toUpperCase());
}

/** Estado a partir del nombre de la carpeta de estado ("inmuebles disponibles"). */
function estadoFromFolderName(name: string): PropertyStatus | undefined {
  if (/vendid/i.test(name)) return "vendido";
  if (/proceso|reserv|negociaci/i.test(name)) return "en_proceso";
  if (/disponible/i.test(name)) return "disponible";
  return undefined;
}

/** Limpia el nombre de carpeta para un título legible. */
function cleanTitle(raw: string): string {
  const t = raw
    .replace(/[_]+/g, " ")
    .replace(/\s*-\s*/g, " ")
    .replace(/\?+/g, "")
    .replace(/\s+/g, " ")
    .trim();
  return t.replace(/\b\p{L}/gu, (c) => c.toUpperCase());
}

// Carpetas de primer nivel que NO son ciudades ni inmuebles.
const IGNORE_RE = /seguimiento|plantilla|template|^\s*info\b|no.?importar|papelera|respaldo|backup/i;
// Subcarpeta con las fotos/videos del inmueble.
const MEDIA_RE = /contenido|audiovisual|fotos|im[aá]gen|galer[ií]a|visual/i;
// Subcarpeta con la ficha/documento de información.
const INFO_RE = /info|especific|ficha|descrip/i;

const MAX_IMAGES = 30;
const MAX_DEPTH = 5;

interface Ctx {
  city?: string;
  estado?: PropertyStatus;
}

/**
 * Importa inmuebles desde Google Drive recorriendo la estructura
 * raíz → Ciudad → (Estado) → Inmueble. Cada carpeta de inmueble se reconoce
 * porque tiene una subcarpeta de "contenido" (fotos) o imágenes sueltas.
 * - Ciudad: de la carpeta de ciudad. Estado: de la carpeta "inmuebles X".
 * - Fotos: de la subcarpeta de contenido (se comparten como públicas).
 * - Datos: del `especificaciones.md` o un Google Doc si existe (el .docx de
 *   Word no se puede leer; queda accesible desde el panel para completarlo).
 * Se importa como borrador. No duplica (omite los ya traídos por carpeta).
 */
export async function importPropertiesFromDriveAction(
  _prev: DriveImportState,
  _formData: FormData,
): Promise<DriveImportState> {
  if (!isDriveConfigured()) {
    return {
      ran: true,
      ok: false,
      message:
        "Google Drive no está configurado. Agrega GOOGLE_SERVICE_ACCOUNT_EMAIL, GOOGLE_PRIVATE_KEY y GOOGLE_DRIVE_ROOT_FOLDER_ID en Vercel.",
    };
  }

  const repo = getRepository();
  const created: NonNullable<DriveImportState["created"]> = [];
  const errors: string[] = [];
  let skipped = 0;
  let importedFolderIds = new Set<string>();

  /** Crea el inmueble (borrador) a partir de su carpeta. */
  const importProperty = async (folder: DriveFolder, files: DriveFile[], subs: DriveFolder[], ctx: Ctx) => {
    if (importedFolderIds.has(folder.id)) {
      skipped++;
      return;
    }
    try {
      // Fotos: imágenes sueltas + las de las subcarpetas de "contenido".
      let imageFiles = files.filter(isDriveImage);
      for (const sub of subs.filter((s) => MEDIA_RE.test(s.name))) {
        const mf = await listFolderFiles(sub.id);
        imageFiles = imageFiles.concat(mf.filter(isDriveImage));
      }
      const images = imageFiles.slice(0, MAX_IMAGES);
      await Promise.all(images.map((f) => makeFilePublic(f.id)));
      const medios: PropertyMedia[] = images.map((f, i) => ({
        id: `drive-${f.id}`,
        type: "image",
        provider: "drive",
        url: drivePublicImageUrl(f.id),
        alt: f.name,
        order: i,
        isCover: i === 0,
      }));

      // Ficha legible (.md/.txt o Google Doc): en la carpeta o en subcarpeta "info".
      let specPool = files.slice();
      const infoSub = subs.find((s) => INFO_RE.test(s.name) && !MEDIA_RE.test(s.name));
      if (infoSub) specPool = specPool.concat(await listFolderFiles(infoSub.id));
      const specFile =
        specPool.find((f) => /\.(md|txt)$/i.test(f.name)) ??
        specPool.find((f) => f.mimeType === "application/vnd.google-apps.document");
      const specText = specFile ? await getDocText(specFile) : null;
      const spec = specText ? parseSpecDoc(specText) : null;
      const fields = spec?.fields ?? {};

      // Código y título desde el nombre de carpeta "1006-palmeira-mazuren".
      const m = folder.name.trim().match(/^(\d{2,})\s*[-–]\s*(.+)$/);
      const codigo = m?.[1];
      const folderTitulo = cleanTitle(m ? m[2] : folder.name);

      const ciudadRaw = (fields.ciudad || ctx.city || "").trim();

      const input: PropertyInput = {
        codigo,
        titulo: fields.titulo || folderTitulo,
        tipo: matchEnum<PropertyType>(fields.tipo, PROPERTY_TYPES, PROPERTY_TYPE_LABELS) ?? "apartamento",
        operacion: matchEnum<Operation>(fields.operacion, OPERATIONS, OPERATION_LABELS) ?? "venta",
        estado:
          matchEnum<PropertyStatus>(fields.estado, PROPERTY_STATUSES, PROPERTY_STATUS_LABELS) ??
          ctx.estado ??
          "disponible",
        precio: parseNum(fields.precio) ?? 0,
        moneda: "COP",
        ubicacion: {
          departamento: fields.departamento || "Por definir",
          ciudad: ciudadRaw ? normalizeCity(ciudadRaw) : "Por definir",
          barrio: fields.barrio || undefined,
          direccion: fields.direccion || undefined,
          lat: parseNum(fields.lat),
          lng: parseNum(fields.lng),
        },
        caracteristicas: {
          habitaciones: parseNum(fields.habitaciones),
          banos: parseNum(fields.banos),
          areaConstruida: parseNum(fields.area_construida),
          areaTotal: parseNum(fields.area_total),
          parqueaderos: parseNum(fields.parqueaderos),
          estrato: parseNum(fields.estrato),
          administracion: parseNum(fields.administracion),
        },
        amenidades: (fields.amenidades || "")
          .split(/[\n,]+/)
          .map((a) => a.trim())
          .filter(Boolean),
        descripcion: spec?.descripcion || "",
        descripcionCorta: spec?.descripcionCorta || folderTitulo,
        medios,
        propietario: fields.propietario_nombre
          ? {
              nombre: fields.propietario_nombre,
              telefono: fields.propietario_telefono || "",
              email: fields.propietario_email || undefined,
            }
          : undefined,
        driveFolderId: folder.id,
        destacado: false,
        publicado: false, // borrador para revisión
      };

      const prop = await repo.properties.create(input);
      created.push({ id: prop.id, titulo: prop.titulo, slug: prop.slug, fotos: medios.length });
    } catch (err) {
      console.error(`[drive-import] Error en "${folder.name}":`, err);
      errors.push(`No se pudo importar "${folder.name.trim()}".`);
    }
  };

  /** Recorre la jerarquía detectando ciudades, estados e inmuebles. */
  const walk = async (folder: DriveFolder, ctx: Ctx, depth: number) => {
    if (depth > MAX_DEPTH || IGNORE_RE.test(folder.name)) return;

    const ctx2: Ctx = { ...ctx };
    const est = estadoFromFolderName(folder.name);
    const isStatusLevel = Boolean(est);
    if (est) ctx2.estado = est;

    const [files, subs] = await Promise.all([
      listFolderFiles(folder.id),
      listSubfolders(folder.id),
    ]);

    const hasMedia = subs.some((s) => MEDIA_RE.test(s.name));
    const hasImages = files.some(isDriveImage);

    if (hasMedia || hasImages) {
      // Es una carpeta de INMUEBLE.
      await importProperty(folder, files, subs, ctx2);
      return;
    }

    // Es una agrupación. El primer nivel sin estado define la CIUDAD.
    if (!isStatusLevel && !ctx2.city) ctx2.city = normalizeCity(folder.name);
    for (const sub of subs) await walk(sub, ctx2, depth + 1);
  };

  try {
    const existing = await repo.properties.list();
    importedFolderIds = new Set(
      existing.map((p) => p.driveFolderId).filter(Boolean) as string[],
    );

    const top = await listRootFolders();
    if (top.length === 0) {
      return {
        ran: true,
        ok: true,
        message:
          "No se encontraron carpetas en la raíz de Drive. Crea las carpetas de ciudad (Bogotá, Cali…) con sus inmuebles dentro.",
        created: [],
        skipped: 0,
      };
    }

    for (const node of top) await walk(node, {}, 1);
  } catch (err) {
    console.error("[drive-import] Error general:", err);
    return {
      ran: true,
      ok: false,
      message: "No se pudo conectar con Google Drive. Revisa las credenciales y que la carpeta esté compartida con la cuenta de servicio.",
    };
  }

  if (created.length && isSheetsConfigured()) {
    await syncAllPropertiesToSheet(await repo.properties.list());
  }

  revalidatePath("/admin/inmuebles");
  revalidatePath("/");
  revalidatePath("/inmuebles");

  const parts: string[] = [];
  if (created.length) parts.push(`${created.length} inmueble(s) importado(s)`);
  if (skipped) parts.push(`${skipped} ya estaban importados`);
  if (errors.length) parts.push(`${errors.length} con error`);

  return {
    ran: true,
    ok: true,
    message: parts.length ? parts.join(" · ") : "No había inmuebles nuevos para importar.",
    created,
    skipped,
    errors,
  };
}
