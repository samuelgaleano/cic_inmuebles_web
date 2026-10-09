/** Bloquea o libera el scroll de la página mientras hay un visor o menú modal abierto. */
export function bloquearScroll(bloquear: boolean): void {
  document.documentElement.style.overflow = bloquear ? "hidden" : "";
}
