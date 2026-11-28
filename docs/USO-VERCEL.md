# Uso de Vercel (plan Hobby): causas, cambios y cómo confirmar la mejora

Proyecto `cic-inmuebles-web` (Next.js 16, Vercel Hobby). El aviso de «límite de uso alcanzado» no viene de los
despliegues (19 en 3 semanas; el tope Hobby es 100 al día) sino del **consumo en ejecución**. Los medidores de
uso no se pueden leer por API: se revisan a mano en el panel (ver «Cómo leer los medidores»).

Límites Hobby de referencia (confirmar en vercel.com/docs/limits y vercel.com/pricing, cambian): ~1 M invocaciones
de función/mes, ~1 M solicitudes edge, ~100 GB de transferencia rápida, ~4 h de CPU activa, 360 GB-h de memoria,
~1 M lecturas y ~200 k escrituras ISR, 5.000 transformaciones de imagen al mes (CIC no las usa: loader propio),
hasta 100 crons por proyecto, cada uno **una vez al día** (Vercel puede correrlo hasta ±59 min de su hora), y en el
Firewall **una sola regla de límite de tasa**.

## Causas probables (de mayor a menor)

1. **`/inmuebles` era dinámica** (leía `searchParams`): cada visita, rastreo de bot o URL distinta con `?q=` ejecutaba
   una función que leía TODA la tabla de Supabase y renderizaba en el servidor. Era la ruta pública más visitada.
2. **Sin caché compartida del inventario**: `cache()` de React solo vale dentro de una petición. Cada regeneración
   de home, fichas, sectores, comparar, favoritos y sitemap hacía su propia consulta completa.
3. **Rastreo**: robots.txt solo bloqueaba `/admin`; los bots podían recorrer un espacio casi infinito de
   `/inmuebles?…` (cada uno, una invocación) y `/api`.
4. **Regeneraciones frecuentes**: `/comparar` y `/favoritos` cada 5 min, fichas/home/sectores cada hora.
5. **Prefetch** automático a rutas caras (`/admin/login` desde el pie de página, fichas desde cada tarjeta).
6. **`/publica/agente` dinámica** (planes y precios, alta visibilidad) y **seguimiento del pago** con
   `router.refresh()` cada 30 s (re-render completo en el servidor).
7. Fuera del código: tráfico de bots/scrapers sin Firewall (no hay reglas configuradas). No medible desde el repo.

Los tres crons (06:00, 06:30 y 12:00 UTC, ver `vercel.json`) corren una vez al día cada uno, como exige Hobby, y
suman ~90 invocaciones/mes: no son la causa. Hay margen para más (el tope es 100 por proyecto), pero ninguno puede
correr más de una vez al día.

## Qué se cambió (rama `optimizar-uso-vercel`)

| Tema | Cambio | Archivos |
| --- | --- | --- |
| Caché del inventario | `unstable_cache` con etiqueta `inventario` y vigencia de 6 h; una sola consulta compartida. `invalidarInventario()` (`revalidateTag`) en toda ruta que publica/edita/borra/cambia vigencias. `listPublic` filtra `publicado` en la consulta. | `src/lib/data/public-inventory.ts`, `src/lib/data/inventario-tag.ts`, `src/lib/actions/admin-properties.ts`, `admin-drive.ts`, `src/lib/servicios/ficha.ts`, `supabase-repository.ts` |
| Fichas | Se resuelven desde el inventario cacheado: un slug inexistente ya no consulta Supabase. | `src/app/(public)/inmuebles/[slug]/page.tsx` |
| `/inmuebles` | Estática (ISR 6 h). Los filtros de la URL (`?q=`, etc.) los aplica el navegador tras hidratar. JSON-LD del catálogo completo. | `src/app/(public)/inmuebles/page.tsx`, `src/components/public/catalogo.tsx` |
| `/publica/agente` | Estática. Retorno de Wompi en `/publica/agente/pago` y renovación en `/publica/agente/renovar` (dinámicas, noindex). Enlaces antiguos redirigidos en `next.config.ts`. | `src/app/(public)/publica/agente/**`, `src/app/api/pagos/wompi/route.ts`, `src/lib/servicios/correos.ts` |
| Pagos | `AutoActualizar` consulta `/api/pagos/wompi/estado` (30 s, luego 60 s) y repinta una vez al terminar; el seguimiento del checkout no consulta con la pestaña oculta y baja el ritmo (5/15/45 s). | `src/components/public/auto-actualizar.tsx`, `checkout-utils.ts`, `plan-checkout.tsx` |
| Rastreo | `robots.ts`: Disallow de `/api/`, `/comparar`, `/favoritos`, `/inmuebles?*`, retorno de pago; `Crawl-delay` 10 para bots de IA. `X-Robots-Tag: noindex` en `/inmuebles` con parámetros. | `src/app/robots.ts`, `next.config.ts` |
| Prefetch | `prefetch={false}` en el enlace a `/admin/login`, tarjetas y sugerencias del buscador. | `site-footer.tsx`, `tarjeta-inmueble.tsx`, `hero-buscador.tsx` |
| Cabeceras | `Cache-Control` de 1 día para `/og.jpg` y `/llms.txt`. | `next.config.ts` |
| Revalidación | Home, catálogo, fichas, sectores, comparar, favoritos, planes y sitemap: 6 h (antes 5 min / 1 h / dinámica). El panel invalida al instante. | `revalidate` de cada página |

