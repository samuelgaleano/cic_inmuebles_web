# CIC Inmuebles

Plataforma web de una inmobiliaria: **catálogo público** orientado a venta y un
**panel de administración** para gestionar el inventario, los leads y la agenda.

Ejes de diseño: **costo ≈ 0**, **catálogo siempre sincronizado** y buenas
prácticas de software escalables desde el inicio.

> Arquitectura completa y decisiones técnicas en
> [`docs/ARQUITECTURA.md`](docs/ARQUITECTURA.md).

## Stack

- **Next.js 16** (App Router) + **TypeScript**
- **Tailwind CSS v4**
- **Supabase** (PostgreSQL + Auth) — fuente de verdad *(Fase 1b)*
- **Cloudinary** (imágenes) + **YouTube** (videos) — estrategia de medios híbrida
- **Resend** (correos) · **Zod** (validación)
- **Google Drive** (archivo por inmueble) *(Fase 2)*
- Despliegue: **Vercel** + **GitHub**

## Estado actual (Fase 1a)

Sitio público funcionando con **datos de ejemplo** (no requiere servicios
externos para correr):

- Catálogo con filtros (operación, tipo, ciudad, habitaciones, estado).
- Ficha de inmueble: galería, video, especificaciones, estado y descripción.
- Captación de **compradores** (agendar visita / más información) y de
  **vendedores**, con mínima fricción + contacto por WhatsApp.
- SEO: `sitemap.xml`, `robots.txt`, metadatos Open Graph.

## Desarrollo local

Requisitos: Node.js ≥ 20.9 y pnpm.

```bash
pnpm install
cp .env.example .env.local   # opcional: el sitio funciona sin variables
pnpm dev                     # http://localhost:3000
```

Scripts:

```bash
pnpm dev         # servidor de desarrollo
pnpm build       # build de producción
pnpm start       # servir el build
pnpm lint        # ESLint
pnpm typecheck   # verificación de tipos
```

## Estructura

```
src/
├─ app/            # rutas (sitio público, sitemap/robots)
├─ components/     # UI reutilizable (ui/ y public/)
└─ lib/            # config, dominio, datos (repositorio), acciones, utils
supabase/migrations/  # esquema de base de datos (blueprint)
docs/                 # documentación de arquitectura
```

## Hoja de ruta

- **Fase 1b**: Supabase (BD + Auth), panel admin con CRUD de inmuebles/medios,
  bandeja de leads y correo real.
- **Fase 2**: agenda de visitas con disponibilidad de agentes + Google Drive.
- **Fase 3**: WhatsApp Business, plantillas (promesa de venta) y reportes.
