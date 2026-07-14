# Auditoría SEO Técnica — CIC Inmuebles

Sitio: cicinmuebles.com (inmobiliaria, solo venta, Colombia) · Next.js 16 App Router · ~11 URLs
Fuentes: espejo local `http://localhost:3110` (curl), código fuente `/home/user/cic_inmuebles_web`,
ficha real de producción `/inmuebles/bella-suiza` (archivo `prod-ficha-bella-suiza.txt` provisto).

**Puntuación técnica: 62/100**

---

## Critical

### 1. `x-robots-tag: noindex` en una ficha real de producción (página de producto)
La respuesta real de producción para `/inmuebles/bella-suiza` (la página de detalle de un
inmueble — la unidad de contenido más importante del sitio para SEO) incluye la cabecera
HTTP `x-robots-tag: noindex`. Esto le indica a Google que **no indexe esa URL**, sin importar
lo que diga el `<head>` (no hay meta robots en el HTML: confirmado con
`grep -o '<meta[^>]*robots[^>]*>' ficha_raw.html` → sin resultados). Si esta cabecera está
presente en el dominio de producción real (`cicinmuebles.com`), todas las fichas de inmuebles
podrían estar bloqueadas de los resultados de búsqueda.

**Evidencia:**
- Archivo: `prod-ficha-bella-suiza.txt` (headers JSON), líneas de cabeceras:
  `"x-robots-tag": "noindex"`, `"x-matched-path": "/inmuebles/bella-suiza"`,
  `"server": "Vercel"`, `"access-control-allow-origin": "*"`.
- Búsqueda en el código fuente: `grep -rn "x-robots-tag\|noindex" src/` → **sin coincidencias**
  fuera de `src/app/admin/login/page.tsx:11` (`robots: { index: false }`, correcto y
  esperado ahí). Es decir, el noindex de la ficha **no lo genera la app** — es inyectado en
  la capa de plataforma (Vercel).
- `next.config.ts` no define `headers()`, confirmando que no es Next.js quien lo añade.

**Hipótesis más probable (a verificar):** el dominio `cicinmuebles.com` fue conectado
"recién" al proyecto en Vercel (según contexto de esta auditoría). Vercel inyecta
automáticamente `X-Robots-Tag: noindex` y `Access-Control-Allow-Origin: *` en:
(a) deployments de Preview, o (b) dominios que aún no están promovidos/asignados como
dominio de **Production** dentro del proyecto. La combinación de ambas cabeceras en esta
respuesta es la huella típica de ese comportamiento.

**Recomendación:**
1. En Vercel → Project Settings → Domains, confirmar que `cicinmuebles.com` y
   `www.cicinmuebles.com` están asignados al **Production Environment** (no Preview) y
   apuntan al último deployment de la rama de producción.
   `mcp__Vercel__get_project` / `list_deployments` — no disponible en este sandbox (sin red
   externa) — usar en un entorno con acceso).
2. Revisar Deployment Protection / Vercel Authentication del proyecto: si está activa para
   el dominio custom, puede forzar cabeceras de no-indexación.
3. Tras corregir, re-verificar con `curl -sI https://cicinmuebles.com/inmuebles/bella-suiza`
   (y 2-3 fichas más) confirmando ausencia de `x-robots-tag`.
4. Priorizar: cada día con esta cabecera activa es contenido de producto invisible para
   Google en un sitio de solo ~11 URLs indexables.

---

## High

### 2. Consolidación www vs apex sin redirección verificable
`www.cicinmuebles.com` y `cicinmuebles.com` fueron conectados juntos en Vercel. El código
fija el canónico en el ápex (`https://cicinmuebles.com`, sin `www`) en
`src/lib/config/site.ts:12`, y todos los `alternates.canonical`, `metadataBase`, JSON-LD y
sitemap usan ese valor. Sin embargo, **no existe ningún mecanismo en el código** (ni
`next.config.ts` `redirects()`, ni `middleware.ts` en `src/`) que fuerce una redirección
301 de `www` → ápex (o viceversa). Este comportamiento depende enteramente de la
configuración de dominios en el dashboard de Vercel, que no se puede verificar desde este
sandbox (sin red externa).

**Evidencia:**
- `src/lib/config/site.ts:9-12`: `siteUrl` fijo a `https://cicinmuebles.com` (comentario del
  propio código explica que evitan `VERCEL_PROJECT_PRODUCTION_URL` precisamente por el bug de
  `specifinance.com`).
- `grep -rn "redirects" next.config.ts` → sin resultados.
- `find . -iname "middleware.ts"` (excluyendo `.next/` y `node_modules/`) → sin resultados;
  no hay middleware de la app que gestione host.

**Riesgo:** si ambos hosts sirven contenido idéntico sin 301, Google puede indexar URLs
duplicadas bajo ambos dominios, diluyendo señales de enlazado y confundiendo el canonical
elegido en casos límite.

**Recomendación:** en Vercel → Domains, configurar `www.cicinmuebles.com` con "Redirect to"
→ `cicinmuebles.com` (301), consistente con el canónico ya fijado en el código.

---

## Medium

### 3. Paginación de `/inmuebles` sin señales dedicadas (canonical estático, sin rel=next/prev)
`src/app/(public)/inmuebles/page.tsx:22` define `alternates: { canonical: "/inmuebles" }`
como metadata **estática** del módulo — se aplica igual a `/inmuebles`, `/inmuebles?page=2`,
`/inmuebles?tipo=casa`, etc. (confirmado: `curl -sI "http://localhost:3110/inmuebles?page=2"`
devuelve 200 sin variar metadata). Esto es correcto para evitar indexar combinaciones de
filtros (bueno contra index bloat), pero también canoniza páginas 2+ de la paginación pura
hacia la página 1, y no hay `rel="next"/"prev"` ni `<title>` diferenciado por página. Como
el sitemap ya expone cada ficha de inmueble de forma directa, el impacto real es bajo, pero
las páginas 2+ del listado nunca se posicionarán como entidades propias.

