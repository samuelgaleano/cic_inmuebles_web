/**
 * CSV para abrir en Excel o Google Sheets. Separador «;» (Excel en español lo espera así),
 * UTF-8 con BOM (para que las tildes no se rompan) y protección contra inyección de fórmulas:
 * los leads traen texto de desconocidos, y una celda que empieza por = + - @ puede ejecutarse al abrirla.
 */

export type Celda = string | number | boolean | null | undefined;

const SEPARADOR = ";";
const SALTO = "\r\n";

/** Texto que parece solo un número o un teléfono (+57 300 123 4567): no puede ser una fórmula peligrosa. */
const NUMERICO = /^[+-]?[\d\s().,-]+$/;
const INICIO_DE_FORMULA = /^[=+\-@\t\r]/;

export function celdaCsv(valor: Celda): string {
  if (valor === null || valor === undefined) return "";
  if (typeof valor === "number") return Number.isFinite(valor) ? String(valor) : "";
  if (typeof valor === "boolean") return valor ? "Sí" : "No";
  let t = valor.replace(/\r\n|\r/g, "\n");
  if (INICIO_DE_FORMULA.test(t) && !NUMERICO.test(t)) t = `'${t}`;
  if (/[";\n]/.test(t) || t !== t.trim()) return `"${t.replace(/"/g, '""')}"`;
  return t;
}

export function aCsv(encabezado: readonly string[], filas: readonly (readonly Celda[])[]): string {
  const lineas = [encabezado, ...filas].map((f) => f.map(celdaCsv).join(SEPARADOR));
  return `﻿${lineas.join(SALTO)}${SALTO}`;
}

/**
 * Lee un CSV (o texto copiado de una hoja): detecta el separador (; , o tabulador), respeta comillas y
 * saltos dentro de celdas, y descarta el BOM y las filas totalmente vacías.
 */
export function leerCsv(texto: string): string[][] {
  const t = texto.replace(/^﻿/, "");
  const primera = t.split(/\r?\n/, 1)[0] ?? "";
  const cuenta = (c: string) => primera.split(c).length - 1;
  const sep = [";", "\t", ","].map((c) => [c, cuenta(c)] as const).sort((a, b) => b[1] - a[1])[0];
  const delimitador = sep[1] > 0 ? sep[0] : ",";

  const filas: string[][] = [];
  let fila: string[] = [];
  let celda = "";
  let entreComillas = false;
  for (let i = 0; i < t.length; i++) {
    const c = t[i];
    if (entreComillas) {
      if (c === '"' && t[i + 1] === '"') {
        celda += '"';
        i++;
      } else if (c === '"') entreComillas = false;
      else celda += c;
    } else if (c === '"') entreComillas = true;
    else if (c === delimitador) {
      fila.push(celda);
      celda = "";
    } else if (c === "\n" || c === "\r") {
      if (c === "\r" && t[i + 1] === "\n") i++;
      fila.push(celda);
      celda = "";
      filas.push(fila);
      fila = [];
    } else celda += c;
  }
  if (celda !== "" || fila.length) {
    fila.push(celda);
    filas.push(fila);
  }
  return filas.filter((f) => f.some((c) => c.trim() !== ""));
}
