"use server";

import { revalidatePath } from "next/cache";
import { getRepository } from "@/lib/data";
import { isSheetsConfigured, syncAllPropertiesToSheet } from "@/lib/integrations/sheets";

/** Reescribe todo el catálogo en Google Sheets bajo demanda (botón manual). */
export async function resyncSheetAction(): Promise<void> {
  if (isSheetsConfigured()) {
    const props = await getRepository().properties.list();
    await syncAllPropertiesToSheet(props);
  }
  revalidatePath("/admin/reportes");
}
