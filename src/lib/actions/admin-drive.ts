"use server";

import { revalidatePath } from "next/cache";
import { runDriveImport, type DriveImportState } from "@/lib/services/drive-import";

/** Acción del panel: importa desde Drive y revalida las vistas afectadas. */
export async function importPropertiesFromDriveAction(
  _prev: DriveImportState,
  _formData: FormData,
): Promise<DriveImportState> {
  const result = await runDriveImport();
  revalidatePath("/admin/inmuebles");
  revalidatePath("/");
  revalidatePath("/inmuebles");
  return result;
}
