/**
 * Catálogo de planes de publicación (sección "Publica tu inmueble").
 *
 * Esta es la ÚNICA fuente de verdad del precio: el endpoint de pago resuelve
 * el monto desde aquí por `id`, nunca desde el cliente, para que el valor
 * enviado a la pasarela no se pueda manipular.
 *
 * `precioCOP` está en PESOS colombianos. La conversión a centavos (× 100) que
 * exige Wompi se hace en un solo lugar: `wompiAmountInCents()`.
 */

export type PlanAudience = "agente" | "propietario";
export type PlanMode = "pago" | "contacto";

export interface Plan {
  id: string;
  audience: PlanAudience;
  /** "pago": se cobra en línea con Wompi. "contacto": precio variable → WhatsApp. */
  mode: PlanMode;
  nombre: string;
  /** Precio en pesos (COP). En planes de contacto es un valor "desde". */
  precioCOP: number;
  /** Sufijo mostrado junto al precio, p. ej. "por inmueble · 90 días". */
  periodo: string;
  /** true cuando el precio es un mínimo ("desde"). */
  desde?: boolean;
  resumen: string;
  incluye: string[];
  destacado?: boolean;
}

export const PLANS: Plan[] = [
  // ─────────────── Agentes e inmobiliarias ───────────────
  {
    id: "alianza-90",
    audience: "agente",
    mode: "pago",
    nombre: "Alianza por resultados",
    precioCOP: 10000,
    periodo: "por inmueble · 90 días",
    resumen:
      "Tarifa administrativa para publicar; CIC gestiona los clientes y se comparte la comisión 50/50 cuando CIC consigue el negocio.",
    incluye: [
      "Publicación 90 días + ficha comercial",
      "Promoción básica en Instagram, TikTok y estados de WhatsApp",
      "CIC atiende clientes, coordina visitas y acompaña el cierre",
      "Comisión compartida 50/50 (según acuerdo previo)",
    ],
    destacado: true,
  },
  {
    id: "publicacion-1",
    audience: "agente",
    mode: "pago",
    nombre: "Publicación independiente",
    precioCOP: 20000,
    periodo: "por inmueble · 30 días",
    resumen:
      "Publicas tu inmueble en CIC como vitrina digital, pero atiendes tú a los interesados y conservas tu comisión.",
    incluye: [
      "Ficha individual + hasta 15 fotografías",
      "Precio, área, ubicación y características",
      "Botón de contacto directo al agente",
      "Inclusión en los filtros de búsqueda",
    ],
  },
  {
    id: "paquete-5",
    audience: "agente",
    mode: "pago",
    nombre: "Paquete Mensual 5",
    precioCOP: 75000,
    periodo: "hasta 5 inmuebles · mes",
    resumen:
      "Inventario activo de hasta 5 inmuebles simultáneos, con reemplazo de los que se vendan o retiren. Equivale a $15.000 por espacio.",
    incluye: [
      "Hasta 5 inmuebles publicados a la vez",
      "Reemplazo de propiedades vendidas o retiradas",
      "Hasta 15 fotografías por inmueble",
      "Actualización de precios y disponibilidad",
    ],
  },
  {
    id: "paquete-10",
    audience: "agente",
    mode: "pago",
    nombre: "Paquete Mensual 10",
    precioCOP: 150000,
    periodo: "hasta 10 inmuebles · mes",
    resumen:
      "Inventario activo de hasta 10 inmuebles simultáneos, con rotación. Equivale a $15.000 por espacio.",
    incluye: [
      "Hasta 10 inmuebles publicados a la vez",
      "Reemplazo de propiedades vendidas o retiradas",
      "Hasta 15 fotografías por inmueble",
      "Actualización de precios y disponibilidad",
    ],
  },
  {
    id: "anual-5",
    audience: "agente",
    mode: "pago",
    nombre: "Anual Aliado 5",
    precioCOP: 239900,
    periodo: "hasta 5 inmuebles · año",
    resumen:
      "Cinco espacios activos durante 12 meses, con rotación y atención prioritaria. Precio especial de lanzamiento.",
    incluye: [
      "5 espacios activos durante un año",
      "Reemplazo de propiedades vendidas o retiradas",
      "Hasta 15 fotografías por inmueble",
      "Atención prioritaria para cambios",
    ],
  },
  {
    id: "anual-10",
    audience: "agente",
    mode: "pago",
    nombre: "Anual Aliado 10",
    precioCOP: 399900,
    periodo: "hasta 10 inmuebles · año",
    resumen:
      "Diez espacios activos durante 12 meses, con rotación y atención prioritaria. Precio especial de lanzamiento.",
    incluye: [
      "10 espacios activos durante un año",
      "Reemplazo de propiedades vendidas o retiradas",
      "Hasta 15 fotografías por inmueble",
      "Atención prioritaria para cambios",
    ],
  },

  // ─────────────── Contenido profesional (precio variable) ───────────────
  {
    id: "contenido-profesional",
    audience: "agente",
    mode: "contacto",
    nombre: "Contenido Profesional CIC",
    precioCOP: 250000,
    desde: true,
    periodo: "por inmueble",
    resumen:
      "Producción audiovisual profesional (fotos, video y dron). El precio final depende del inmueble, por eso se cotiza por WhatsApp.",
    incluye: [
      "Sesión de hasta 90 min en el inmueble",
      "15–20 fotografías editadas + video vertical (Reel/TikTok)",
      "Tomas con dron cuando sea viable",
      "Publicación básica en la web 90 días",
    ],
  },
];

export function getPlan(id: string): Plan | undefined {
  return PLANS.find((p) => p.id === id);
}

/** Planes que se pagan en línea (precio fijo). */
export const PAYABLE_PLANS = PLANS.filter((p) => p.mode === "pago");

/** Monto en centavos para Wompi (COP): pesos × 100. Único lugar de conversión. */
export function wompiAmountInCents(plan: Plan): number {
  return Math.round(plan.precioCOP * 100);
}
