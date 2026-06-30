import { NextResponse } from "next/server";
import { runDriveImport } from "@/lib/services/drive-import";
import { getRepository } from "@/lib/data";
import { isSheetsConfigured, syncAllPropertiesToSheet } from "@/lib/integrations/sheets";

/**
 * Sincronización automática (Drive → catálogo → Sheets).
 *
 * Lo invoca el Cron de Vercel (ver vercel.json). Vercel añade el header
 * `Authorization: Bearer <CRON_SECRET>` cuando la variable CRON_SECRET está
 * configurada. Requiere CRON_SECRET; si no, responde 401.
 */
export const dynamic = "force-dynamic";
export const maxDuration = 60;

function authorized(req: Request): boolean {
  const secret = process.env.CRON_SECRET;
  if (!secret) return false;
  return req.headers.get("authorization") === `Bearer ${secret}`;
}

export async function GET(req: Request) {
  if (!authorized(req)) {
    return NextResponse.json({ ok: false, error: "No autorizado" }, { status: 401 });
  }

  const result = await runDriveImport();

  // Reescribe el catálogo de Sheets completo (refleja estados/ediciones).
  if (isSheetsConfigured()) {
    try {
      await syncAllPropertiesToSheet(await getRepository().properties.list());
    } catch (err) {
      console.error("[cron/sync] Sheets:", err);
    }
  }

  return NextResponse.json({ at: new Date().toISOString(), ...result });
}
