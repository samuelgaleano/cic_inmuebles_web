import Link from "next/link";
import { ChevronLeft, ChevronRight } from "lucide-react";
import { cn } from "@/lib/utils/cn";

/** Paginación que preserva los filtros activos en la URL. */
export function Pagination({
  currentPage,
  totalPages,
  params,
  basePath = "/inmuebles",
}: {
  currentPage: number;
  totalPages: number;
  params: Record<string, string | string[] | undefined>;
  basePath?: string;
}) {
  if (totalPages <= 1) return null;

  const hrefFor = (page: number) => {
    const sp = new URLSearchParams();
    for (const [k, v] of Object.entries(params)) {
      if (k === "page") continue;
      if (typeof v === "string" && v) sp.set(k, v);
    }
    if (page > 1) sp.set("page", String(page));
    const qs = sp.toString();
    return qs ? `${basePath}?${qs}` : basePath;
  };

  const pages = Array.from({ length: totalPages }, (_, i) => i + 1);

  return (
    <nav className="mt-8 flex items-center justify-center gap-1" aria-label="Paginación">
      <PageLink href={hrefFor(currentPage - 1)} disabled={currentPage <= 1} aria-label="Anterior">
        <ChevronLeft className="h-4 w-4" />
      </PageLink>
      {pages.map((p) => (
        <Link
          key={p}
          href={hrefFor(p)}
          aria-current={p === currentPage ? "page" : undefined}
          className={cn(
            "flex h-10 min-w-10 items-center justify-center rounded-xl px-3 text-sm font-semibold transition-colors",
            p === currentPage
              ? "bg-brand-700 text-white shadow-[0_8px_20px_-10px_rgba(4,125,91,0.8)]"
              : "border border-line bg-white text-ink-soft hover:border-brand-200 hover:bg-brand-50",
          )}
        >
          {p}
        </Link>
      ))}
      <PageLink href={hrefFor(currentPage + 1)} disabled={currentPage >= totalPages} aria-label="Siguiente">
        <ChevronRight className="h-4 w-4" />
      </PageLink>
    </nav>
  );
}

function PageLink({
  href,
  disabled,
  children,
  ...rest
}: {
  href: string;
  disabled?: boolean;
  children: React.ReactNode;
  "aria-label"?: string;
}) {
  if (disabled) {
    return (
      <span
        {...rest}
        aria-disabled="true"
        className="flex h-10 items-center justify-center rounded-xl border border-line bg-surface px-3 text-muted/40"
      >
        {children}
      </span>
    );
  }
  return (
    <Link
      href={href}
      {...rest}
      className="flex h-10 items-center justify-center rounded-xl border border-line bg-white px-3 text-ink-soft transition-colors hover:border-brand-200 hover:bg-brand-50"
    >
      {children}
    </Link>
  );
}
