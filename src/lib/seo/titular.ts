import type { PropertyType } from "@/lib/domain";

/**
 * Titular de la home y del catálogo, derivado del inventario publicado.
 *
 * Hoy todo lo publicado son apartamentos en Bogotá, así que la página debe
 * decir "Apartamentos en venta en Bogotá" (lo que la gente busca y lo que
 * hay), no "Apartamentos y casas en venta en Colombia". Pero el texto sale
 * de los datos: el día que se publique una casa o un inmueble en otra
 * ciudad, el titular se ensancha solo y nunca promete lo que no hay.
 */

export interface InventarioItem {
  tipo: PropertyType;
  ubicacion: { ciudad: string; sector?: string };
  precio: number;
  /** Si se informa, el "desde" ignora lo vendido y lo que está en proceso de venta. */
  estado?: "disponible" | "en_proceso" | "vendido";
}

export interface Titular {
  /** "Apartamentos", "Casas", "Apartamentos y casas" o "Inmuebles". */
  tipos: string;
  /** Ciudad única del inventario o "Colombia". */
  lugar: string;
  /** `${tipos} en venta en ${lugar}`. */
  titulo: string;
  /** Ciudad única, si toda la oferta está en una. */
  ciudad?: string;
  /** Sectores distintos, ordenados, para nombrarlos en el texto. */
  sectores: string[];
  /** Precio más bajo publicado. */
  desde?: number;
}

const GENERICO: Titular = {
  tipos: "Apartamentos y casas",
  lugar: "Colombia",
  titulo: "Apartamentos y casas en venta en Colombia",
  sectores: [],
};

const VIVIENDA: Record<string, "apartamento" | "casa"> = {
  apartamento: "apartamento",
  apartaestudio: "apartamento",
  casa: "casa",
  casa_campestre: "casa",
};

export function titularInventario(items: InventarioItem[]): Titular {
  if (items.length === 0) return GENERICO;

  const familias = new Set<"apartamento" | "casa" | "otro">(items.map((p) => VIVIENDA[p.tipo] ?? "otro"));
  const tipos = familias.has("otro")
    ? "Inmuebles"
    : familias.size === 2
      ? "Apartamentos y casas"
      : familias.has("casa")
        ? "Casas"
        : "Apartamentos";

  const ciudades = [...new Set(items.map((p) => p.ubicacion.ciudad).filter(Boolean))];
  const ciudad = ciudades.length === 1 ? ciudades[0] : undefined;
  const lugar = ciudad ?? "Colombia";

  const sectores = [...new Set(items.map((p) => p.ubicacion.sector).filter((s): s is string => Boolean(s)))].sort((a, b) =>
    a.localeCompare(b, "es"),
  );
  // "Desde" = el precio de entrada de lo que hoy se puede comprar (no de lo que ya está en negociación).
  const comprables = items.filter((p) => p.estado === undefined || p.estado === "disponible");
  const base = comprables.length > 0 ? comprables : items.filter((p) => p.estado !== "vendido");
  const precios = (base.length > 0 ? base : items).map((p) => p.precio).filter((n) => n > 0);
  const desde = precios.length > 0 ? Math.min(...precios) : undefined;

  return { tipos, lugar, titulo: `${tipos} en venta en ${lugar}`, ciudad, sectores, desde };
}

/** "Apartamentos" → "apartamento": para frases con cantidad ("1 apartamento en venta"). */
export function tipoSingular(tipos: string): string {
  const t = tipos.toLowerCase();
  if (t === "apartamentos") return "apartamento";
  if (t === "casas") return "casa";
  return "inmueble";
}
