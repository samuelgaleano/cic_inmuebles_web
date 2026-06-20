import Link from "next/link";
import { Building2, Mail, Phone } from "lucide-react";
import { siteConfig } from "@/lib/config/site";

export function SiteFooter() {
  const year = new Date().getFullYear();
  return (
    <footer className="mt-auto border-t border-slate-200 bg-brand-950 text-slate-300">
      <div className="mx-auto grid max-w-7xl gap-8 px-4 py-12 sm:px-6 md:grid-cols-3 lg:px-8">
        <div>
          <div className="flex items-center gap-2 text-white">
            <span className="flex h-9 w-9 items-center justify-center rounded-lg bg-brand-700">
              <Building2 className="h-5 w-5" />
            </span>
            <span className="text-lg font-bold">{siteConfig.name}</span>
          </div>
          <p className="mt-3 max-w-xs text-sm text-slate-400">{siteConfig.description}</p>
        </div>

        <div>
          <h3 className="text-sm font-semibold text-white">Navegación</h3>
          <ul className="mt-3 space-y-2 text-sm">
            <li><Link href="/inmuebles" className="hover:text-white">Inmuebles</Link></li>
            <li><Link href="/vender" className="hover:text-white">Vende tu inmueble</Link></li>
            <li><Link href="/contacto" className="hover:text-white">Contacto</Link></li>
          </ul>
        </div>

        <div>
          <h3 className="text-sm font-semibold text-white">Contacto</h3>
          <ul className="mt-3 space-y-2 text-sm">
            <li className="flex items-center gap-2">
              <Mail className="h-4 w-4" />
              <a href={`mailto:${siteConfig.email}`} className="hover:text-white">{siteConfig.email}</a>
            </li>
            <li className="flex items-center gap-2">
              <Phone className="h-4 w-4" />
              <span>{siteConfig.phoneDisplay}</span>
            </li>
          </ul>
        </div>
      </div>

      <div className="border-t border-white/10 py-5 text-center text-xs text-slate-500">
        © {year} {siteConfig.name}. Todos los derechos reservados.
      </div>
    </footer>
  );
}
