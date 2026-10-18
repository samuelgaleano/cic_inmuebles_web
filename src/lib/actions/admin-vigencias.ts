"use server";

import { revalidatePath } from "next/cache";
import { getAdminSession } from "@/lib/auth";
import { correoPublicacionActiva } from "@/lib/servicios/correos";
import { existeFicha, fijarPublicacionDeFicha } from "@/lib/servicios/ficha";
import { defaultServiciosDeps, revisarVencimientos } from "@/lib/servicios/procesar";
import { getRepository } from "@/lib/data";
import { getServiciosStore } from "@/lib/servicios/store";
import { sendEmail } from "@/lib/notifications/resend";
import { ventanaDeActivacion, ventanaDeRenovacion } from "@/lib/servicios/vigencia";

/** Acciones del panel de vigencias. Todas exigen sesión de administrador. */
async function exigirSesion(): Promise<boolean> {
  return Boolean(await getAdminSession());
}

function texto(v: FormDataEntryValue | null): string {
  return String(v ?? "").trim();
}

const SLUG = /^[a-z0-9]+(?:-[a-z0-9]+)*$/;

function refrescar() {
  revalidatePath("/admin/vigencias");
}

/** Id del inmueble de esa ficha (la llave foránea); null si no hay ficha. */
async function idDeFicha(slug: string): Promise<string | null> {
  if (!slug) return null;
  return (await getRepository().properties.getBySlug(slug))?.id ?? null;
}

/** Empieza a contar la vigencia hoy; si hay ficha, la publica. Avisa al cliente por correo. */
export async function activarServicioAction(formData: FormData): Promise<void> {
  if (!(await exigirSesion())) return;
  const id = texto(formData.get("id"));
  const slug = texto(formData.get("slug")).toLowerCase();
  if (!id || (slug && !SLUG.test(slug))) return;

  const store = getServiciosStore();
  const s = await store.obtener(id);
  if (!s || s.estado !== "pendiente_publicar") return;

  if (slug && !(await fijarPublicacionDeFicha(slug, true))) return; // ficha inexistente: no se activa a ciegas

  // Renovación: si la ficha ya está cubierta por otro servicio vigente, se le suma lo que le quedaba y ese se cierra sin despublicar.
  const ahora = new Date();
  const previos = slug
    ? (await store.listarParaRevision()).filter((o) => o.id !== id && o.estado === "activo" && o.propertySlug === slug && o.venceAt && new Date(o.venceAt) > ahora)
    : [];
  const hasta = previos.map((o) => o.venceAt as string).sort().pop() ?? null;
  const { inicioAt, venceAt } = ventanaDeActivacion(ahora, s.dias, hasta);
  const activo = await store.activar(id, { propertySlug: slug || null, propertyId: await idDeFicha(slug), inicioAt, venceAt });
  if (activo) {
    for (const o of previos) {
      await store.marcarVencido(o.id, { forzar: true, ahora, sinPeriodo: true });
      await store.marcarAviso(o.id, "vencido");
    }
  }
  if (activo) {
    const correo = correoPublicacionActiva(activo);
    if (correo) await sendEmail(correo);
  }
  refrescar();
}

/** Suma un periodo completo (sin perder días vigentes) y vuelve a publicar la ficha enlazada. */
export async function renovarServicioAction(formData: FormData): Promise<void> {
  if (!(await exigirSesion())) return;
  const id = texto(formData.get("id"));
  if (!id) return;
  const store = getServiciosStore();
  const s = await store.obtener(id);
  if (!s || s.estado === "pendiente_publicar") return;

  if (s.propertySlug && !(await fijarPublicacionDeFicha(s.propertySlug, true))) return;
  const v = ventanaDeRenovacion(s, new Date());
  const r = await store.renovar(id, v, s.venceAt, { tipo: "suma_manual" }); // null si otro envío ya la renovó
  if (r) {
    const correo = correoPublicacionActiva(r);
    if (correo) await sendEmail(correo);
  }
  refrescar();
}

/** Da por vencido el servicio ahora mismo y despublica su ficha. */
export async function vencerServicioAction(formData: FormData): Promise<void> {
  if (!(await exigirSesion())) return;
  const id = texto(formData.get("id"));
  if (!id) return;
  const store = getServiciosStore();
  const s = await store.obtener(id);
  if (!s || s.estado === "vencido") return;
  if (s.propertySlug && !(await fijarPublicacionDeFicha(s.propertySlug, false))) return;
  await store.marcarVencido(id, { forzar: true });
  refrescar();
}

/** Saca de la lista un servicio pendiente o vencido sin avisar al cliente ni borrar el pago. */
export async function descartarServicioAction(formData: FormData): Promise<void> {
  if (!(await exigirSesion())) return;
  const id = texto(formData.get("id"));
  if (!id) return;
  await getServiciosStore().descartar(id);
  refrescar();
}

/** Deshace un descarte hecho por error. */
export async function restaurarServicioAction(formData: FormData): Promise<void> {
  if (!(await exigirSesion())) return;
  const id = texto(formData.get("id"));
  if (!id) return;
  await getServiciosStore().restaurar(id);
  refrescar();
}

/** Enlaza el servicio con una ficha (para que se despublique sola al vencer). */
export async function asignarFichaAction(formData: FormData): Promise<void> {
  if (!(await exigirSesion())) return;
  const id = texto(formData.get("id"));
  const slug = texto(formData.get("slug")).toLowerCase();
  if (!id || (slug && !SLUG.test(slug))) return;
  if (slug && !(await existeFicha(slug))) return; // un slug mal escrito dejaría el servicio sin poder despublicarse
  await getServiciosStore().asignarFicha(id, slug || null, await idDeFicha(slug));
  refrescar();
}

/** Corre ahora la misma revisión que hace el cron diario. */
export async function revisarVigenciasAhoraAction(): Promise<void> {
  if (!(await exigirSesion())) return;
  await revisarVencimientos(defaultServiciosDeps());
  refrescar();
}
