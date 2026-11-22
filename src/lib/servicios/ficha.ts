import { revalidatePath } from "next/cache";
import { after } from "next/server";
import { getRepository } from "@/lib/data";
import { invalidarInventario } from "@/lib/data/inventario-tag";

function revalidar(slug: string) {
  invalidarInventario();
  revalidatePath("/");
  revalidatePath("/inmuebles");
  revalidatePath("/comparar");
  revalidatePath("/favoritos");
  revalidatePath(`/inmuebles/${slug}`);
  revalidatePath("/sitemap.xml");
  revalidatePath("/inmuebles/sector/[sector]", "page");
  revalidatePath("/admin/inmuebles");
}

/**
 * Refresca las páginas públicas. Desde la página de retorno del pago esto corre durante el render, donde
 * Next no permite revalidar: se intenta después de responder y, si tampoco se puede, las páginas se
 * renuevan solas al cumplirse su caché (hasta 6 h). La escritura en la base ya quedó hecha en cualquier caso.
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
  } catch (err) {
    console.error(`[vigencias] no se pudo comprobar la ficha ${slug}:`, err instanceof Error ? err.message : err);
    return false;
  }
}

/**
 * Publica o despublica una ficha y refresca las páginas públicas afectadas. Se busca por la llave del inmueble
 * (`propertyId`) y, si no hay, por su dirección: así un inmueble renombrado no se escapa de su vigencia.
 */
export async function fijarPublicacionDeFicha(slug: string, publicado: boolean, propertyId?: string | null): Promise<boolean> {
  try {
    const repo = getRepository().properties;
    const p = (propertyId ? await repo.getById(propertyId) : null) ?? (await repo.getBySlug(slug));
    // Despublicar una ficha que ya no existe no deja nada que apagar; publicarla sí es un error.
    if (!p) {
      console.warn(`[vigencias] la ficha ${slug} ya no existe (${publicado ? "no se puede publicar" : "nada que despublicar"})`);
      return !publicado;
    }
    if (p.publicado !== publicado) await repo.update(p.id, { publicado });
    refrescarPaginas(p.slug);
    return true;
  } catch (err) {
    console.error(`[vigencias] no se pudo ${publicado ? "publicar" : "despublicar"} ${slug}:`, err instanceof Error ? err.message : err);
    return false;
  }
}
