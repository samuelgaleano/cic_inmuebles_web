import { SiteHeader } from "@/components/public/site-header";
import { SiteFooter } from "@/components/public/site-footer";
import { FloatingWhatsApp } from "@/components/public/floating-whatsapp";
import { BandejaComparar } from "@/components/public/bandeja-comparar";

export default function PublicLayout({ children }: { children: React.ReactNode }) {
  return (
    <>
      {/* Por encima del header sticky (z-50) y con fondo opaco: al enfocarlo con teclado se lee entero. */}
      <a
        href="#contenido"
        className="sr-only focus:not-sr-only focus:fixed focus:left-4 focus:top-2.5 focus:z-[60] focus:rounded-full focus:bg-ink focus:px-5 focus:py-2.5 focus:text-sm focus:font-medium focus:text-white"
      >
        Saltar al contenido
      </a>
      <SiteHeader />
      <main id="contenido" className="flex-1">{children}</main>
      <SiteFooter />
      <aside aria-label="Accesos rápidos">
        <BandejaComparar />
        <FloatingWhatsApp />
      </aside>
    </>
  );
}
