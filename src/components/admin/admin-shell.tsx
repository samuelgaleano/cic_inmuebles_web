"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import {
  BarChart3,
  Building2,
  CalendarDays,
  FileText,
  Home,
  Inbox,
  LogOut,
  PanelsTopLeft,
} from "lucide-react";
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
    <div className="flex min-h-screen bg-slate-50">
      {/* Sidebar */}
      <aside className="hidden w-60 shrink-0 flex-col border-r border-slate-200 bg-white md:flex">
        <div className="flex h-16 items-center gap-2 border-b border-slate-200 px-5">
          <span className="flex h-8 w-8 items-center justify-center rounded-lg bg-brand-700 text-white">
            <PanelsTopLeft className="h-5 w-5" />
          </span>
          <span className="font-bold text-brand-900">CIC Admin</span>
        </div>
        <nav className="flex-1 space-y-1 p-3">
          {nav.map((item) => (
            <Link
              key={item.href}
              href={item.href}
              className={cn(
                "flex items-center gap-3 rounded-lg px-3 py-2 text-sm font-medium transition-colors",
                isActive(item.href, item.exact)
                  ? "bg-brand-50 text-brand-800"
                  : "text-slate-600 hover:bg-slate-100",
              )}
            >
              <item.icon className="h-4 w-4" />
              {item.label}
            </Link>
          ))}
        </nav>
        <div className="border-t border-slate-200 p-3">
          <p className="truncate px-3 pb-2 text-xs text-slate-400">{email}</p>
          <form action={logoutAction}>
            <button className="flex w-full items-center gap-3 rounded-lg px-3 py-2 text-sm font-medium text-slate-600 hover:bg-slate-100">
              <LogOut className="h-4 w-4" /> Cerrar sesión
            </button>
          </form>
        </div>
      </aside>

      {/* Contenido */}
      <div className="flex min-w-0 flex-1 flex-col">
        {/* Topbar móvil */}
        <header className="flex h-14 items-center justify-between border-b border-slate-200 bg-white px-4 md:hidden">
          <span className="font-bold text-brand-900">CIC Admin</span>
          <form action={logoutAction}>
            <button className="text-sm text-slate-600" aria-label="Cerrar sesión">
              <LogOut className="h-5 w-5" />
            </button>
          </form>
        </header>
        {/* Nav móvil */}
        <nav className="flex gap-1 overflow-x-auto border-b border-slate-200 bg-white px-2 py-2 md:hidden">
          {nav.map((item) => (
            <Link
              key={item.href}
              href={item.href}
              className={cn(
                "flex items-center gap-2 whitespace-nowrap rounded-lg px-3 py-1.5 text-sm font-medium",
                isActive(item.href, item.exact)
                  ? "bg-brand-50 text-brand-800"
                  : "text-slate-600",
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
