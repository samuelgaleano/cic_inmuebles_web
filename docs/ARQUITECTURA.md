# Arquitectura — CIC Inmuebles

Cómo está hecho el sitio hoy, sacado del código y de la tabla de `next build`. Si algo de aquí
deja de coincidir con el código, manda el código y este documento se corrige.

Ejes: **costo cero** (todo en capas gratuitas), **catálogo siempre al día** y **fallar cerrado**
donde hay dinero o datos personales.

---

## 1. Piezas

Un solo proyecto **Next.js 16.4 (App Router) + TypeScript** desplegado en **Vercel (Hobby)**
desde la rama `main` de GitHub. Sirve el sitio público, el panel `/admin` y las rutas `/api`.

| Pieza | Para qué | Dónde en el código |
|---|---|---|
| Supabase (PostgreSQL, plan Free) | Fuente de verdad: inmuebles, leads, agenda, pagos, vigencias, CRM. Solo se habla con ella desde el servidor con la llave de servicio. | `src/lib/data/supabase/client.ts` |
| Wompi | Cobro de los planes de "Publica tu inmueble" (widget, webhook, conciliación). | `src/lib/integrations/wompi.ts`, `src/lib/pagos/`, `src/app/api/pagos/wompi/` |
| Resend | Correos: avisos de leads y pagos, recordatorios de vigencia, resumen diario del CRM, alertas a Pixies. | `src/lib/notifications/` |
| Google Drive (cuenta de servicio) | Bandeja de entrada del material: carpetas `ciudad → estado → inmueble` con fotos y `especificaciones.md`; el panel y el cron importan desde ahí. | `src/lib/integrations/drive.ts`, `src/lib/services/drive-import.ts`, `docs/ESTRUCTURA-DRIVE.md` |
| Google Sheets (misma cuenta) | Espejo plano del catálogo completo (incluye datos privados) para el equipo de CIC. | `src/lib/integrations/sheets.ts` |
| Cloudinary (opcional) | CDN de imágenes si se configura; si no, las fotos salen de Drive. | `src/lib/integrations/cloudinary.ts`, `src/lib/utils/image-loader.ts` |
| YouTube | Videos no listados embebidos en la ficha. | — |

Imágenes: todas pasan por `SafeImage` con el loader propio `mediaLoader`; `next/image` no usa el
optimizador de Vercel (Drive y Cloudinary redimensionan en el origen) y `/_next/image` solo acepta la
cuenta propia de Cloudinary (`next.config.ts`).

---

## 2. Rutas y cómo se generan

Tomado de la tabla de `next build` (Next 16.4.5). `○` estática, `●` estática con
`generateStaticParams`, `ƒ` dinámica (se ejecuta en cada petición). "ISR 6 h" = se regenera como
máximo cada 6 h (`revalidate = 21600`) y al instante cuando el panel invalida la etiqueta `inventario`.

| Ruta | Modo | Nota |
|---|---|---|
| `/` | ○ ISR 6 h | Portada con el inventario publicado. |
| `/inmuebles` | ○ ISR 6 h | Catálogo. Los filtros de la URL (`?q=`, `?tipo=`…) los aplica el navegador; esas variantes llevan `X-Robots-Tag: noindex`. |
| `/inmuebles/[slug]` | ● ISR 6 h | Ficha. Se resuelve desde el inventario cacheado: un slug inexistente no consulta Supabase. |
| `/inmuebles/sector/[sector]` | ● ISR 6 h | Páginas de sector (indexables con 2 o más inmuebles). |
| `/comparar`, `/favoritos` | ○ ISR 6 h | La selección vive en el navegador. |
| `/publica/agente` | ○ ISR 6 h | Planes y precios para agentes. |
| `/publica/agente/pago`, `/publica/agente/renovar` | ƒ | Retorno de Wompi y renovación desde el correo; `noindex`. |
| `/contacto`, `/vender`, `/publica`, `/publica/condiciones`, `/privacidad` | ○ | Estáticas. |
| `/sitemap.xml` | ○ ISR 6 h | |
| `/robots.txt`, `/llms.txt`, iconos | ○ | |
| `/admin/**` | ƒ | Panel: inicio, inmuebles (+ importar de Drive), leads, CRM, agenda, plantillas, vigencias, reportes, datos, conexiones. `force-dynamic`. |
| `/api/admin/export/[dataset]` | ƒ | Descarga CSV para el panel (exige sesión). |
| `/api/pagos/wompi` | ƒ | `POST` del checkout: emite y registra la referencia del pago, con el monto tomado de `plans.ts`, y devuelve la firma de integridad para el widget. |
| `/api/pagos/wompi/webhook` | ƒ | Eventos de Wompi; verifica firma y consulta la API de Wompi como fuente de verdad. Sin Supabase responde 503. |
| `/api/pagos/wompi/estado` | ƒ | Estado de una transacción para la pantalla de retorno. |
| `/api/pagos/wompi/reconciliar` | ƒ | Cron (ver 5). |
| `/api/cron/sync`, `/api/cron/crm-diario` | ƒ | Crons (ver 5). |
| `/api/salud` | ƒ | Salud para el monitor externo (ver 6). |

