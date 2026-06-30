# Arquitectura — CIC Inmuebles

Documento vivo que describe las decisiones técnicas del proyecto. Los dos ejes
rectores son: **(1) costo ≈ 0** y **(2) catálogo siempre sincronizado**, sin
sacrificar buenas prácticas ni escalabilidad.

---

## 1. Visión general

Un **único proyecto Next.js (App Router) + TypeScript** que sirve:

- **Sitio público** (`cicinmuebles.com`): catálogo llamativo orientado a venta,
  con captación de compradores y de vendedores.
- **Panel de administración** (`admin.cicinmuebles.com`): gestión de inventario,
  leads, agenda y procesos internos (Fase 1b en adelante).

Despliegue continuo desde GitHub. Una sola base de código = menor costo y
mantenimiento más simple.

---

## 2. Stack tecnológico (todo en capa gratuita)

| Capa            | Tecnología                          | Notas |
|-----------------|-------------------------------------|-------|
| Framework       | Next.js 16 (App Router) + TypeScript | SSR/SSG/ISR; front y back juntos |
| UI              | Tailwind CSS v4 + componentes propios | Catálogo rápido y responsive |
| Base de datos   | Supabase (PostgreSQL)               | Fuente de verdad. Auth + Storage + RLS |
| Autenticación   | Supabase Auth                       | Admin y agentes con roles |
| Imágenes        | Cloudinary                          | CDN + optimización automática |
| Videos          | YouTube (no listado) embebido       | Streaming gratis e ilimitado |
| Correos         | Resend                              | Notificación de leads / confirmaciones |
| Archivo/Drive   | Google Drive API (cuenta empresa)   | Carpeta por inmueble + doc de specs |
| Hosting / CI    | Vercel + GitHub                     | Auto-deploy en cada push |
| Validación      | Zod                                 | Formularios y acciones de servidor |

> **Nota de costo (producción).** El plan *Hobby* de Vercel es técnicamente solo
> para uso no comercial. El código se mantiene **portable** (sin acoplarse a APIs
> propietarias) para poder mover producción a **Cloudflare Pages / Netlify**
> (gratis, uso comercial permitido) o pasar a **Vercel Pro** (~USD 20/mes) cuando
> se lance formalmente. Decisión: *empezar en Vercel y decidir luego*.

---

## 3. Principio transversal: mínima fricción

Tanto la **reserva de visita** como el **lead de venta** están diseñados para
concretarse en el menor número de pasos:

- Formularios de **un solo paso**: nombre + WhatsApp (obligatorios), correo
  opcional; el contexto (inmueble, intención, ciudad) viaja en campos ocultos.
- **Botón de WhatsApp** con mensaje predefinido como vía de contacto inmediata.
- Validación y honeypot anti-spam sin CAPTCHAs que estorben.

---

## 4. Estrategia de medios (híbrida)

Decisión: **la base de datos es la fuente de verdad; Google Drive es el archivo
operativo, no un CDN.**

- **Imágenes** → **por defecto se sirven directo desde Google Drive**
  (`lh3.googleusercontent.com`), optimizadas vía `mediaLoader` (parámetro de
  tamaño nativo). Decisión deliberada de **mínimas dependencias**: Drive ya es la
  bandeja de entrada, así que no se añade ningún servicio extra para mostrar las
  fotos. Suficiente para tráfico bajo/medio.
  - **Cloudinary es OPCIONAL** (mejora, no requisito). Si se configura, las fotos
    se re-alojan ahí (`uploadRemoteImage`) para entrega vía CDN dedicado; si no,
    se usan las de Drive sin romper nada.
  - **Plan B de crecimiento sin añadir servicios**: **Supabase Storage** (la
    misma base que ya es fuente de verdad) si en el futuro se quiere dejar de
    depender del hotlinking informal de Drive.
- **Optimización sin dependencias medidas** → un *loader* propio
  (`mediaLoader`) hace que `next/image` **no use el optimizador de Vercel**
  (recurso con tope en el plan gratuito) y delegue en el origen, que optimiza
  gratis: Cloudinary (`f_auto,q_auto,c_limit,w_…`) o el tamaño nativo de Drive
  (`=w…`). Una dependencia (y un tope) menos.
- **Tolerancia a fallos** → `SafeImage` degrada con elegancia a un marcador
  "imagen no disponible" si una URL cae (archivo borrado, CDN limitado), en vez
  de mostrar una imagen rota.
- **Videos** → YouTube no listado, embebido en la ficha.
- **Google Drive** → al registrar un inmueble en el panel, la app:
  1. crea automáticamente la carpeta `Nombre – Localidad`,
  2. genera el **documento de especificaciones** estandarizado,
  3. guarda copia del material audiovisual (respaldo humano-legible).
  Drive es el **archivo operativo / bandeja de entrada**, nunca el CDN del sitio.
