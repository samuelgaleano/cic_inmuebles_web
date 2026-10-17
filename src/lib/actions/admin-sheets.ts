"use server";

import { revalidatePath } from "next/cache";
import { exigirAdmin } from "@/lib/auth";
import { getRepository } from "@/lib/data";
import { isSheetsConfigured, syncAllPropertiesToSheet } from "@/lib/integrations/sheets";

/** Reescribe todo el catálogo en Google Sheets bajo demanda (botón manual). */
export async function resyncSheetAction(): Promise<void> {
  await exigirAdmin();
  if (isSheetsConfigured()) {
    const props = await getRepository().properties.list();
    await syncAllPropertiesToSheet(props);
  }
  revalidatePath("/admin/reportes");
}