Importante para el equipo: tras editar inmuebles **desde el panel o el flujo de vigencias** el sitio se actualiza
al instante. Si se editan filas directamente en Supabase, el sitio público tarda hasta 6 h en reflejarlo (o se
guarda el inmueble desde el panel para forzarlo).

### Tabla de rutas (`pnpm build`)

Antes: `/inmuebles` ƒ (dinámica), `/publica/agente` ƒ, `/comparar` y `/favoritos` ISR 5 min, resto ISR 1 h.
Después: `/inmuebles` ○ ISR 6 h, `/publica/agente` ○ ISR 6 h, `/publica/agente/pago` y `/renovar` ƒ (solo se usan al
pagar o renovar), `/comparar`, `/favoritos`, home, fichas, sectores y sitemap ISR 6 h.

### Lo que NO se cambió (y por qué)

- `dynamicParams = false` en fichas: una ficha publicada después del build daría 404 hasta un redeploy.
- Sheets en el cron: sigue corriendo a diario como garantía de que las ediciones del panel llegan a la hoja, pero
  desde noviembre de 2026 primero lee la hoja y solo escribe si algo cambió (el día normal es una sola lectura).
- Límite por IP en `/api/pagos/*`: se resuelve en el Firewall (abajo), no en código. Hobby admite **una sola regla
  de límite de tasa**, así que debe cubrir las rutas que más importan (p. ej. `/api/pagos/wompi` y el formulario de
  leads) con una sola condición.

## Cómo leer los medidores (vercel.com → Usage)

1. vercel.com → tu equipo (avatar, arriba izquierda) → pestaña **Usage** (o Settings → Billing → Usage).
2. Elige el periodo «Last 30 days» y revisa, en este orden: **Function Invocations**, **Fluid Active CPU**,
   **Fast Data Transfer**, **Edge Requests**, **ISR Reads / ISR Writes**.
3. Haz clic en cada medidor para ver el desglose por proyecto y, cuando está disponible, por ruta.
4. Proyecto `cic-inmuebles-web` → **Observability** → **Vercel Functions**: ordena por invocaciones para ver las rutas
   que más ejecutan; en **Edge Requests** revisa «Top Paths» y los user-agents/bots.
5. Logs de runtime: en Hobby solo se retiene 1 hora; para ver tráfico de bots usa Observability, no los logs.

## Cómo confirmar la mejora

1. Despliega (merge a `main` o promoción del preview) y anota la fecha/hora.
2. Verifica con `curl -sI https://www.cicinmuebles.com/inmuebles`: debe traer `Cache-Control: s-maxage=21600…` y
   `x-vercel-cache: HIT` a partir de la segunda petición (antes era `private, no-cache, no-store`).
   `curl -sI "https://www.cicinmuebles.com/inmuebles?q=casa"` debe traer `X-Robots-Tag: noindex, follow`.
3. Tras 24–48 h compara en Usage: **Function Invocations** y **Fluid Active CPU** por día deben caer de forma visible
   (el tráfico a `/inmuebles` y `/publica/agente` ya no ejecuta funciones); **ISR Writes** debe bajar al dejar de
   regenerar comparar/favoritos cada 5 min.
4. En Observability → Vercel Functions, `/inmuebles` y `/publica/agente` ya no deben aparecer entre las rutas más ejecutadas.
5. Prueba de negocio tras desplegar: publicar/editar un inmueble en el panel y comprobar que home, `/inmuebles`, su
   ficha y el sector cambian de inmediato; abrir un enlace `/inmuebles?q=apartamento` y ver los filtros aplicados.
6. Pago: en el sandbox de Wompi, pagar un plan y comprobar que vuelve a `/publica/agente/pago?ref=…&id=…`.

## Pasos solo en el panel de Vercel

Ver el resumen entregado con el cambio (Firewall/Bot Protection, la regla de límite de tasa —una sola en Hobby—,
Spend Management y Observability). Reglas clave: no aplicar challenge ni bloqueo a `/api/pagos/wompi/webhook`, a
`/api/cron/*`, a `/api/pagos/wompi/reconciliar` ni a `/api/salud` (lo consulta el monitor externo).