**Recomendación:** si el catálogo crece más allá de una página, generar
`alternates.canonical` dinámico por página (`/inmuebles?page=N` autorreferenciado) y título
`Inmuebles en venta — página N`, manteniendo el canonical estático únicamente para
combinaciones de filtros no paginadas.

### 4. Cabeceras de seguridad ausentes (CSP, X-Content-Type-Options, Referrer-Policy, Permissions-Policy)
`next.config.ts` no define `headers()`. Confirmado en cabeceras reales de producción:
solo `strict-transport-security` está presente (`max-age=63072000; includeSubDomains;
preload`, correcto). Faltan `Content-Security-Policy`, `X-Content-Type-Options`,
`Referrer-Policy` y `Permissions-Policy`. No es un factor de ranking directo, pero afecta
puntuación de "Best Practices" en Lighthouse/PageSpeed y es higiene técnica esperable en
un sitio con formularios de contacto (captura de leads).

**Recomendación:** añadir `headers()` en `next.config.ts` con al menos
`X-Content-Type-Options: nosniff`, `Referrer-Policy: strict-origin-when-cross-origin`, y
una CSP básica (permitiendo Cloudinary, YouTube embeds, Google Fonts si aplica).

---

## Low

### 5. Mismatch cosmético canonical vs sitemap en el home (barra final)
El sitemap (`src/app/sitemap.ts:19`) lista el home como `https://cicinmuebles.com/` (con
barra final), mientras el canonical renderizado en `/` es `https://cicinmuebles.com` (sin
barra final) — confirmado con
`grep -o 'rel="canonical"[^/]*/>' home.html` → `href="https://cicinmuebles.com"`, generado
desde `src/app/(public)/page.tsx:29` (`alternates: { canonical: "/" }` resuelto contra
`metadataBase`). Google normalmente trata ambas formas como la misma URL raíz, pero lo ideal
es que coincidan exactamente.

**Recomendación:** ajustar `sitemap.ts` para usar `${base}/` solo donde el propio
`siteConfig.url` no termine ya en barra (ya es así), o alinear ambos a la misma forma
canónica explícita.

### 6. `lang="es"` genérico en vez de `es-CO`
`src/app/layout.tsx` usa `<html lang="es">`. Como el negocio es exclusivamente colombiano
(ver `siteConfig.city: "Colombia"`, `areaServed: Country CO` en el schema), un `lang="es-CO"`
reforzaría (marginalmente) la señal de mercado local. No aplica hreflang porque el sitio no
tiene variantes de idioma/región — correcto no implementarlo (evitar sobre-ingeniería).

### 7. IndexNow no implementado
No se encontró integración de IndexNow (`grep -rn "indexnow" -i .` sin resultados). Opcional
para acelerar indexación en Bing/Yandex; de baja prioridad dado que el mercado objetivo usa
mayoritariamente Google, pero es una mejora barata de implementar (webhook al publicar/editar
un inmueble).

---

## Info / Pass (verificado, sin acción)

- **Rastreo/SSR:** Todo el HTML es 100% server-rendered (confirmado en home, inmuebles,
  vender, contacto y en la ficha de producción); JSON-LD, título, meta description y
  canonical viajan en el HTML inicial, no inyectados por JS — cumple la guía de Google de
  diciembre 2025 sobre robots/canonical en el HTML crudo.
- **robots.txt:** válido, permite `/` y bloquea `/admin`; referencia el sitemap con URL
  absoluta correcta (`Sitemap: https://cicinmuebles.com/sitemap.xml`).
  Fuente: `src/app/robots.ts`.
- **Trailing slash:** consistente — `/inmuebles/` y `/vender/` devuelven `308 Permanent
  Redirect` hacia la forma sin barra (default de Next 16 sin `trailingSlash` configurado).
- **404:** devuelve `HTTP 404` real (no soft-404) con `<meta name="robots" content="noindex"/>`
  en el HTML, mensaje en español y CTAs de recuperación (inicio / catálogo).
- **Viewport móvil:** `<meta name="viewport" content="width=device-width, initial-scale=1"/>`
  presente en todas las páginas verificadas.
- **Admin panel:** bloqueado en `robots.txt` (`Disallow: /admin`) y además con
  `robots: { index:false, follow:false }` en `/admin/login` (defensa en profundidad);
  `/admin` sin sesión responde `307` a `/admin/login`.
- **Datos estructurados:** `WebSite` (global), `RealEstateAgent` (home), `Offer` +
  `BreadcrumbList` (ficha de inmueble), `ItemList` (catálogo) — presentes en SSR.
- **Fuentes e imágenes:** `next/font/google` autoalojadas (sin bloqueo por fuentes externas);
  imágenes vía `next/image` + Cloudinary con `srcset` responsivo (`imageSrcSet` con 8
  anchos) — buena base para LCP/CLS, aunque no se pudo medir CWV real (sin PageSpeed API).
- **HSTS:** `max-age=63072000; includeSubDomains; preload` — sólido, ya en la lista de
  preload de facto por su configuración.
- **Sitemap de producción (nota histórica, ya resuelta):** un build previo a las 09:25
  generó URLs con `https://specifinance.com` (dominio ajeno capturado vía
  `VERCEL_PROJECT_PRODUCTION_URL`). Ya corregido en `src/lib/config/site.ts` (fija
  `https://cicinmuebles.com` explícitamente) — **no reabrir**, solo confirmar que el próximo
  deploy a producción regenera sitemap/canonicals sin ese dominio.
