/**
 * Horas del panel en America/Bogota. Colombia no tiene horario de verano
 * (UTC-5 todo el año), y el servidor de Vercel corre en UTC: un `datetime-local`
 * («2026-10-20T10:00») se interpreta como hora de Bogotá, no del servidor.
 */
const DESFASE_HORAS = 5;

/** «2026-10-20T10:00» (hora de Bogotá) → ISO en UTC («2026-10-20T15:00:00.000Z»). undefined si no es una fecha válida. */
export function desdeHoraBogota(local: string): string | undefined {
  const m = local.trim().match(/^(\d{4})-(\d{2})-(\d{2})[T ](\d{2}):(\d{2})(?::(\d{2}))?$/);
  if (!m) return undefined;
  const [, a, mes, d, h, min, s] = m;
  // Date.UTC desborda en silencio (mes 13 → enero): se comprueba que la fecha sea real.
  const dia = new Date(Date.UTC(Number(a), Number(mes) - 1, Number(d)));
  if (dia.getUTCMonth() !== Number(mes) - 1 || dia.getUTCDate() !== Number(d) || Number(h) > 23 || Number(min) > 59) return undefined;
  const t = Date.UTC(Number(a), Number(mes) - 1, Number(d), Number(h) + DESFASE_HORAS, Number(min), Number(s ?? 0));
  const f = new Date(t);
  return Number.isNaN(f.getTime()) ? undefined : f.toISOString();
}

/** ISO en UTC → «vie, 20 oct, 10:00 a. m.» en hora de Bogotá. */
export function formatoBogota(iso: string): string {
  return new Date(iso).toLocaleString("es-CO", {
    timeZone: "America/Bogota",
    weekday: "short",
    day: "2-digit",
    month: "short",
    hour: "2-digit",
    minute: "2-digit",
  });
}
