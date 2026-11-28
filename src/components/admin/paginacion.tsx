import Link from "next/link";

/** «Anterior / Siguiente» de un listado paginado del panel. `href(p)` arma la URL de la página p conservando los filtros. */
export function Paginacion({ pagina, porPagina, total, href }: { pagina: number; porPagina: number; total: number; href: (p: number) => string }) {
  const paginas = Math.max(1, Math.ceil(total / porPagina));
  if (paginas <= 1) return null;
  const desde = total ? (pagina - 1) * porPagina + 1 : 0;
  const hasta = Math.min(total, pagina * porPagina);
  const boton = "inline-flex min-h-11 items-center rounded-xl border border-line bg-white px-4 text-sm font-semibold text-ink-soft transition-colors hover:border-ink hover:text-ink";
  return (
    <nav aria-label="Páginas" className="flex flex-wrap items-center justify-between gap-3 text-sm">
      <p className="text-muted">
        {desde}–{hasta} de {total}
      </p>
      <div className="flex gap-2">
        {pagina > 1 ? (
          <Link href={href(pagina - 1)} className={boton} rel="prev">
            Anterior
          </Link>
        ) : (
          <span className={`${boton} pointer-events-none opacity-40`} aria-disabled="true">
            Anterior
          </span>
        )}
        {pagina < paginas ? (
          <Link href={href(pagina + 1)} className={boton} rel="next">
            Siguiente
          </Link>
        ) : (
          <span className={`${boton} pointer-events-none opacity-40`} aria-disabled="true">
            Siguiente
          </span>
        )}
      </div>
    </nav>
  );
}

/** Página pedida en la URL ("2" → 2); cualquier otra cosa → 1. */
export function leerPagina(crudo: string | undefined): number {
  const n = Number(crudo);
  return Number.isInteger(n) && n >= 1 && n <= 100_000 ? n : 1;
}
