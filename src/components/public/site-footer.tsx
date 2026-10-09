import Link from "next/link";
import { Logo } from "@/components/brand/brand-mark";
import { siteConfig, whatsappLink } from "@/lib/config/site";

type IconProps = { className?: string };

function FacebookIcon({ className }: IconProps) {
  return (
    <svg viewBox="0 0 24 24" fill="currentColor" aria-hidden="true" className={className}>
      <path d="M13.5 21v-7.2h2.4l.4-2.9h-2.8V9.1c0-.8.2-1.4 1.4-1.4h1.5V5.1c-.3 0-1.2-.1-2.2-.1-2.2 0-3.7 1.3-3.7 3.8v2.1H8v2.9h2.5V21h3z" />
    </svg>
  );
}

function InstagramIcon({ className }: IconProps) {
  return (
    <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true" className={className}>
      <rect x="3" y="3" width="18" height="18" rx="5" />
      <circle cx="12" cy="12" r="3.8" />
      <circle cx="17.3" cy="6.7" r="0.9" fill="currentColor" stroke="none" />
    </svg>
  );
}

function TikTokIcon({ className }: IconProps) {
  return (
    <svg viewBox="0 0 24 24" fill="currentColor" aria-hidden="true" className={className}>
      <path d="M16.6 3c.3 2.3 1.6 3.7 3.9 3.9v3.2c-1.5 0-2.8-.4-3.9-1.2v6.6c0 3.4-2.6 5.5-5.5 5.5A5.5 5.5 0 0 1 5.5 15.5c0-3.5 3-5.9 6.1-5.4v3.3c-1.4-.4-2.9.6-2.9 2.1 0 1.2 1 2.2 2.3 2.2 1.4 0 2.4-1 2.4-2.6V3h3.2z" />
    </svg>
  );
}

const SOCIALS = [
  { label: "Instagram", href: siteConfig.social.instagram, Icon: InstagramIcon },
  { label: "Facebook", href: siteConfig.social.facebook, Icon: FacebookIcon },
  { label: "TikTok", href: siteConfig.social.tiktok, Icon: TikTokIcon },
];

const enlace = "py-1 text-ink-soft transition-colors hover:text-brand-700";

export function SiteFooter() {
  const year = new Date().getFullYear();

  return (
    <footer className="mt-auto bg-surface text-[14px] leading-relaxed text-muted">
      <div className="wrap py-14">
        <div className="grid gap-12 md:grid-cols-[1.4fr_1fr_1fr_1.2fr]">
          <div>
            <Logo />
            <p className="mt-5 max-w-xs">{siteConfig.description}</p>
          </div>

          <nav aria-label="Inmuebles">
            <h2 className="text-[13px] font-semibold text-ink">Comprar</h2>
            <ul className="mt-3 flex flex-col">
              <li><Link href="/inmuebles" className={enlace}>Inmuebles en venta</Link></li>
              <li><Link href="/favoritos" className={enlace}>Mis favoritos</Link></li>
              <li><Link href="/comparar" className={enlace}>Comparar inmuebles</Link></li>
            </ul>
          </nav>

          <nav aria-label="Vender y publicar">
            <h2 className="text-[13px] font-semibold text-ink">Vender y publicar</h2>
            <ul className="mt-3 flex flex-col">
              <li><Link href="/vender" className={enlace}>Vender mi inmueble</Link></li>
              <li><Link href="/publica" className={enlace}>Publica tu inmueble</Link></li>
              <li><Link href="/contacto" className={enlace}>Alianza para agentes</Link></li>
            </ul>
          </nav>

          <div>
            <h2 className="text-[13px] font-semibold text-ink">Contacto</h2>
            <ul className="mt-3 flex flex-col">
              <li>
                <a href={whatsappLink(`Hola ${siteConfig.name}, quiero más información.`)} target="_blank" rel="noopener noreferrer" className={enlace}>
                  WhatsApp
                </a>
              </li>
              <li><a href={`mailto:${siteConfig.email}`} className={enlace}>{siteConfig.email}</a></li>
              <li><a href={`tel:${siteConfig.phone}`} className={`${enlace} tnum`}>{siteConfig.phoneDisplay}</a></li>
              <li className="py-1">{siteConfig.city}</li>
            </ul>
            <ul className="mt-4 flex gap-4">
              {SOCIALS.map(({ label, href, Icon }) => (
                <li key={label}>
                  <a
                    href={href}
                    target="_blank"
                    rel="noopener noreferrer"
                    aria-label={label}
                    className="flex h-9 w-9 items-center justify-center rounded-full border border-line-strong text-ink-soft transition-colors hover:border-ink hover:text-ink"
                  >
                    <Icon className="h-4 w-4" />
                  </a>
                </li>
              ))}
            </ul>
          </div>
        </div>

        <div className="mt-12 flex flex-col gap-2 border-t border-line pt-5 text-[12px] sm:flex-row sm:items-center sm:justify-between">
          <p>© {year} {siteConfig.name}. Todos los derechos reservados.</p>
          <Link href="/admin/login" className="transition-colors hover:text-ink">
            Acceso del equipo
          </Link>
        </div>
      </div>
    </footer>
  );
}
