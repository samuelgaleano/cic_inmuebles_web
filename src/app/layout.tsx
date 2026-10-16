import type { Metadata } from "next";
import { Fraunces, Hanken_Grotesk } from "next/font/google";
import "./globals.css";
import { JsonLd } from "@/components/seo/json-ld";
import { siteConfig } from "@/lib/config/site";

// Dos voces: Fraunces (serif de edición, variable) para titulares y cifras grandes, que dan
// aire de firma establecida, y Hanken Grotesk para el texto y la interfaz, legible y neutra.
const fraunces = Fraunces({
  variable: "--font-fraunces",
  subsets: ["latin"],
  axes: ["opsz"],
  display: "swap",
});
const hanken = Hanken_Grotesk({
  variable: "--font-hanken",
  subsets: ["latin"],
  display: "swap",
});

const GOOGLE_SITE_VERIFICATION = "9wOGF6QxQDsYkPkneIlNQL-rvF7H8gkZu2PYkLaVO0w";

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
  // Search Console (propiedad de prefijo https://www.cicinmuebles.com/),
  // verificada con la cuenta de CIC. Token público: sale en el HTML.
  verification: { google: GOOGLE_SITE_VERIFICATION },
  keywords: [
    "apartamentos en venta en Bogotá",
    "apartamentos en venta norte de Bogotá",
    "apartamentos en venta",
    "comprar apartamento en Bogotá",
    "vender mi apartamento en Bogotá",
    "vender mi casa",
    "inmuebles en venta en Bogotá",
    "inmobiliaria en Bogotá",
    "finca raíz Bogotá",
    siteConfig.name,
  ],
  openGraph: {
    type: "website",
    locale: "es_CO",
    siteName: siteConfig.name,
    title: fullTitle,
    description: siteConfig.description,
    images: [siteConfig.ogImage],
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
      alternateName: ["CIC Inmobiliaria", "CIC"],
      description:
        "Inmobiliaria en Bogotá. Venta de apartamentos y casas y gestión de inmuebles en Colombia, con portafolio corto, visitado y verificado.",
      knowsAbout: ["Venta de apartamentos", "Venta de casas", "Gestión de inmuebles", "Inmuebles en Bogotá"],
      url: siteConfig.url,
      telephone: siteConfig.phone,
      email: siteConfig.email,
      image: `${siteConfig.url}${siteConfig.ogImage.url}`,
      address: { "@type": "PostalAddress", addressLocality: siteConfig.city, addressCountry: "CO" },
      knowsLanguage: "es",
      sameAs: Object.values(siteConfig.social),
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
      className={`${fraunces.variable} ${hanken.variable} h-full antialiased`}
    >
      <body className="flex min-h-full flex-col bg-white text-ink">
        {/* Las fotos de los inmuebles se sirven desde Cloudinary: adelantar el
            handshake reduce el LCP del catálogo y las fichas. React lo iza al <head>. */}
        <link rel="preconnect" href="https://res.cloudinary.com" />
        <link rel="dns-prefetch" href="https://res.cloudinary.com" />
        <JsonLd data={siteJsonLd} />
        {children}
      </body>
    </html>
  );
}
