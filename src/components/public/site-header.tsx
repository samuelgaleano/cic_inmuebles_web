import Link from "next/link";
import { Building2, Menu } from "lucide-react";
import { buttonVariants } from "@/components/ui/button";
import { siteConfig } from "@/lib/config/site";

const navItems = [
  { href: "/", label: "Inicio" },
  { href: "/inmuebles", label: "Inmuebles" },
  { href: "/vender", label: "Vende tu inmueble" },
  { href: "/contacto", label: "Contacto" },
];

export function SiteHeader() {
  return (
    <header className="sticky top-0 z-40 border-b border-slate-200 bg-white/90 backdrop-blur">
      <div className="mx-auto flex h-16 max-w-7xl items-center justify-between px-4 sm:px-6 lg:px-8">
        <Link href="/" className="flex items-center gap-2">
          <span className="flex h-9 w-9 items-center justify-center rounded-lg bg-brand-700 text-white">
            <Building2 className="h-5 w-5" />
          </span>
          <span className="text-lg font-bold tracking-tight text-brand-900">
            {siteConfig.name}
          </span>
        </Link>

        <nav className="hidden items-center gap-1 md:flex">
          {navItems.map((item) => (
            <Link
              key={item.href}
              href={item.href}
              className="rounded-md px-3 py-2 text-sm font-medium text-slate-700 transition-colors hover:bg-brand-50 hover:text-brand-800"
            >
              {item.label}
            </Link>
          ))}
        </nav>

        <div className="flex items-center gap-2">
          <Link
            href="/inmuebles"
            className={buttonVariants({ variant: "primary", size: "sm", className: "hidden sm:inline-flex" })}
          >
            Ver catálogo
          </Link>
          <Link
            href="/inmuebles"
            aria-label="Abrir menú"
            className="inline-flex h-9 w-9 items-center justify-center rounded-md text-slate-700 hover:bg-slate-100 md:hidden"
          >
            <Menu className="h-5 w-5" />
          </Link>
        </div>
      </div>
    </header>
  );
}
