import { NextResponse } from "next/server";
import { runDriveImport, type DriveImportState } from "@/lib/services/drive-import";
import { getRepository } from "@/lib/data";
import { isSheetsConfigured, syncAllPropertiesToSheet } from "@/lib/integrations/sheets";
import { autorizadoCron } from "@/lib/auth/cron";
import { sendPagosAlert } from "@/lib/notifications/payment";

/**
 * Sincronización automática (Drive → catálogo → Sheets).
 *
 * Lo invoca el Cron de Vercel (ver vercel.json). Vercel añade el header
 * `Authorization: Bearer <CRON_SECRET>` cuando la variable CRON_SECRET está
 * configurada. Requiere CRON_SECRET; si no, responde 401.
 *
 * Si algo falla se avisa a Pixies con `sendPagosAlert`. El aviso lleva solo
 * qué tarea falló y cuántos errores hubo: ni nombres de carpetas ni datos de
 * nadie (el detalle queda en los logs de Vercel).
 */
export const dynamic = "force-dynamic";
export const maxDuration = 60;

async function avisarFallo(lineas: string[]): Promise<void> {
  try {
    await sendPagosAlert(
      "Cron de sincronización Drive/Sheets con fallos",
      [...lineas, "", "Detalle en los logs de Vercel de /api/cron/sync."].join("\n"),
    );
  } catch (err) {
    console.error("[cron/sync] no se pudo enviar la alerta:", err instanceof Error ? err.message : err);
  }
}

export async function GET(req: Request) {
  if (!autorizadoCron(req)) {
    return NextResponse.json({ ok: false, error: "No autorizado" }, { status: 401 });
  }

  const fallos: string[] = [];

  let result: DriveImportState;
  try {
    result = await runDriveImport();
  } catch (err) {
    console.error("[cron/sync] la importación desde Drive falló:", err);
    result = { ran: true, ok: false, message: "La importación desde Drive lanzó un error." };
  }
  if (result.ok === false) {
    // `message` es siempre un texto fijo de drive-import (sin datos de inmuebles ni personas).
    fallos.push(`Importación desde Drive: ${result.message ?? "falló"}`);
  } else if (result.errors?.length) {
    fallos.push(`Importación desde Drive: ${result.errors.length} carpeta(s) con error.`);
  }

  // Reescribe el catálogo de Sheets completo (refleja estados/ediciones).
  if (isSheetsConfigured()) {
    try {
      await syncAllPropertiesToSheet(await getRepository().properties.list());
    } catch (err) {
      console.error("[cron/sync] Sheets:", err);
      fallos.push("Sincronización con Google Sheets: falló.");
    }
  }

  if (fallos.length) await avisarFallo(fallos);

  // 500 si la importación no corrió: así el fallo también se ve en el panel de Crons de Vercel.
  return NextResponse.json({ at: new Date().toISOString(), ...result }, { status: result.ok === false ? 500 : 200 });
}
