/**
 * Plantillas de documentos reutilizables (promesa de compraventa, contrato de
 * arrendamiento, etc.). Texto editable desde el panel para uso del equipo.
 */

export const TEMPLATE_TYPES = [
  "promesa_compraventa",
  "contrato_arriendo",
  "autorizacion",
  "otro",
] as const;
export type TemplateType = (typeof TEMPLATE_TYPES)[number];

export const TEMPLATE_TYPE_LABELS: Record<TemplateType, string> = {
  promesa_compraventa: "Promesa de compraventa",
  contrato_arriendo: "Contrato de arrendamiento",
  autorizacion: "Autorización",
  otro: "Otro",
};

export interface Template {
  id: string;
  nombre: string;
  tipo: TemplateType;
  contenido: string;
  creadoEn: string;
  actualizadoEn: string;
}

export type TemplateInput = Omit<Template, "id" | "creadoEn" | "actualizadoEn">;
