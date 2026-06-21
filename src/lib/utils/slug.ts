/** Genera un slug URL-amigable a partir de un texto (es-CO). */
export function slugify(text: string): string {
  return text
    .toLowerCase()
    .normalize("NFD")
    .replace(/[̀-ͯ]/g, "") // quita tildes (diacríticos combinantes)
    .replace(/[^a-z0-9\s-]/g, "") // quita símbolos
    .trim()
    .replace(/\s+/g, "-")
    .replace(/-+/g, "-");
}
