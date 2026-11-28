"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import { useEffect, useState } from "react";
import {
  BarChart3,
  Building2,
  CalendarClock,
  CalendarDays,
  Database,
  ExternalLink,
  FileText,
  Home,
  Inbox,
  Link2,
  LogOut,
  MoreHorizontal,
  Users,
  X,
} from "lucide-react";
import { Logo } from "@/components/brand/brand-mark";
import { logoutAction } from "@/lib/actions/auth";
import { cn } from "@/lib/utils/cn";

const nav = [
  { href: "/admin", label: "Inicio", icon: Home, exact: true },
  { href: "/admin/inmuebles", label: "Inmuebles", icon: Building2 },
  { href: "/admin/leads", label: "Leads", icon: Inbox },
  { href: "/admin/crm", label: "CRM", icon: Users },
  { href: "/admin/datos", label: "Datos", icon: Database },
  { href: "/admin/conexiones", label: "Conexiones", icon: Link2 },
  { href: "/admin/vigencias", label: "Vigencias", icon: CalendarClock },
  { href: "/admin/agenda", label: "Agenda", icon: CalendarDays },
  { href: "/admin/plantillas", label: "Plantillas", icon: FileText },
  { href: "/admin/reportes", label: "Reportes", icon: BarChart3 },
];

/** En el celular van abajo, al alcance del pulgar, las cuatro que se usan a diario; el resto, bajo «Más». */
const PRINCIPALES = ["/admin", "/admin/leads", "/admin/crm", "/admin/agenda"];
const principales = PRINCIPALES.map((h) => nav.find((n) => n.href === h)!);
const resto = nav.filter((n) => !PRINCIPALES.includes(n.href));

export function AdminShell({ email, children }: { email: string; children: React.ReactNode }) {
  const pathname = usePathname();
  // «Más» queda abierto solo en la ruta donde se abrió: al navegar se cierra solo, sin un efecto.
  const [abiertoEn, setAbiertoEn] = useState<string | null>(null);
  const masAbierto = abiertoEn === pathname;
  const setMasAbierto = (abrir: boolean) => setAbiertoEn(abrir ? pathname : null);

  const isActive = (href: string, exact?: boolean) =>
    exact ? pathname === href : pathname === href || pathname.startsWith(`${href}/`);
  const enResto = resto.some((n) => isActive(n.href, n.exact));

  // Escape también lo cierra.
  useEffect(() => {
    if (!masAbierto) return;
    const cerrar = (e: KeyboardEvent) => e.key === "Escape" && setAbiertoEn(null);
    window.addEventListener("keydown", cerrar);
    return () => window.removeEventListener("keydown", cerrar);
  }, [masAbierto]);

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
        <main className="flex-1 p-4 pb-28 sm:p-6 sm:pb-28 md:pb-6 lg:p-8">{children}</main>

        {/* Nav móvil: barra inferior con 4 entradas y «Más» */}
        {masAbierto && (
          <div className="fixed inset-0 z-40 bg-ink/40 md:hidden" aria-hidden onClick={() => setMasAbierto(false)} />
        )}
        <div
          id="menu-mas"
          role="dialog"
          aria-modal="false"
          aria-label="Más secciones"
          hidden={!masAbierto}
          className="fixed inset-x-0 bottom-[calc(4rem+env(safe-area-inset-bottom))] z-50 mx-3 mb-2 rounded-2xl border border-line bg-white p-2 shadow-2xl md:hidden"
        >
          <div className="flex items-center justify-between px-2 pb-1 pt-1">
            <p className="text-xs font-semibold uppercase tracking-wider text-muted">Más</p>
            <button type="button" onClick={() => setMasAbierto(false)} className="flex h-11 w-11 items-center justify-center rounded-xl text-muted hover:bg-surface" aria-label="Cerrar">
              <X className="h-5 w-5" />
            </button>
          </div>
          <ul className="grid grid-cols-2 gap-1">
            {resto.map((item) => (
              <li key={item.href}>
                <Link
                  href={item.href}
                  aria-current={isActive(item.href, item.exact) ? "page" : undefined}
                  className={cn(
                    "flex min-h-12 items-center gap-2.5 rounded-xl px-3 text-sm font-medium transition-colors",
                    isActive(item.href, item.exact) ? "bg-brand-50 text-brand-800" : "text-ink-soft hover:bg-surface",
                  )}
                >
                  <item.icon className="h-[18px] w-[18px]" aria-hidden /> {item.label}
                </Link>
              </li>
            ))}
            <li>
              <Link href="/" target="_blank" className="flex min-h-12 items-center gap-2.5 rounded-xl px-3 text-sm font-medium text-ink-soft hover:bg-surface">
                <ExternalLink className="h-[18px] w-[18px]" aria-hidden /> Ver sitio
              </Link>
            </li>
          </ul>
          <p className="truncate px-3 pb-1 pt-2 text-xs text-muted">{email}</p>
        </div>
        <nav
          aria-label="Secciones del panel"
          className="fixed inset-x-0 bottom-0 z-50 grid grid-cols-5 border-t border-line bg-white/95 pb-[env(safe-area-inset-bottom)] backdrop-blur-xl md:hidden"
        >
          {principales.map((item) => {
            const active = isActive(item.href, item.exact);
            return (
              <Link
                key={item.href}
                href={item.href}
                aria-current={active ? "page" : undefined}
                className={cn("flex min-h-16 flex-col items-center justify-center gap-1 text-[11px] font-semibold transition-colors", active ? "text-brand-700" : "text-muted")}
              >
                <item.icon className={cn("h-5 w-5", active ? "text-brand-600" : "")} aria-hidden />
                {item.label}
              </Link>
            );
          })}
          <button
            type="button"
            onClick={() => setMasAbierto(!masAbierto)}
            aria-expanded={masAbierto}
            aria-controls="menu-mas"
            className={cn("flex min-h-16 flex-col items-center justify-center gap-1 text-[11px] font-semibold transition-colors", masAbierto || enResto ? "text-brand-700" : "text-muted")}
          >
            <MoreHorizontal className="h-5 w-5" aria-hidden />
            Más
          </button>
        </nav>
      </div>
    </div>
  );
}
