import { revalidatePath } from "next/cache";
import { after } from "next/server";
import { getRepository } from "@/lib/data";

function revalidar(slug: string) {
  revalidatePath("/");
  revalidatePath("/inmuebles");
  revalidatePath(`/inmuebles/${slug}`);
  revalidatePath("/sitemap.xml");
  revalidatePath("/inmuebles/sector/[sector]", "page");
  revalidatePath("/admin/inmuebles");
}

/**
 * Refresca las páginas públicas. Desde la página de retorno del pago esto corre durante el render, donde
 * Next no permite revalidar: se intenta después de responder y, si tampoco se puede, las páginas se
 * renuevan solas al cumplirse su caché (1 h). La escritura en la base ya quedó hecha en cualquier caso.
 */
function refrescarPaginas(slug: string) {
  try {
    revalidar(slug);
  } catch {
    try {
      after(() => {
        try {
          revalidar(slug);
        } catch (err) {
          console.warn(`[vigencias] no se pudo revalidar ${slug} tras responder:`, err instanceof Error ? err.message : err);
        }
      });
    } catch {
      console.warn(`[vigencias] ${slug} se actualizará con la caché (no se pudo revalidar ahora)`);
    }
  }
}

/** ¿Existe una ficha con ese slug? */
export async function existeFicha(slug: string): Promise<boolean> {
  try {
    return Boolean(await getRepository().properties.getBySlug(slug));
  } catch {
    return false;
  }
}

/** Publica o despublica una ficha por su slug y refresca las páginas públicas afectadas. */
export async function fijarPublicacionDeFicha(slug: string, publicado: boolean): Promise<boolean> {
  try {
    const repo = getRepository().properties;
    const p = await repo.getBySlug(slug);
    // Despublicar una ficha que ya no existe no deja nada que apagar; publicarla sí es un error.
    if (!p) return !publicado;
    if (p.publicado !== publicado) await repo.update(p.id, { publicado });
    refrescarPaginas(slug);
    return true;
  } catch (err) {
    console.error(`[vigencias] no se pudo ${publicado ? "publicar" : "despublicar"} ${slug}:`, err instanceof Error ? err.message : err);
    return false;
  }
}