`src/proxy.ts` (el antiguo middleware) protege `/admin/:path*`: sin cookie de sesión válida redirige
a `/admin/login`. Las acciones de servidor del panel llaman además a `exigirAdmin()` en su primera
línea, porque una acción se puede invocar desde cualquier página.

---

## 3. Capas del código

```
src/
├─ app/              rutas: (public)/, admin/, api/, sitemap, robots, llms.txt
├─ components/       ui/, public/, admin/, seo/, brand/
├─ proxy.ts          protección de /admin
└─ lib/
   ├─ actions/       acciones de servidor (formularios públicos y del panel)
   ├─ auth/          sesión firmada del panel y autorización de crons
   ├─ config/        sitio (URL, contacto fijos), planes y precios
   ├─ domain/        tipos y reglas del negocio (Property, Lead, Agent, ...)
   ├─ data/          repositorio (Supabase o memoria), caché del inventario
   ├─ crm/           CRM interno (contactos, captaciones, búsquedas, cierres)
   ├─ pagos/         registro y verificación de pagos de Wompi
   ├─ servicios/     vigencias de los planes pagados
   ├─ services/      importación desde Drive
   ├─ integrations/  Drive, Sheets, Wompi, Cloudinary, autenticación de Google
   ├─ notifications/ correos (Resend)
   ├─ salud/         latidos de los crons
   ├─ search/        búsqueda en lenguaje natural del catálogo (determinista)
   ├─ seo/, ficha/, export/, leads/, cliente/, utils/
```

**Repositorio y stores.** La UI y las acciones hablan con interfaces, no con la base:
`src/lib/data/repository.ts` (inmuebles, leads, agentes, citas, plantillas), y los stores de CRM,
servicios y pagos. Cada uno tiene una implementación Supabase y otra en memoria con datos de
ejemplo. La regla de cuál usar está en `src/lib/data/elegir-implementacion.ts`: con
`NEXT_PUBLIC_SUPABASE_URL` y `SUPABASE_SERVICE_ROLE_KEY`, Supabase; sin ellas, memoria; y en
producción sin ellas **lanza** (no muestra inmuebles falsos ni guarda leads en RAM). Hoy la usa el
repositorio principal; los stores de CRM y servicios todavía eligen por su cuenta (caen a memoria).

**Consultas.** El repositorio pide columnas explícitas (`src/lib/data/supabase/filas.ts`, con los
tipos de fila escritos a mano); la lectura pública no trae al servidor propietario, dirección,
notas internas ni carpeta de Drive. Reemplazar las fotos de un inmueble o las franjas de un agente
usa las funciones `reemplazar_medios` / `fijar_disponibilidad` (migración 0014, una transacción);
si la base aún no las tiene, inserta primero y borra después, revisando cada error.

**Caché del inventario.** `src/lib/data/public-inventory.ts`: una sola lectura de Supabase con
`unstable_cache` (etiqueta `inventario`, 6 h) que comparten portada, catálogo, fichas, sectores,
comparar, favoritos y sitemap. Toda ruta que crea, edita, publica o borra un inmueble llama a
`invalidarInventario()` / `revalidarCatalogoPublico()` (`inventario-tag.ts`). Editar filas
directamente en Supabase tarda hasta 6 h en verse.

**Panel.** Sesión de un solo administrador: cookie firmada con HMAC (`ADMIN_SESSION_SECRET`) que
incluye la huella de `ADMIN_PASSWORD` (cambiar la clave cierra todas las sesiones). En producción,
si falta cualquiera de las tres variables `ADMIN_*`, el panel queda cerrado. En local, lo que falte
se genera al azar en memoria (`src/lib/auth/session.ts`). No hay Supabase Auth ni roles.

---

## 4. Modelo de datos

Esquema en `supabase/migrations/`, aplicado a mano en el SQL Editor. Qué hace cada migración y cómo
comprobar si está aplicada: **`supabase/README.md`**.

| Migración | Tablas que crea (o lo que cambia) |
|---|---|
| 0001 | `properties`, `property_media`, `agents`, `agent_availability`, `leads`, `appointments`, `templates` |
| 0002 | columnas del modelo de solo venta en `properties` |
| 0003 | `pagos_referencias`, `pagos_eventos`, `pagos_avisos`; función `pagos_purgar_raw()` |
| 0004 | `servicios_publicacion`, `servicios_renovaciones` |
| 0005 | RLS en las tablas que faltaban; fuera la inserción pública de leads |
| 0006 | estado `descartado` en `servicios_publicacion` |
| 0007 | `contactos`, `captaciones`, `busquedas`, `busqueda_inmuebles`, `actividades` |
| 0008 | `servicios_periodos`; llaves `leads.contacto_id`, `servicios_publicacion.contacto_id` / `property_id` / `reference` |
| 0009 | `latidos`; la llave anónima solo lee columnas públicas de inmuebles |
| 0010 | `cierres`; próximo contacto en `contactos` |
| 0014 | `migraciones_aplicadas`; funciones `reemplazar_medios`, `fijar_disponibilidad`; índices en llaves foráneas |