- **Importar desde Drive**: si se sube una carpeta a mano, un botón en el panel
  la lee, parsea el documento de specs, re-aloja las fotos en Cloudinary y crea el
  inmueble como **borrador**. Esto da el flujo "subo a Drive y se refleja" sin un
  sincronizador frágil permanente y conservando la revisión humana antes de
  publicar.

### Formato del documento de especificaciones
Markdown con cabecera `clave: valor` (legible por humanos y parseable):

```
codigo: CIC-0001
tipo: apartamento
operacion: venta
estado: disponible
precio: 720000000
ciudad: Medellín
barrio: El Poblado
habitaciones: 3
banos: 2
area_construida: 92
propietario_nombre: ...
propietario_telefono: ...
---
descripcion_corta: Apto 3 hab, 92 m², El Poblado. Piscina y gimnasio.

descripcion:
Texto largo que se muestra en la ficha del inmueble...
```

---

## 5. Sincronización del catálogo

El estado (Disponible / En proceso / Vendido) y cualquier cambio de precio se
reflejan casi en tiempo real mediante **ISR + revalidación on-demand**:

- Las fichas se prerenderizan (rápidas y con buen SEO).
- Al guardar un cambio en el panel admin se dispara la revalidación de las rutas
  afectadas (`revalidateTag` / `revalidatePath`), regenerando la página en segundos.

---

## 6. Capas del código

```
src/
├─ app/
│  ├─ (public)/            # sitio público (catálogo, ficha, vender, contacto)
│  ├─ admin/               # panel de administración (Fase 1b)
│  ├─ sitemap.ts, robots.ts
│  └─ layout.tsx, globals.css
├─ components/
│  ├─ ui/                  # primitivos (Button, StatusBadge, ...)
│  └─ public/              # componentes del sitio público
└─ lib/
   ├─ config/              # configuración del sitio
   ├─ domain/              # tipos y reglas del negocio (Property, Lead, ...)
   ├─ data/                # patrón repositorio (memoria hoy → Supabase después)
   ├─ actions/             # acciones de servidor (formularios)
   ├─ notifications/       # correo (Resend)
   └─ utils/               # formato, helpers
```

**Patrón repositorio**: la UI depende de interfaces (`PropertyRepository`,
`LeadRepository`), no de una base de datos concreta. Hoy hay una implementación
en memoria con datos de ejemplo; conectar Supabase es añadir una implementación
y conmutarla en `lib/data/index.ts`, sin tocar la UI.

---

## 7. Modelo de datos

Esquema completo en [`supabase/migrations/0001_init.sql`](../supabase/migrations/0001_init.sql).
Entidades: `properties`, `property_media`, `agents`, `agent_availability`,
`leads`, `appointments`, `templates`. RLS: lectura pública de inmuebles
publicados e inserción pública de leads; el resto se gestiona desde el panel
admin con la *service role key*.

---

## 8. Subdominio del panel admin

`admin.cicinmuebles.com` se sirve desde la misma app vía `proxy.ts`
(reescritura por host) o configuración de dominios en Vercel. Rutas bajo
`/admin`, protegidas con Supabase Auth y roles (`admin`, `agente_master`,
`agente`). No se indexa (ver `robots.ts`).

---

## 9. Plan por fases

- **Fase 1a — Sitio público (ESTE ENTREGABLE).** Catálogo con filtros, ficha de
  inmueble (galería, video, specs, estado), captación de compradores y
  vendedores con mínima fricción, notificación de leads, SEO. Funciona con datos
  de ejemplo.
- **Fase 1b — Datos reales + admin.** Supabase (BD + Auth), CRUD de inmuebles y
  medios (Cloudinary), bandeja de leads, integración de correo (Resend).
- **Fase 2 — Agenda + Drive.** Disponibilidad de agentes y reserva de visitas;
  creación/lectura de carpetas en Google Drive e importación.
- **Fase 3 — WhatsApp Business + plantillas + reportes.** Automatización de
  respuestas, plantillas (promesa de venta, etc.) y métricas (vendidos,
  comisiones).

---

## 10. Credenciales / accesos necesarios

A medida que avanza Fase 1b en adelante (el sitio actual NO los requiere para
funcionar):

1. **Dominio** comprado (p. ej. `cicinmuebles.com`).
2. **Supabase**: URL del proyecto + `anon key` + `service role key`.
3. **Cloudinary**: `cloud name` + API key/secret (+ upload preset opcional).
4. **Resend**: API key + dominio verificado para el remitente (o usar Gmail SMTP).
5. **Google Cloud**: cuenta de servicio con acceso al Drive de
   `cc.inmuebles@gmail.com` + ID de la carpeta raíz.
6. **WhatsApp**: número de la empresa (para enlaces `wa.me` y, después, la API).

Todas las variables están documentadas en [`.env.example`](../.env.example).
