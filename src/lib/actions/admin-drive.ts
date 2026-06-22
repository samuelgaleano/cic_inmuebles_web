"use server";

import { revalidatePath } from "next/cache";
import { getRepository } from "@/lib/data";
import {
  drivePublicImageUrl,
  getFileText,
  isDriveConfigured,
  isDriveImage,
  listFolderFiles,
  listRootFolders,
  makeFilePublic,
  parseSpecDoc,
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

/** Encuentra la clave de un enum a partir de su clave o su etiqueta legible. */
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

const MAX_IMAGES = 24;

/**
 * Importa inmuebles desde Google Drive: cada subcarpeta de la carpeta raíz se
 * convierte en un inmueble (borrador), tomando las fotos y, si existe, la ficha
 * de especificaciones. Los inmuebles ya importados (mismo driveFolderId) se
 * omiten. Las fotos se comparten como públicas para poder mostrarse en el sitio.
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

  try {
    const existing = await repo.properties.list();
    const importedFolderIds = new Set(
      existing.map((p) => p.driveFolderId).filter(Boolean) as string[],
    );

    const folders = await listRootFolders();
    if (folders.length === 0) {
      return {
        ran: true,
        ok: true,
        message:
          "No se encontraron carpetas en la carpeta raíz de Drive. Crea una carpeta por inmueble (con fotos y, opcional, una ficha .md) y vuelve a intentar.",
        created: [],
        skipped: 0,
      };
    }

    for (const folder of folders) {
      if (importedFolderIds.has(folder.id)) {
        skipped++;
        continue;
      }
      try {
        const files = await listFolderFiles(folder.id);

        // Ficha de especificaciones (opcional)
        const specFile = files.find(
          (f) => /espec/i.test(f.name) || /\.(md|txt)$/i.test(f.name),
        );
        const specText = specFile ? await getFileText(specFile.id) : null;
        const spec = specText ? parseSpecDoc(specText) : null;
        const fields = spec?.fields ?? {};

        // Fotos -> públicas + URL embebible
        const images = files.filter(isDriveImage).slice(0, MAX_IMAGES);
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

        // Título / ciudad a partir del nombre de carpeta "Título – Ciudad"
        const parts = folder.name.split(/\s[–-]\s/);
        const folderTitulo = (parts[0] ?? folder.name).trim();
        const folderCiudad = parts.length > 1 ? parts[parts.length - 1].trim() : undefined;

        const input: PropertyInput = {
          titulo: fields.titulo || folderTitulo,
          tipo: matchEnum<PropertyType>(fields.tipo, PROPERTY_TYPES, PROPERTY_TYPE_LABELS) ?? "apartamento",
          operacion: matchEnum<Operation>(fields.operacion, OPERATIONS, OPERATION_LABELS) ?? "venta",
          estado: matchEnum<PropertyStatus>(fields.estado, PROPERTY_STATUSES, PROPERTY_STATUS_LABELS) ?? "disponible",
          precio: parseNum(fields.precio) ?? 0,
          moneda: "COP",
          ubicacion: {
            departamento: fields.departamento || "Por definir",
            ciudad: fields.ciudad || folderCiudad || "Por definir",
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
          // Se importa como borrador para revisión antes de publicar.
          destacado: false,
          publicado: false,
        };

        const prop = await repo.properties.create(input);
        created.push({ id: prop.id, titulo: prop.titulo, slug: prop.slug, fotos: medios.length });
      } catch (err) {
        console.error(`[drive-import] Error en carpeta "${folder.name}":`, err);
        errors.push(`No se pudo importar "${folder.name}".`);
      }
    }
  } catch (err) {
    console.error("[drive-import] Error general:", err);
    return { ran: true, ok: false, message: "No se pudo conectar con Google Drive. Revisa las credenciales y el acceso a la carpeta." };
  }

  // Refleja los nuevos inmuebles en el catálogo de Google Sheets (best-effort).
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
    message: parts.length ? parts.join(" · ") : "No había carpetas nuevas para importar.",
    created,
    skipped,
    errors,
  };
}
