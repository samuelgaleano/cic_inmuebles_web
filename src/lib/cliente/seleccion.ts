/**
 * Selecciones de inmuebles que viajan por enlace: favoritos compartidos y
 * comparaciones. Sin cuentas ni servidor: los slugs van en la URL (`?s=a,b,c`).
 */

/** "a,b,c" → ["a","b","c"], sin repetidos, solo los que existen y hasta `max`. */
export function leerSlugs(param: string | null | undefined, validos: ReadonlySet<string>, max: number): string[] {
  if (!param) return [];
  const out: string[] = [];
  for (const crudo of param.split(",")) {
    const s = crudo.trim();
    if (s && validos.has(s) && !out.includes(s)) out.push(s);
    if (out.length >= max) break;
  }
  return out;
}

/** "https://sitio/favoritos?s=a,b" — las comas van sin escapar para que el enlace sea legible. */
export function urlSeleccion(origen: string, ruta: string, slugs: readonly string[]): string {
  const base = `${origen.replace(/\/+$/, "")}${ruta}`;
  return slugs.length ? `${base}?s=${slugs.map(encodeURIComponent).join(",")}` : base;
}

/** Mensaje de WhatsApp con la selección: una línea por inmueble, con su enlace. */
export function mensajeSeleccion(
  empresa: string,
  intro: string,
  items: readonly { titulo: string; sector?: string; url: string }[],
): string {
  const lineas = items.map((i, n) => `${n + 1}. ${i.titulo}${i.sector && i.sector !== i.titulo ? ` (${i.sector})` : ""}: ${i.url}`);
  return [`Hola ${empresa}, ${intro}`, ...lineas].join("\n");
}
