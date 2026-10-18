"use server";

import { revalidatePath } from "next/cache";
import { exigirAdmin } from "@/lib/auth";
import { importarHoja, type ResultadoImportacion } from "@/lib/crm/importar";
import { getCrmStore } from "@/lib/crm/store";
import { getRepository } from "@/lib/data";

const MAX_BYTES = 1_000_000;

/** Estado del formulario de carga: nada todavía, o el resultado de la última simulación o carga. */
export type EstadoCarga = ResultadoImportacion | null;

/**
 * Carga vendedores o compradores desde una hoja (archivo CSV o texto pegado). El botón «Revisar» solo simula
 * y cuenta; «Cargar» escribe. Los errores se devuelven fila por fila y no frenan las filas buenas.
 */
export async function importarHojaAction(_prev: EstadoCarga, formData: FormData): Promise<EstadoCarga> {
  await exigirAdmin();
  const tipo = String(formData.get("tipo") ?? "");
  const simular = String(formData.get("modo") ?? "simular") !== "importar";
  const vacio: ResultadoImportacion = { simulacion: simular, filas: 0, contactosNuevos: 0, contactosExistentes: 0, creados: 0, yaExistian: 0, propuestas: 0, errores: [] };
  if (tipo !== "vendedores" && tipo !== "compradores") return { ...vacio, fatal: "Elige si la hoja es de vendedores o de compradores." };

  let texto = String(formData.get("texto") ?? "");
  const archivo = formData.get("archivo");
  if (archivo instanceof File && archivo.size > 0) {
    if (archivo.size > MAX_BYTES) return { ...vacio, fatal: "El archivo pesa más de 1 MB. Divide la hoja." };
    texto = await archivo.text();
  }
  if (texto.length > MAX_BYTES) return { ...vacio, fatal: "El texto es demasiado largo. Divide la hoja." };
  if (!texto.trim()) return { ...vacio, fatal: "Sube el archivo CSV o pega la hoja aquí." };

  try {
    const inmuebles = (await getRepository().properties.list()).map((p) => ({ id: p.id, codigo: p.codigo, slug: p.slug }));
    const resultado = await importarHoja(tipo, texto, { crm: getCrmStore(), inmuebles }, { simular });
    if (!simular) revalidatePath("/admin/crm");
    return resultado;
  } catch (err) {
    console.error("[datos/importar]", err instanceof Error ? err.message : err);
    return { ...vacio, fatal: "No se pudo leer la hoja. Revisa que sea un CSV o texto copiado de la hoja y que el CRM tenga sus tablas." };
  }
}
