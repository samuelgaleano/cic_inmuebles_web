import Link from "next/link";
import { Lock, Mail, MapPin, Phone } from "lucide-react";
import { Logo } from "@/components/brand/brand-mark";
import { siteConfig, whatsappLink } from "@/lib/config/site";

export function SiteFooter() {
  const year = new Date().getFullYear();

  return (
    <footer className="mt-auto bg-ink text-white/70">
      <div className="bg-aurora">
        <div className="mx-auto grid max-w-6xl gap-10 px-4 py-16 sm:px-6 md:grid-cols-[1.4fr_1fr_1fr] lg:px-8">
          <div>
            <Logo tone="dark" />
            <p className="mt-5 max-w-xs text-sm leading-relaxed text-white/55">
              {siteConfig.description}
            </p>
            <Link
              href={whatsappLink(`Hola ${siteConfig.name}, quiero más información.`)}
              className="mt-6 inline-flex items-center gap-2 rounded-full border border-white/15 bg-white/5 px-4 py-2 text-sm font-medium text-white transition-colors hover:border-brand-400/50 hover:bg-brand-500/10"
            >
              <span className="h-1.5 w-1.5 rounded-full bg-brand-400" />
              Escríbenos por WhatsApp
            </Link>
          </div>

          <div>
            <h3 className="font-display text-sm font-semibold text-white">Navegación</h3>
            <ul className="mt-4 space-y-2.5 text-sm">
              <li><Link href="/inmuebles" className="transition-colors hover:text-white">Inmuebles</Link></li>
              <li><Link href="/vender" className="transition-colors hover:text-white">Vender mi inmueble</Link></li>
              <li><Link href="/contacto" className="transition-colors hover:text-white">Contacto</Link></li>
            </ul>
          </div>

          <div>
            <h3 className="font-display text-sm font-semibold text-white">Contacto</h3>
            <ul className="mt-4 space-y-2.5 text-sm">
              <li className="flex items-center gap-2.5">
                <Mail className="h-4 w-4 text-brand-400" />
                <a href={`mailto:${siteConfig.email}`} className="transition-colors hover:text-white">
                  {siteConfig.email}
                </a>
              </li>
              <li className="flex items-center gap-2.5">
                <Phone className="h-4 w-4 text-brand-400" />
                <span>{siteConfig.phoneDisplay}</span>
              </li>
              <li className="flex items-center gap-2.5">
                <MapPin className="h-4 w-4 text-brand-400" />
                <span>{siteConfig.city}</span>
              </li>
            </ul>
          </div>
        </div>
      </div>

      <div className="border-t border-white/10">
        <div className="mx-auto flex max-w-6xl flex-col items-center justify-between gap-2 px-4 py-6 text-xs text-white/40 sm:flex-row sm:px-6 lg:px-8">
          <p>© {year} {siteConfig.name}. Todos los derechos reservados.</p>
          <div className="flex items-center gap-4">
            <p>Hecho con dedicación para tu próximo hogar.</p>
            {/* Acceso al panel de administración */}
            <Link
              href="/admin/login"
              className="inline-flex items-center gap-1.5 font-medium text-white/45 transition-colors duration-300 hover:text-brand-400"
            >
              <Lock className="h-3.5 w-3.5" /> Panel
            </Link>
          </div>
        </div>
      </div>
    </footer>
  );
}
