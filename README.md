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

## Estado actual

Funciona de inmediato con **datos de ejemplo** (sin servicios externos). Para
producción, ver [`docs/ACTIVACION.md`](docs/ACTIVACION.md).

**Sitio público**
- Catálogo con filtros (operación, tipo, ciudad, habitaciones, estado).
- Ficha de inmueble: galería, video, especificaciones, estado y descripción.
- Captación de **compradores** (agendar visita / más información) y de
  **vendedores**, con mínima fricción + contacto por WhatsApp.
- SEO: `sitemap.xml`, `robots.txt`, metadatos Open Graph.

**Panel de administración** (`/admin`, protegido)
- Autenticación con sesión firmada.
- Inmuebles: CRUD completo con carga de imágenes (Cloudinary) y revalidación
  automática del catálogo público.
- Leads: bandeja con estados y contacto por WhatsApp.
- Agenda: agentes, disponibilidad semanal y visitas.
- Plantillas (promesa de compraventa, contratos) y Reportes.

**Integraciones (listas, se activan con credenciales)**
- Supabase (persistencia), Cloudinary (imágenes), Resend (correos),
  Google Drive (carpeta + ficha por inmueble).

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

- ✅ **Fase 1a**: sitio público (catálogo, ficha, captación de leads, SEO).
- ✅ **Fase 1b**: panel admin (auth, CRUD de inmuebles, leads).
- ✅ **Fase 1c**: persistencia con Supabase (drop-in por credenciales).
- ✅ **Fase 2**: agenda (agentes, disponibilidad, visitas) + archivo en Drive.
- ✅ **Fase 3**: plantillas + reportes + carga de imágenes a Cloudinary.
- ⏳ **Pendiente de credenciales**: activar Supabase/Cloudinary/Resend/Drive
  (ver `docs/ACTIVACION.md`) y, a futuro, WhatsApp Business API (hoy con
  enlaces `wa.me`).
