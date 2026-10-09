/**
 * Elección de visita: el visitante marca un día y una franja y esa preferencia
 * viaja estructurada al equipo. No es una reserva ni promete disponibilidad:
 * el asesor confirma por WhatsApp (la interfaz lo dice).
 */

export type FranjaId = "manana" | "tarde" | "flexible";

export const FRANJAS: { id: FranjaId; etiqueta: string; frase: string }[] = [
  { id: "manana", etiqueta: "Mañana", frase: "en la mañana" },
  { id: "tarde", etiqueta: "Tarde", frase: "en la tarde" },
  { id: "flexible", etiqueta: "Cualquier hora", frase: "a cualquier hora" },
];

export interface DiaVisita {
  /** AAAA-MM-DD en calendario de Bogotá. */
  iso: string;
  /** "sábado 10 de octubre" */
  largo: string;
  /** "sáb" */
  corto: string;
  /** Día del mes. */
  dia: number;
  /** "oct" */
  mes: string;
}

const ZONA = "America/Bogota";

/** Fecha de hoy en Bogotá como [año, mes(1-12), día]. */
function hoyEnBogota(ahora: Date): [number, number, number] {
  const partes = new Intl.DateTimeFormat("en-CA", {
    timeZone: ZONA,
    year: "numeric",
    month: "2-digit",
    day: "2-digit",
  }).formatToParts(ahora);
  const v = (t: string) => Number(partes.find((p) => p.type === t)!.value);
  return [v("year"), v("month"), v("day")];
}

/** Los próximos `cantidad` días empezando MAÑANA (hoy ya no hay tiempo de coordinar). */
export function proximosDias(ahora: Date, cantidad = 10): DiaVisita[] {
  const [y, m, d] = hoyEnBogota(ahora);
  const largo = new Intl.DateTimeFormat("es-CO", { timeZone: "UTC", weekday: "long", day: "numeric", month: "long" });
  const corto = new Intl.DateTimeFormat("es-CO", { timeZone: "UTC", weekday: "short" });
  const mes = new Intl.DateTimeFormat("es-CO", { timeZone: "UTC", month: "short" });
  const dias: DiaVisita[] = [];
  for (let k = 1; k <= cantidad; k++) {
    // Mediodía UTC: el calendario no cambia por la zona al formatear en UTC.
    const f = new Date(Date.UTC(y, m - 1, d + k, 12));
    dias.push({
      iso: f.toISOString().slice(0, 10),
      largo: largo.format(f).replace(/,/g, ""),
      corto: corto.format(f).replace(/\./g, ""),
      dia: f.getUTCDate(),
      mes: mes.format(f).replace(/\./g, ""),
    });
  }
  return dias;
}

/** "sábado 10 de octubre, en la tarde" (para el campo de preferencia del lead y el mensaje de WhatsApp). */
export function componerPreferencia(dia: DiaVisita | undefined, franja: FranjaId | undefined): string {
  const frase = FRANJAS.find((f) => f.id === franja)?.frase;
  return [dia?.largo, frase].filter(Boolean).join(", ");
}
