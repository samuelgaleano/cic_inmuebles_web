"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import {
  BarChart3,
  Building2,
  CalendarDays,
  ExternalLink,
  FileText,
  Home,
  Inbox,
  LogOut,
} from "lucide-react";
import { Logo } from "@/components/brand/brand-mark";
import { logoutAction } from "@/lib/actions/auth";
import { cn } from "@/lib/utils/cn";

const nav = [
  { href: "/admin", label: "Dashboard", icon: Home, exact: true },
  { href: "/admin/inmuebles", label: "Inmuebles", icon: Building2 },
  { href: "/admin/leads", label: "Leads", icon: Inbox },
  { href: "/admin/agenda", label: "Agenda", icon: CalendarDays },
  { href: "/admin/plantillas", label: "Plantillas", icon: FileText },
  { href: "/admin/reportes", label: "Reportes", icon: BarChart3 },
];

export function AdminShell({ email, children }: { email: string; children: React.ReactNode }) {
  const pathname = usePathname();

  const isActive = (href: string, exact?: boolean) =>
    exact ? pathname === href : pathname === href || pathname.startsWith(`${href}/`);

  return (
    <div className="flex min-h-screen bg-surface">
      {/* Sidebar */}
      <aside className="hidden w-64 shrink-0 flex-col bg-ink text-white/70 md:flex">
        <div className="bg-aurora flex h-[4.5rem] items-center border-b border-white/10 px-5">
          <Logo tone="dark" />
        </div>
        <nav className="flex-1 space-y-1 p-3">
          {nav.map((item) => {
            const active = isActive(item.href, item.exact);
            return (
              <Link
                key={item.href}
                href={item.href}
                className={cn(
                  "group relative flex items-center gap-3 rounded-xl px-3 py-2.5 text-sm font-medium transition-all duration-300 ease-[cubic-bezier(0.16,1,0.3,1)]",
                  active
                    ? "bg-brand-500/15 text-white"
                    : "text-white/60 hover:bg-white/5 hover:text-white",
                )}
              >
                {active && (
                  <span className="absolute left-0 top-1/2 h-5 w-1 -translate-y-1/2 rounded-r-full bg-brand-400" />
                )}
                <item.icon className={cn("h-[18px] w-[18px]", active ? "text-brand-400" : "text-white/50 group-hover:text-white/80")} />
                {item.label}
              </Link>
            );
          })}
        </nav>
        <div className="space-y-1 border-t border-white/10 p-3">
          <Link
            href="/"
            target="_blank"
            className="flex items-center gap-3 rounded-xl px-3 py-2 text-sm font-medium text-white/60 transition-colors hover:bg-white/5 hover:text-white"
          >
            <ExternalLink className="h-4 w-4" /> Ver sitio
          </Link>
          <p className="truncate px-3 pt-2 text-xs text-white/35">{email}</p>
          <form action={logoutAction}>
            <button className="flex w-full items-center gap-3 rounded-xl px-3 py-2 text-sm font-medium text-white/60 transition-colors hover:bg-white/5 hover:text-white">
              <LogOut className="h-4 w-4" /> Cerrar sesión
            </button>
          </form>
        </div>
      </aside>

      {/* Contenido */}
      <div className="flex min-w-0 flex-1 flex-col">
        {/* Topbar móvil */}
        <header className="sticky top-0 z-30 flex h-16 items-center justify-between border-b border-line bg-white/90 px-4 backdrop-blur-xl md:hidden">
          <Logo />
          <form action={logoutAction}>
            <button
              className="flex h-9 w-9 items-center justify-center rounded-full text-muted hover:bg-surface"
              aria-label="Cerrar sesión"
            >
              <LogOut className="h-5 w-5" />
            </button>
          </form>
        </header>
        {/* Nav móvil */}
        <nav className="sticky top-16 z-20 flex gap-1 overflow-x-auto border-b border-line bg-white/90 px-2 py-2 backdrop-blur-xl md:hidden">
          {nav.map((item) => (
            <Link
              key={item.href}
              href={item.href}
              className={cn(
                "flex items-center gap-2 whitespace-nowrap rounded-full px-3 py-1.5 text-sm font-medium transition-colors",
                isActive(item.href, item.exact)
                  ? "bg-brand-50 text-brand-800"
                  : "text-muted hover:bg-surface",
              )}
            >
              <item.icon className="h-4 w-4" /> {item.label}
            </Link>
          ))}
        </nav>

        <main className="flex-1 p-4 sm:p-6 lg:p-8">{children}</main>
      </div>
    </div>
  );
}
