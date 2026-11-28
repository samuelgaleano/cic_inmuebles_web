import { getPlan } from "@/lib/config/plans";
import type { FichaDePaquete } from "./store";
import type { Servicio } from "./vigencia";

/**
 * Reglas de los paquetes (planes con `espacios`): cuántas fichas cubren y cuándo se puede ocupar un
 * espacio. Puro, para probarlo; el panel /admin/vigencias y sus acciones solo llaman a estas funciones.
 *
 * Al vencer un paquete NO se despublica nada automáticamente (decisión pendiente de CIC): el aviso de
 * vencimiento lista sus fichas y CIC decide con el cliente.
 */

/** Espacios del plan del servicio, o null si no es un paquete. */
export function espaciosDe(s: Pick<Servicio, "planId">): number | null {
  return getPlan(s.planId)?.espacios ?? null;
}

/** «3 de 5 espacios». */
export function textoEspacios(usados: number, total: number): string {
  return `${usados} de ${total} espacio${total === 1 ? "" : "s"}`;
}

export type MotivoSinEspacio = "no_es_paquete" | "no_activo" | "lleno" | "ya_esta";

export const MENSAJE_SIN_ESPACIO: Record<MotivoSinEspacio, string> = {
  no_es_paquete: "Este plan no es un paquete: su ficha se enlaza al activarlo.",
  no_activo: "Solo se asignan fichas a un paquete activo.",
  lleno: "El paquete ya usa todos sus espacios. Quita una ficha para poner otra.",
  ya_esta: "Esa ficha ya está en el paquete.",
};

/** Si se puede ocupar un espacio del paquete con esa ficha, o por qué no. */
export function puedeAgregarFicha(
  s: Pick<Servicio, "planId" | "estado">,
  fichas: Pick<FichaDePaquete, "propertyId">[],
  propertyId: string,
): { ok: true } | { ok: false; motivo: MotivoSinEspacio } {
  const espacios = espaciosDe(s);
  if (!espacios) return { ok: false, motivo: "no_es_paquete" };
  if (s.estado !== "activo") return { ok: false, motivo: "no_activo" };
  if (fichas.some((f) => f.propertyId === propertyId)) return { ok: false, motivo: "ya_esta" };
  if (fichas.length >= espacios) return { ok: false, motivo: "lleno" };
  return { ok: true };
}
