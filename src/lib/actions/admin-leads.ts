"use server";

import { revalidatePath } from "next/cache";
import { getRepository } from "@/lib/data";
import { LEAD_STATUSES, type LeadStatus } from "@/lib/domain";

export async function setLeadStatusAction(formData: FormData): Promise<void> {
  const id = String(formData.get("id") ?? "");
  const estado = String(formData.get("estado") ?? "") as LeadStatus;
  if (id && LEAD_STATUSES.includes(estado)) {
    await getRepository().leads.updateStatus(id, estado);
    revalidatePath("/admin/leads");
    revalidatePath("/admin");
  }
}

export async function deleteLeadAction(formData: FormData): Promise<void> {
  const id = String(formData.get("id") ?? "");
  if (id) {
    await getRepository().leads.remove(id);
    revalidatePath("/admin/leads");
    revalidatePath("/admin");
  }
}
