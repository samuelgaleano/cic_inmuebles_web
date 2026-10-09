/**
 * Chips de los filtros elegidos a mano (los de la frase los genera el
 * intérprete). Misma redacción en ambos, para que se lean como una sola
 * lista de "lo que estoy buscando", y cada chip sabe cómo quitarse.
 */
import { PROPERTY_STATUS_PUBLIC_LABELS, PROPERTY_TYPE_LABELS } from "@/lib/domain";
import { enMillones } from "./interpretar";
import type { Manual } from "./motor";

export interface ChipManual {
  id: string;
  etiqueta: string;
  /** Devuelve los filtros sin este criterio. */
  quitar: (m: Manual) => Manual;
}

const sin =
  (...claves: (keyof Manual)[]) =>
  (m: Manual): Manual => {
    const copia = { ...m };
    for (const c of claves) delete copia[c];
    return copia;
  };

export function chipsManuales(m: Manual): ChipManual[] {
  const out: ChipManual[] = [];
  if (m.tipo) out.push({ id: "m:tipo", etiqueta: PROPERTY_TYPE_LABELS[m.tipo], quitar: sin("tipo") });
  if (m.ciudad) out.push({ id: "m:ciudad", etiqueta: m.ciudad, quitar: sin("ciudad") });
  if (m.sectores?.length) out.push({ id: "m:sectores", etiqueta: m.sectores.join(" o "), quitar: sin("sectores") });
  if (m.estado) out.push({ id: "m:estado", etiqueta: PROPERTY_STATUS_PUBLIC_LABELS[m.estado], quitar: sin("estado") });

  if (m.precioMin != null && m.precioMax != null) {
    out.push({ id: "m:precio", etiqueta: `${enMillones(m.precioMin)} – ${enMillones(m.precioMax)}`, quitar: sin("precioMin", "precioMax") });
  } else if (m.precioMax != null) {
    out.push({ id: "m:precio", etiqueta: `Hasta ${enMillones(m.precioMax)}`, quitar: sin("precioMax") });
  } else if (m.precioMin != null) {
    out.push({ id: "m:precio", etiqueta: `Desde ${enMillones(m.precioMin)}`, quitar: sin("precioMin") });
  }

  if (m.habitacionesMin != null) out.push({ id: "m:hab", etiqueta: `${m.habitacionesMin}+ habitaciones`, quitar: sin("habitacionesMin") });
  if (m.banosMin != null) out.push({ id: "m:banos", etiqueta: `${m.banosMin}+ baños`, quitar: sin("banosMin") });
  if (m.parqueaderosMin != null) {
    out.push({
      id: "m:parq",
      etiqueta: m.parqueaderosMin === 1 ? "Con parqueadero" : `${m.parqueaderosMin}+ parqueaderos`,
      quitar: sin("parqueaderosMin"),
    });
  }

  if (m.areaMin != null && m.areaMax != null) {
    out.push({ id: "m:area", etiqueta: `${m.areaMin}–${m.areaMax} m²`, quitar: sin("areaMin", "areaMax") });
  } else if (m.areaMin != null) {
    out.push({ id: "m:area", etiqueta: `Desde ${m.areaMin} m²`, quitar: sin("areaMin") });
  } else if (m.areaMax != null) {
    out.push({ id: "m:area", etiqueta: `Hasta ${m.areaMax} m²`, quitar: sin("areaMax") });
  }

  if (m.terminos?.length) out.push({ id: "m:terminos", etiqueta: m.terminos.map((t) => `«${t}»`).join(" "), quitar: sin("terminos") });
  return out;
}
