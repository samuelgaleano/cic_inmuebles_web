"use server";

import { revalidatePath } from "next/cache";
import { exigirAdmin } from "@/lib/auth";
import { invalidarInventario } from "@/lib/data/inventario-tag";
import { runDriveImport, type DriveImportState } from "@/lib/services/drive-import";

/** Acción del panel: importa desde Drive y revalida las vistas afectadas. */
export async function importPropertiesFromDriveAction(
  _prev: DriveImportState,
  _formData: FormData,
): Promise<DriveImportState> {
  await exigirAdmin();
  const result = await runDriveImport();
  invalidarInventario();
  revalidatePath("/admin/inmuebles");
  revalidatePath("/");
  revalidatePath("/inmuebles");
  revalidatePath("/comparar");
  revalidatePath("/favoritos");
  revalidatePath("/inmuebles/sector/[sector]", "page");
  return result;
}
