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
import { isCloudinaryConfigured, uploadRemoteImage } from "@/lib/integrations/cloudinary";
import {
  PROPERTY_STATUSES,
  PROPERTY_STATUS_LABELS,
  PROPERTY_TYPES,
  PROPERTY_TYPE_LABELS,
  type MediaProvider,
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
  // Formato Colombia: punto = separador de miles, coma = decimal.
  // Ej. "720.000.000" -> 720000000 ; "74,5 m²" -> 74.5 ; "$ 950.000" -> 950000.
  const s = v.replace(/[^0-9,]/g, "").replace(",", ".");
  if (s === "") return undefined;
  const n = Number(s);
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

function estadoFromFolderName(name: string): PropertyStatus | undefined {
  if (/vendid/i.test(name)) return "vendido";
  if (/proceso|reserv|negociaci/i.test(name)) return "en_proceso";
  if (/disponible/i.test(name)) return "disponible";
  return undefined;
}

function cleanTitle(raw: string): string {
  const t = raw
    .replace(/[_]+/g, " ")
    .replace(/\s*-\s*/g, " ")
    .replace(/\?+/g, "")
    .replace(/\s+/g, " ")
    .trim();
  return t.replace(/\b\p{L}/gu, (c) => c.toUpperCase());
}

const IGNORE_RE = /seguimiento|plantilla|template|^\s*info\b|no.?importar|papelera|respaldo|backup/i;
const MEDIA_RE = /contenido|audiovisual|fotos|im[aá]gen|galer[ií]a|visual/i;
const INFO_RE = /info|especific|ficha|descrip/i;

const MAX_IMAGES = 30;
const MAX_DEPTH = 5;

interface Ctx {
  city?: string;
  estado?: PropertyStatus;
}

/**
 * Recorre Google Drive (raíz → Ciudad → Estado → Inmueble) e importa cada
 * inmueble nuevo como borrador con sus fotos. Reutilizable desde el panel
 * (acción) y desde el cron (sincronización automática). Best-effort.
 */
export async function runDriveImport(): Promise<DriveImportState> {
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

  const importProperty = async (folder: DriveFolder, files: DriveFile[], subs: DriveFolder[], ctx: Ctx) => {
    if (importedFolderIds.has(folder.id)) {
      skipped++;
      return;
    }
    try {
      // Fotos: recoge imágenes de la carpeta y de TODO su subárbol (carpetas de
      // "contenido", incluso anidadas a varios niveles), hasta el tope. Robusto
      // sin importar cómo de profundo guarde el equipo las fotos.
      const imageFiles: DriveFile[] = [];
      const collectImages = async (fls: DriveFile[], sbs: DriveFolder[], depth: number) => {
        for (const f of fls) if (isDriveImage(f)) imageFiles.push(f);
        if (depth >= 3 || imageFiles.length >= MAX_IMAGES) return;
        for (const s of sbs) {
          if (imageFiles.length >= MAX_IMAGES) break;
          const [f2, s2] = await Promise.all([listFolderFiles(s.id), listSubfolders(s.id)]);
          await collectImages(f2, s2, depth + 1);
        }
      };
      await collectImages(files, subs, 0);
      const images = imageFiles.slice(0, MAX_IMAGES);
      await Promise.all(images.map((f) => makeFilePublic(f.id)));
      // Motor visual único: si Cloudinary está configurado, re-alojamos cada foto
      // ahí (CDN + optimización); si no, usamos la URL pública de Drive como
      // respaldo. Así el catálogo público es óptimo venga de donde venga.
      const useCloudinary = isCloudinaryConfigured();
      const medios: PropertyMedia[] = await Promise.all(
        images.map(async (f, i) => {
          const driveUrl = drivePublicImageUrl(f.id);
          let url = driveUrl;
          let provider: MediaProvider = "drive";
          if (useCloudinary) {
            const up = await uploadRemoteImage(driveUrl);
            if (up) {
              url = up.url;
              provider = "cloudinary";
            }
          }
          return {
            id: `drive-${f.id}`,
            type: "image" as const,
            provider,
            url,
            alt: f.name,
            order: i,
            isCover: i === 0,
          };
        }),
      );

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
        estado:
          matchEnum<PropertyStatus>(fields.estado, PROPERTY_STATUSES, PROPERTY_STATUS_LABELS) ??
          ctx.estado ??
          "disponible",
        precio: parseNum(fields.precio) ?? 0,
        administracion: parseNum(fields.administracion),
        ubicacion: {
          ciudad: ciudadRaw ? normalizeCity(ciudadRaw) : "Por definir",
          sector: fields.sector || fields.barrio || undefined,
          conjunto: fields.conjunto || undefined,
          direccion: fields.direccion || undefined,
        },
        caracteristicas: {
          habitaciones: parseNum(fields.habitaciones),
          banos: parseNum(fields.banos),
          area: parseNum(fields.area) ?? parseNum(fields.area_construida),
        },
        descripcion: spec?.descripcion || spec?.descripcionCorta || "",
        medios,
        propietario: fields.propietario_nombre
          ? {
              nombre: fields.propietario_nombre,
              telefono: fields.propietario_telefono || "",
              email: fields.propietario_email || undefined,
            }
          : undefined,
        notasInternas: fields.notas_internas || undefined,
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
      await importProperty(folder, files, subs, ctx2);
      return;
    }

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
      message:
        "No se pudo conectar con Google Drive. Revisa las credenciales y que la carpeta esté compartida con la cuenta de servicio.",
    };
  }

  // Sincroniza el catálogo completo en Google Sheets (best-effort).
  if (created.length && isSheetsConfigured()) {
    await syncAllPropertiesToSheet(await repo.properties.list());
  }

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
