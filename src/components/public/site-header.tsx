"use client";

import { useEffect, useState } from "react";
import Link from "next/link";
import { usePathname } from "next/navigation";
import { ArrowUpRight } from "lucide-react";
import { Logo } from "@/components/brand/brand-mark";
import { buttonVariants } from "@/components/ui/button";
import { cn } from "@/lib/utils/cn";

const navItems = [
  { href: "/", label: "Inicio" },
  { href: "/inmuebles", label: "Inmuebles" },
  { href: "/vender", label: "Vender" },
  { href: "/contacto", label: "Contacto" },
];

export function SiteHeader() {
  const pathname = usePathname();
  const [open, setOpen] = useState(false);

  // Bloquea el scroll del body cuando el menú móvil está abierto.
  useEffect(() => {
    document.body.style.overflow = open ? "hidden" : "";
    return () => {
      document.body.style.overflow = "";
    };
  }, [open]);

  const isActive = (href: string) =>
    href === "/" ? pathname === "/" : pathname.startsWith(href);

  return (
    <header className="sticky top-0 z-50 px-4 pt-4 sm:pt-5">
      <div className="mx-auto flex h-14 max-w-6xl items-center justify-between rounded-full border border-line bg-white/80 pl-4 pr-2 shadow-[0_10px_40px_-20px_rgba(11,26,21,0.35)] backdrop-blur-xl sm:pl-5">
        <Link href="/" aria-label="CIC Inmuebles — inicio">
          <Logo />
        </Link>

        <nav className="hidden items-center gap-1 md:flex">
          {navItems.map((item) => (
            <Link
              key={item.href}
              href={item.href}
              className={cn(
                "rounded-full px-3.5 py-2 text-sm font-medium transition-colors duration-300",
                isActive(item.href)
                  ? "bg-brand-50 text-brand-800"
                  : "text-ink-soft hover:bg-brand-50/70 hover:text-brand-800",
              )}
            >
              {item.label}
            </Link>
          ))}
        </nav>

        <div className="flex items-center gap-2">
          <Link
            href="/vender"
            className={buttonVariants({
              variant: "primary",
              size: "sm",
              className: "hidden rounded-full sm:inline-flex",
            })}
          >
            Vende tu inmueble
            <span className="flex h-5 w-5 items-center justify-center rounded-full bg-white/20 transition-transform duration-300 group-hover:translate-x-0.5 group-hover:-translate-y-0.5">
              <ArrowUpRight className="h-3 w-3" />
            </span>
          </Link>

          {/* Hamburguesa móvil que se transforma en X */}
          <button
            type="button"
            onClick={() => setOpen((v) => !v)}
            aria-label={open ? "Cerrar menú" : "Abrir menú"}
            aria-expanded={open}
            className="relative z-50 flex h-10 w-10 items-center justify-center rounded-full text-ink transition-colors hover:bg-brand-50 md:hidden"
          >
            <span className="relative block h-4 w-5">
              <span
                className={cn(
                  "absolute left-0 block h-0.5 w-5 rounded-full bg-current transition-all duration-300 ease-[cubic-bezier(0.16,1,0.3,1)]",
                  open ? "top-1/2 -translate-y-1/2 rotate-45" : "top-0.5",
                )}
              />
              <span
                className={cn(
                  "absolute left-0 top-1/2 block h-0.5 w-5 -translate-y-1/2 rounded-full bg-current transition-opacity duration-300",
                  open && "opacity-0",
                )}
              />
              <span
                className={cn(
                  "absolute left-0 block h-0.5 w-5 rounded-full bg-current transition-all duration-300 ease-[cubic-bezier(0.16,1,0.3,1)]",
                  open ? "top-1/2 -translate-y-1/2 -rotate-45" : "bottom-0.5",
                )}
              />
            </span>
          </button>
        </div>
      </div>

      {/* Overlay móvil a pantalla completa */}
      <div
        className={cn(
          "fixed inset-0 z-40 origin-top bg-white/85 backdrop-blur-2xl transition-all duration-500 ease-[cubic-bezier(0.16,1,0.3,1)] md:hidden",
          open ? "pointer-events-auto opacity-100" : "pointer-events-none opacity-0",
        )}
      >
        <nav className="flex h-full flex-col justify-center gap-2 px-8">
          {navItems.map((item, i) => (
            <Link
              key={item.href}
              href={item.href}
              onClick={() => setOpen(false)}
              className={cn(
                "border-b border-line py-4 font-display text-3xl font-bold tracking-tight transition-all duration-500 ease-[cubic-bezier(0.16,1,0.3,1)]",
                isActive(item.href) ? "text-brand-700" : "text-ink",
                open ? "translate-y-0 opacity-100" : "translate-y-6 opacity-0",
              )}
              style={{ transitionDelay: open ? `${120 + i * 70}ms` : "0ms" }}
            >
              {item.label}
            </Link>
          ))}
          <Link
            href="/inmuebles"
            onClick={() => setOpen(false)}
            className={buttonVariants({
              variant: "primary",
              size: "lg",
              className: cn(
                "mt-6 w-full transition-all duration-500 ease-[cubic-bezier(0.16,1,0.3,1)]",
                open ? "translate-y-0 opacity-100" : "translate-y-6 opacity-0",
              ),
            })}
            style={{ transitionDelay: open ? `${120 + navItems.length * 70}ms` : "0ms" }}
          >
            Ver catálogo
          </Link>
        </nav>
      </div>
    </header>
  );
}
