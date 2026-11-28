# CIC Inmuebles

Sitio de venta de inmuebles de CIC (https://www.cicinmuebles.com): catálogo público, captación de
compradores y vendedores, planes pagados para agentes ("Publica tu inmueble", con Wompi) y un panel
`/admin` con inventario, leads, CRM, agenda, vigencias y reportes.

Next.js 16.4 (App Router) + TypeScript + Tailwind CSS 4, Supabase, Vercel. Cómo está armado:
[`docs/ARQUITECTURA.md`](docs/ARQUITECTURA.md). Base de datos y migraciones:
[`supabase/README.md`](supabase/README.md).

## Arranque en local

Requisitos: **Node 24** (Next pide ≥ 20.9; el CI usa 24) y **pnpm** (`npx pnpm` sirve si no lo
tienes instalado; el lockfile se genera con pnpm 12).

```bash
pnpm install
cp .env.example .env.local   # opcional
pnpm dev                     # http://localhost:3000
```

Sin variables de entorno el sitio funciona con **datos de ejemplo en memoria** (se pierden al
reiniciar) y desactiva lo que dependa de cada servicio. El panel está en `/admin/login`: si no
defines `ADMIN_PASSWORD` y `ADMIN_SESSION_SECRET`, se generan al arrancar y la consola muestra la
clave temporal.

## Comandos

| Comando | Qué hace |
|---|---|
| `pnpm dev` | Servidor de desarrollo. |
| `pnpm build` | Build de producción (al final imprime la tabla de rutas con su modo). |
| `pnpm start` | Sirve el build. |
| `pnpm lint` | ESLint sobre `src`. |
| `pnpm typecheck` | `tsc --noEmit`. |
| `TZ=UTC pnpm test` | Pruebas (vitest). Las de fechas asumen UTC. |
| `pnpm audit --prod` | Avisos de seguridad de las dependencias de producción. |

El CI (`.github/workflows/ci.yml`) corre lint, tipos, pruebas, build y auditoría en cada push y PR a
`main`. Dependabot propone actualizaciones los lunes.

## Variables de entorno

Plantilla comentada en [`.env.example`](.env.example). En Vercel van en *Settings → Environment
Variables*. Ninguna se versiona.

| Variable | Para qué | Si falta |
|---|---|---|
| `NEXT_PUBLIC_SUPABASE_URL`, `SUPABASE_SERVICE_ROLE_KEY` | Base de datos (solo servidor). | Local: datos de ejemplo en memoria. Producción (`VERCEL_ENV=production`): error a propósito. |
| `ADMIN_EMAIL`, `ADMIN_PASSWORD`, `ADMIN_SESSION_SECRET` | Acceso al panel (sesión firmada). | Producción: panel cerrado, nadie entra. Local: correo `admin@cicinmuebles.com` y clave/secreto generados en memoria. |
| `RESEND_API_KEY`, `RESEND_FROM` | Envío de correos. | Los correos no salen (se registra en consola). |
| `LEADS_NOTIFICATION_EMAIL` | A dónde llegan los avisos de leads y pagos. | Se usa el correo de contacto del sitio. |
| `PAGOS_ALERT_EMAIL` | Correo de Pixies para alertas operativas (pagos, crons). | No se envían alertas. |
| `WOMPI_PUBLIC_KEY`, `WOMPI_INTEGRITY_SECRET`, `WOMPI_EVENTS_SECRET`, `WOMPI_PRIVATE_KEY` | Pasarela de pagos (las 4 del mismo ambiente). | Pago en línea desactivado: los planes ofrecen WhatsApp. Sin Supabase, el webhook responde 503. |
| `APP_URL` | URL de retorno tras pagar. | Se usa la URL fija de `src/lib/config/site.ts`. |
| `CRON_SECRET` | Protege los tres crons (`Authorization: Bearer`). | Los crons responden 401. |
| `RENOVACION_SECRET` | Firma los enlaces de renovación de los correos. | Se usa `CRON_SECRET`. |
| `GOOGLE_SERVICE_ACCOUNT_EMAIL`, `GOOGLE_PRIVATE_KEY` | Cuenta de servicio de Google (Drive y Sheets). | Sin importación de Drive ni hoja. |
| `GOOGLE_DRIVE_ROOT_FOLDER_ID` | Carpeta raíz de inmuebles en Drive ([`docs/ESTRUCTURA-DRIVE.md`](docs/ESTRUCTURA-DRIVE.md)). | Sin importación de Drive. |
| `GOOGLE_SHEETS_SPREADSHEET_ID` | Hoja espejo del catálogo. | Sin hoja. |
| `NEXT_PUBLIC_CLOUDINARY_CLOUD_NAME`, `NEXT_PUBLIC_CLOUDINARY_UPLOAD_PRESET` | CDN de imágenes opcional. | Las fotos se sirven desde Drive. |

La URL del sitio, el correo y el teléfono de contacto están fijos en `src/lib/config/site.ts`, no en
variables.

## Procesos automáticos

Definidos en [`vercel.json`](vercel.json). En el plan Hobby cada cron corre una vez al día (con hasta
±59 min de desfase) y todos exigen `CRON_SECRET`.

| Hora UTC | Ruta | Qué hace |
|---|---|---|
| 06:00 | `/api/cron/sync` | Importa de Drive los inmuebles nuevos (como borrador) y actualiza la hoja de Sheets si cambió algo. |
| 06:30 | `/api/pagos/wompi/reconciliar` | Concilia pagos con Wompi, purga datos de pago de más de 72 h y revisa vigencias de los planes. |
| 12:00 | `/api/cron/crm-diario` | Resumen por correo de los contactos para llamar hoy (7:00 en Bogotá). |

Cada uno deja un latido en la tabla `latidos`; [`/api/salud`](src/app/api/salud/route.ts) los resume
para el monitor externo del repositorio privado `cic-inmuebles-operacion`, que además hace el
respaldo semanal cifrado de la base.

## Migraciones

Se aplican a mano en el SQL Editor de Supabase, en orden. Qué hace cada una y una consulta de solo
lectura para saber si está aplicada: [`supabase/README.md`](supabase/README.md). Desde la 0014 la
tabla `migraciones_aplicadas` lleva el registro.

## Estructura

```
src/app/            rutas: (public)/, admin/, api/
src/components/     componentes (ui, public, admin, seo)
src/lib/            dominio, datos, acciones, integraciones, pagos, CRM, vigencias
src/proxy.ts        protección de /admin
supabase/           migraciones y su README
docs/               arquitectura, uso de Vercel, estructura del Drive, plantilla de ficha
```
