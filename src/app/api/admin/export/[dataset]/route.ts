import { NextResponse } from "next/server";
import { getAdminSession } from "@/lib/auth";
import { construirCsv, construirPlantilla, DATASETS, esDataset, esPlantilla } from "@/lib/export/datasets";

/**
 * Descarga de datos del panel en CSV. Lleva datos personales (teléfonos, correos): exige la sesión de
 * administrador aquí mismo, porque el proxy solo cubre las rutas /admin y esta vive bajo /api.
 */
export const dynamic = "force-dynamic";

export async function GET(_req: Request, ctx: { params: Promise<{ dataset: string }> }) {
  if (!(await getAdminSession())) {
    return NextResponse.json({ ok: false, error: "No autorizado" }, { status: 401, headers: { "Cache-Control": "no-store" } });
  }
  const { dataset } = await ctx.params;
  if (esPlantilla(dataset)) {
    return new NextResponse(construirPlantilla(dataset), {
      status: 200,
      headers: {
        "Content-Type": "text/csv; charset=utf-8",
        "Content-Disposition": `attachment; filename="cic-${dataset}.csv"`,
        "Cache-Control": "no-store",
        "X-Content-Type-Options": "nosniff",
      },
    });
  }
  if (!esDataset(dataset)) {
    return NextResponse.json({ ok: false, error: "Conjunto de datos desconocido" }, { status: 404, headers: { "Cache-Control": "no-store" } });
  }

  let csv: string;
  try {
    csv = await construirCsv(dataset);
  } catch (err) {
    console.error(`[export] ${dataset}:`, err instanceof Error ? err.message : err);
    return NextResponse.json({ ok: false, error: `No se pudo preparar «${DATASETS[dataset]}»` }, { status: 500, headers: { "Cache-Control": "no-store" } });
  }

  const dia = new Date().toLocaleDateString("en-CA", { timeZone: "America/Bogota" });
  return new NextResponse(csv, {
    status: 200,
    headers: {
      "Content-Type": "text/csv; charset=utf-8",
      "Content-Disposition": `attachment; filename="cic-${dataset}-${dia}.csv"`,
      "Cache-Control": "no-store",
      "X-Content-Type-Options": "nosniff",
    },
  });
}
