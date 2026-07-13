import type { Metadata } from "next";
import { Sora, Plus_Jakarta_Sans, Geist_Mono } from "next/font/google";
import "./globals.css";
import { JsonLd } from "@/components/seo/json-ld";
import { siteConfig } from "@/lib/config/site";

const sora = Sora({
  variable: "--font-sora",
  subsets: ["latin"],
  weight: ["500", "600", "700", "800"],
});

const jakarta = Plus_Jakarta_Sans({
  variable: "--font-jakarta",
  subsets: ["latin"],
});

const geistMono = Geist_Mono({
  variable: "--font-geist-mono",
  subsets: ["latin"],
});

const fullTitle = `${siteConfig.name} — ${siteConfig.tagline}`;

// Nota: no definimos `twitter` porque Next lo deriva automáticamente del
// `openGraph` resuelto de cada página (así las fichas usan su propia foto).
export const metadata: Metadata = {
  metadataBase: new URL(siteConfig.url),
  title: {
    default: fullTitle,
    template: `%s | ${siteConfig.name}`,
  },
  description: siteConfig.description,
  keywords: [
    "apartamentos en venta",
    "casas en venta",
    "apartamentos en venta en Colombia",
    "casas en venta en Colombia",
    "comprar apartamento",
    "comprar casa",
    "vender mi apartamento",
    "vender mi casa",
    "inmuebles en venta",
    "finca raíz Colombia",
    "inmobiliaria en Colombia",
    siteConfig.name,
  ],
  openGraph: {
    type: "website",
    locale: "es_CO",
    siteName: siteConfig.name,
    title: fullTitle,
    description: siteConfig.description,
    images: [
      {
        url: "/hero.jpg",
        width: 1920,
        height: 1280,
        alt: fullTitle,
      },
    ],
  },
};

// Identidad del sitio para buscadores, presente en todas las páginas:
// grafo conectado (WebSite → publisher → organización) con @id estables.
// El SearchAction apunta al buscador real del catálogo (/inmuebles?q=).
const ORG_ID = `${siteConfig.url}/#org`;
const siteJsonLd = {
  "@context": "https://schema.org",
  "@graph": [
    {
      "@type": "WebSite",
      "@id": `${siteConfig.url}/#website`,
      name: siteConfig.name,
      url: siteConfig.url,
      inLanguage: "es",
      publisher: { "@id": ORG_ID },
      potentialAction: {
        "@type": "SearchAction",
        target: {
          "@type": "EntryPoint",
          urlTemplate: `${siteConfig.url}/inmuebles?q={search_term_string}`,
        },
        "query-input": "required name=search_term_string",
      },
    },
    {
      "@type": "RealEstateAgent",
      "@id": ORG_ID,
      name: siteConfig.name,
      description: siteConfig.description,
      url: siteConfig.url,
      telephone: siteConfig.phone,
      email: siteConfig.email,
      image: `${siteConfig.url}/hero.jpg`,
      address: { "@type": "PostalAddress", addressCountry: "CO" },
      knowsLanguage: "es",
      ...((siteConfig.social.instagram || siteConfig.social.facebook) && {
        sameAs: [siteConfig.social.instagram, siteConfig.social.facebook].filter(Boolean),
      }),
    },
  ],
};

export default function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  return (
    <html
      lang="es-CO"
      className={`${sora.variable} ${jakarta.variable} ${geistMono.variable} h-full antialiased`}
    >
      <body className="flex min-h-full flex-col bg-white text-ink">
        {/* Las fotos de los inmuebles se sirven desde Google Drive: adelantar
            el handshake reduce el LCP de galerías y tarjetas. React los iza al <head>. */}
        <link rel="preconnect" href="https://lh3.googleusercontent.com" />
        <link rel="dns-prefetch" href="https://lh3.googleusercontent.com" />
        <JsonLd data={siteJsonLd} />
        {children}
      </body>
    </html>
  );
}
