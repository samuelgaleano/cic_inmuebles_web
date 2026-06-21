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
            "flex h-10 min-w-10 items-center justify-center rounded-lg px-3 text-sm font-medium",
            p === currentPage
              ? "bg-brand-700 text-white"
              : "border border-slate-200 bg-white text-slate-700 hover:bg-slate-50",
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
        className="flex h-10 items-center justify-center rounded-lg border border-slate-100 bg-slate-50 px-3 text-slate-300"
      >
        {children}
      </span>
    );
  }
  return (
    <Link
      href={href}
      {...rest}
      className="flex h-10 items-center justify-center rounded-lg border border-slate-200 bg-white px-3 text-slate-700 hover:bg-slate-50"
    >
      {children}
    </Link>
  );
}
