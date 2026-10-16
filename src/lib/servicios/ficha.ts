import { revalidatePath } from "next/cache";
import { getRepository } from "@/lib/data";

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
    revalidatePath("/");
    revalidatePath("/inmuebles");
    revalidatePath(`/inmuebles/${slug}`);
    revalidatePath("/sitemap.xml");
    revalidatePath("/inmuebles/sector/[sector]", "page");
    revalidatePath("/admin/inmuebles");
    return true;
  } catch (err) {
    console.error(`[vigencias] no se pudo ${publicado ? "publicar" : "despublicar"} ${slug}:`, err instanceof Error ? err.message : err);
    return false;
  }
}
