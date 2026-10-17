"use client";

import { useEffect, useRef } from "react";
import Link from "next/link";
import { usePathname } from "next/navigation";
import { Heart, Menu, MessageCircle, X } from "lucide-react";
import { buttonVariants } from "@/components/ui/button";
import { whatsappLink } from "@/lib/config/site";
import { Logo } from "@/components/brand/brand-mark";
import { useFavoritos } from "@/lib/cliente/almacenes";
import { bloquearScroll } from "@/lib/cliente/scroll";
import { cn } from "@/lib/utils/cn";

const navItems = [
  { href: "/inmuebles", label: "Inmuebles" },
  { href: "/vender", label: "Vender" },
  { href: "/publica", label: "Publica tu inmueble" },
  { href: "/contacto", label: "Contacto" },
];

// «Vender» sale de la lista y pasa a ser el botón principal de la barra.
const navEscritorio = navItems.filter((i) => i.href !== "/vender");

// En el móvil, los agentes llegan directo a los planes (justo después de «Publica tu inmueble»).
const navMovil = [
  { href: "/", label: "Inicio" },
  ...navItems.flatMap((i) => (i.href === "/publica" ? [i, { href: "/publica/agente", label: "Publicar como agente" }] : [i])),
  { href: "/favoritos", label: "Favoritos" },
];

export function SiteHeader() {
  const pathname = usePathname();
  const menu = useRef<HTMLDialogElement>(null);
  const { ids: favoritos } = useFavoritos();

  const isActive = (href: string) => pathname === href || pathname.startsWith(`${href}/`);
  // En el menú móvil solo se marca la entrada más específica (en /publica/agente, «Publicar como agente»).
  const isActiveMovil = (href: string) =>
    isActive(href) && !navMovil.some((o) => o.href !== href && o.href.startsWith(`${href}/`) && isActive(o.href));

  // El menú móvil es un <dialog> modal: el navegador atrapa el foco, Escape lo cierra
  // y lo de atrás queda inerte. Solo falta bloquear el scroll de la página.
  const abrir = () => {
    menu.current?.showModal();
    bloquearScroll(true);
  };
  const cerrar = () => menu.current?.close();

  useEffect(() => {
    const d = menu.current;
    if (!d) return;
    const alCerrar = () => bloquearScroll(false);
    d.addEventListener("close", alCerrar);
    return () => {
      d.removeEventListener("close", alCerrar);
      bloquearScroll(false);
    };
  }, []);

  // Cualquier navegación cierra el menú.
  useEffect(() => {
    if (menu.current?.open) menu.current.close();
  }, [pathname]);

  return (
    <header className="barra-borde sticky top-0 z-50 border-b border-line bg-white/80 backdrop-blur-xl">
      <div className="wrap flex h-[64px] items-center justify-between gap-4 sm:gap-6">
        <Link href="/" aria-label="CIC Inmuebles — inicio" className="rounded-lg">
          <Logo />
        </Link>

        <nav aria-label="Principal" className="hidden items-center gap-1 md:flex">
          {navEscritorio.map((item) => (
            <Link
              key={item.href}
              href={item.href}
              aria-current={isActive(item.href) ? "page" : undefined}
              className={cn(
                "rounded-full px-4 py-2 text-[15px] font-medium transition-colors duration-200",
                isActive(item.href) ? "bg-ink/[0.07] text-ink" : "text-ink-soft hover:bg-ink/[0.05] hover:text-ink",
              )}
            >
              {item.label}
            </Link>
          ))}
        </nav>

        <div className="flex items-center gap-1.5 sm:gap-2">
          <a
            href={whatsappLink("Hola CIC Inmuebles, quiero hablar con un asesor.")}
            target="_blank"
            rel="noopener noreferrer"
            className={cn(buttonVariants({ variant: "whatsapp", size: "sm" }), "hidden lg:inline-flex")}
          >
            <MessageCircle className="h-4 w-4" aria-hidden />
            WhatsApp
          </a>
          <Link href="/vender" className={buttonVariants({ variant: "primary", size: "sm" })}>
            <span>Vender<span className="hidden sm:inline"> mi inmueble</span></span>
          </Link>
          <Link
            href="/favoritos"
            aria-label={favoritos.length > 0 ? `Mis favoritos (${favoritos.length})` : "Mis favoritos"}
            className="relative flex h-10 w-10 items-center justify-center rounded-full text-ink transition-colors hover:bg-ink/[0.06]"
          >
            <Heart className={cn("h-5 w-5", favoritos.length > 0 && "fill-brand-600 text-brand-600")} aria-hidden />
            {favoritos.length > 0 && (
              <span className="tnum absolute right-0.5 top-0.5 flex h-4 min-w-4 items-center justify-center rounded-full bg-ink px-1 text-[10px] font-semibold text-white">
                {favoritos.length}
              </span>
            )}
          </Link>
          <button
            type="button"
            onClick={abrir}
            aria-label="Abrir menú"
            className="flex h-10 w-10 items-center justify-center rounded-full text-ink transition-colors hover:bg-ink/[0.06] md:hidden"
          >
            <Menu className="h-5 w-5" aria-hidden />
          </button>
        </div>
      </div>

      <dialog ref={menu} aria-label="Menú" className="h-dvh w-screen bg-white md:hidden">
        <div className="wrap flex h-[64px] items-center justify-between">
          <Logo />
          <button
            type="button"
            onClick={cerrar}
            aria-label="Cerrar menú"
            className="flex h-10 w-10 items-center justify-center rounded-full text-ink transition-colors hover:bg-ink/[0.06]"
          >
            <X className="h-5 w-5" aria-hidden />
          </button>
        </div>
        <nav aria-label="Menú móvil" className="wrap pt-10">
          <ul>
            {navMovil.map((item, i) => (
              <li key={item.href} className="anim-sube border-b border-line" style={{ "--d": `${80 + i * 55}ms` } as React.CSSProperties}>
                <Link
                  href={item.href}
                  onClick={cerrar}
                  aria-current={isActiveMovil(item.href) ? "page" : undefined}
                  className={cn(
                    "block py-4 text-[2rem] font-semibold leading-tight tracking-[-0.03em]",
                    isActiveMovil(item.href) ? "text-brand-700" : "text-ink",
                  )}
                >
                  {item.label}
                </Link>
              </li>
            ))}
          </ul>
        </nav>
      </dialog>
    </header>
  );
}
