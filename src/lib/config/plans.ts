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
/** Eje de decisión de la página de planes: cobro por inmueble o por paquete de espacios. */
export type PlanGrupo = "inmueble" | "mensual" | "anual";

export interface Plan {
  id: string;
  audience: PlanAudience;
  /** "pago": se cobra en línea con Wompi. "contacto": precio variable → WhatsApp. */
  mode: PlanMode;
  /** Grupo en el que se muestra dentro de la página de planes (solo planes de pago). */
  grupo?: PlanGrupo;
  nombre: string;
  /** Precio en pesos (COP). En planes de contacto es un valor "desde". */
  precioCOP: number;
  /** Sufijo mostrado junto al precio, p. ej. "por inmueble · 90 días". */
  periodo: string;
  /** Espacios activos (inmuebles publicados a la vez) que incluye un paquete. */
  espacios?: number;
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
    grupo: "inmueble",
    nombre: "Alianza por resultados",
    precioCOP: 10000,
    periodo: "por inmueble · 90 días",
    resumen:
      "Tarifa administrativa para publicar; CIC gestiona los clientes y se comparte la comisión 50/50 cuando CIC consigue el negocio.",
    incluye: [
      "Ficha individual + hasta 10 fotografías",
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
    grupo: "inmueble",
    nombre: "Publicación independiente",
    precioCOP: 20000,
    periodo: "por inmueble · 30 días",
    resumen:
      "Publicas tu inmueble en CIC como vitrina digital, pero atiendes tú a los interesados y conservas tu comisión.",
    incluye: [
      "Ficha individual + hasta 10 fotografías",
      "Precio, área, ubicación y características",
      "Botón de contacto directo al agente",
      "Inclusión en los filtros de búsqueda",
    ],
  },
  {
    id: "paquete-5",
    audience: "agente",
    mode: "pago",
    grupo: "mensual",
    nombre: "Paquete Mensual 5",
    precioCOP: 75000,
    periodo: "hasta 5 inmuebles · mes",
    espacios: 5,
    resumen:
      "Cinco inmuebles publicados a la vez, atendidos por ti. Si vendes o retiras uno, lo reemplazas por otro sin pagar de nuevo.",
    incluye: [
      "5 fichas individuales activas a la vez",
      "Hasta 10 fotografías por inmueble",
      "Reemplazo de propiedades vendidas o retiradas",
      "Actualización de precios y disponibilidad",
      "Botón de contacto directo al agente",
    ],
  },
  {
    id: "paquete-10",
    audience: "agente",
    mode: "pago",
    grupo: "mensual",
    nombre: "Paquete Mensual 10",
    precioCOP: 150000,
    periodo: "hasta 10 inmuebles · mes",
    espacios: 10,
    resumen:
      "Diez inmuebles publicados a la vez, atendidos por ti. Si vendes o retiras uno, lo reemplazas por otro sin pagar de nuevo.",
    incluye: [
      "10 fichas individuales activas a la vez",
      "Hasta 10 fotografías por inmueble",
      "Reemplazo de propiedades vendidas o retiradas",
      "Actualización de precios y disponibilidad",
      "Botón de contacto directo al agente",
    ],
  },
  {
    id: "anual-5",
    audience: "agente",
    mode: "pago",
    grupo: "anual",
    nombre: "Anual Aliado 5",
    precioCOP: 239900,
    periodo: "hasta 5 inmuebles · año",
    espacios: 5,
    resumen:
      "Cinco espacios activos durante 12 meses, con rotación y atención prioritaria. Precio especial de lanzamiento.",
    incluye: [
      "5 espacios activos durante un año",
      "Reemplazo de propiedades vendidas o retiradas",
      "Hasta 10 fotografías por inmueble",
      "Atención prioritaria para cambios",
    ],
  },
  {
    id: "anual-10",
    audience: "agente",
    mode: "pago",
    grupo: "anual",
    nombre: "Anual Aliado 10",
    precioCOP: 399900,
    periodo: "hasta 10 inmuebles · año",
    espacios: 10,
    resumen:
      "Diez espacios activos durante 12 meses, con rotación y atención prioritaria. Precio especial de lanzamiento.",
    incluye: [
      "10 espacios activos durante un año",
      "Reemplazo de propiedades vendidas o retiradas",
      "Hasta 10 fotografías por inmueble",
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

/**
 * ¿El monto que reporta Wompi corresponde al precio del plan?
 *
 * Defensa en profundidad para el webhook. El monto viaja firmado con el secreto
 * de integridad, que solo vive en el servidor, así que una discrepancia no
 * debería poder producirse; si aparece, es señal de manipulación o de un error
 * de configuración y hay que verla, no dejarla pasar en silencio.
 *
 * Devuelve `true` cuando no hay monto: sin dato no se afirma nada, para no
 * marcar como sospechoso un pago legítimo por un payload incompleto.
 */
export function amountMatchesPlan(plan: Plan, amountInCents: number | undefined): boolean {
  if (amountInCents == null) return true;
  return amountInCents === wompiAmountInCents(plan);
}