Seguridad: RLS activa en todas las tablas. Las de 0003 en adelante no tienen políticas (solo la
llave de servicio las toca). De 0001 siguen dos políticas de lectura pública (inmuebles y fotos
publicados) que usa el chatbot con la llave anónima; desde 0009 esa llave solo ve las columnas
públicas de `properties` y no puede escribir nada.

Datos personales (Ley 1581 de 2012): el payload crudo de los pagos se purga a las 72 h; los
correos de alerta y los logs no llevan correos ni nombres.

---

## 5. Procesos automáticos (Vercel Cron)

Definidos en `vercel.json`. En Hobby cada cron corre **una vez al día** y Vercel puede desplazarlo
hasta ±59 min. Los tres exigen `Authorization: Bearer <CRON_SECRET>` (`src/lib/auth/cron.ts`) y
dejan su latido en la tabla `latidos`.

| Hora (UTC) | Ruta | Qué hace | Latido |
|---|---|---|---|
| 06:00 | `/api/cron/sync` | Importa de Drive las carpetas nuevas (como borrador) y refleja el catálogo en Sheets: lee la hoja y solo escribe si algo cambió; al escribir, primero el bloque nuevo y luego limpia las filas sobrantes. | `cron-sync` |
| 06:30 | `/api/pagos/wompi/reconciliar` | Concilia transacciones pendientes contra la API de Wompi, purga payloads de más de 72 h y revisa vigencias (avisos de 7 días, 1 día y vencido). | `cron-diario` |
| 12:00 | `/api/cron/crm-diario` | Resumen por correo de los contactos con próximo contacto para hoy o vencido (7:00 en Bogotá). | `cron-crm` |

Si una tarea falla, se avisa a `PAGOS_ALERT_EMAIL` por Resend, sin datos personales.

---

## 6. Salud y respaldos

- **`/api/salud`** responde 200 si la base contesta y ningún proceso está atrasado (más de 27 h sin
  corrida buena) ni con un fallo posterior a su última corrida buena; si no, 503. Un proceso sin
  dato todavía (o la tabla sin crear) no cuenta como fallo. No devuelve datos de nadie, solo el
  estado de cada proceso. `Cache-Control: no-store`. No pide secreto.
- **Repositorio privado `cic-inmuebles-operacion`** (GitHub Actions, gratis):
  - *Vigilancia* cada 3 h: comprueba que la portada responde y que `/api/salud` da 200; una vez al
    día hace además una consulta mínima directa a la base, independiente de Vercel (evita la pausa
    de Supabase Free a los 7 días sin actividad aunque el sitio esté caído). Si falla, GitHub avisa
    por correo al dueño del repositorio.
  - *Respaldo semanal* (domingos 03:00 de Bogotá, o a mano): volcado de la base, cifrado, guardado
    como artefacto. Supabase Free no tiene copias automáticas: esta es la única. Restaurar está en
    el README de ese repositorio.
- **CI** (`.github/workflows/ci.yml`): lint, tipos, pruebas (TZ=UTC), build y auditoría de
  dependencias de producción en cada push y PR a `main`, sin secretos. Dependabot propone
  actualizaciones cada semana.

Los logs de Vercel Hobby duran 1 hora: lo que importa debe quedar en `latidos`, en el correo de
alerta o en el monitor externo.

---

## 7. Límites gratuitos que condicionan el diseño

- **Vercel Hobby**: uso no comercial según sus términos (riesgo aceptado). Hasta 100 crons por
  proyecto, cada uno una vez al día; 5.000 transformaciones de imagen al mes (no se usan: loader
  propio); 1 sola regla de límite de tasa en el Firewall. Detalle y medidores: `docs/USO-VERCEL.md`.
- **Supabase Free**: 500 MB de base, 5 GB de egreso, sin copias, pausa tras 7 días sin actividad.
- **Resend**: 100 correos al día, 3.000 al mes.
- **Google**: la cuenta de servicio sobre un Gmail normal puede leer Drive, crear carpetas y escribir
  en Sheets, pero **no subir archivos** a Drive (no tiene cuota). Por eso la ficha
  `especificaciones.md` la sube el equipo, y el registro es la base más la hoja.

Todas las variables de entorno, con lo que pasa si faltan: `README.md` y `.env.example`.
