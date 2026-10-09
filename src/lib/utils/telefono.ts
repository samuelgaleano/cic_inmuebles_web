/**
 * Teléfonos tal como los escribe la gente en Colombia ("300 123 4567",
 * "+57 (300) 123-4567", "0057 3001234567", "601 234 5678") y de afuera
 * ("+1 305 555 0100"), llevados a una forma única para guardarlos, mostrarlos
 * y armar enlaces de WhatsApp que sí abren.
 */

export type TipoTelefono = "movil" | "fijo" | "local" | "internacional";

export interface TelefonoNormalizado {
  tipo: TipoTelefono;
  /** Formato internacional "+573001234567"; ausente en los fijos locales de 7 dígitos (sin indicativo no hay país ni ciudad). */
  e164?: string;
  /** Para mostrar: "+57 300 123 4567". */
  legible: string;
}

const grupos = (d: string, tamanos: number[]) => {
  const partes: string[] = [];
  let i = 0;
  for (const t of tamanos) {
    partes.push(d.slice(i, i + t));
    i += t;
  }
  return partes.filter(Boolean).join(" ");
};

export function normalizarTelefono(crudo: string): TelefonoNormalizado | null {
  const texto = crudo.trim();
  if (!texto) return null;
  let d = texto.replace(/\D/g, "");
  let internacional = texto.startsWith("+");
  if (!internacional && d.startsWith("00")) {
    d = d.slice(2);
    internacional = true;
  }
  if (!d || /^(\d)\1+$/.test(d)) return null; // vacío o todo el mismo dígito (0000000000)

  // Con indicativo de país
  if (internacional) {
    if (d.startsWith("57")) d = d.slice(2); // Colombia: se valida como número nacional
    else return d.length >= 8 && d.length <= 15 ? { tipo: "internacional", e164: `+${d}`, legible: `+${d}` } : null;
  } else if (d.length === 12 && d.startsWith("57")) {
    d = d.slice(2);
  }

  // Nacional
  if (d.length === 10 && d.startsWith("3")) {
    return { tipo: "movil", e164: `+57${d}`, legible: `+57 ${grupos(d, [3, 3, 4])}` };
  }
  if (d.length === 10 && d.startsWith("60")) {
    return { tipo: "fijo", e164: `+57${d}`, legible: `+57 ${grupos(d, [3, 3, 4])}` };
  }
  if (d.length === 7 && !internacional) {
    return { tipo: "local", legible: grupos(d, [3, 4]) };
  }
  return null;
}

/** Enlace wa.me solo si el número tiene país (los fijos locales no sirven para WhatsApp). */
export function enlaceWhatsApp(crudo: string, mensaje?: string): string | undefined {
  const n = normalizarTelefono(crudo);
  if (!n?.e164) return undefined;
  const base = `https://wa.me/${n.e164.slice(1)}`;
  return mensaje ? `${base}?text=${encodeURIComponent(mensaje)}` : base;
}
