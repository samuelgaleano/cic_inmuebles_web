# Rendimiento / Core Web Vitals — CIC Inmuebles

**Método**: análisis ESTÁTICO sobre el espejo local (`http://localhost:3110`, `curl -s` + inspección del código fuente en `/home/user/cic_inmuebles_web`). No se usó Lighthouse/PageSpeed/CrUX (sin navegador ni API en este sandbox) y **no se inventó ningún número de laboratorio** (LCP/INP/CLS en segundos). Todo lo cuantitativo abajo son bytes/recuentos verificados con `curl`, `wc -c`, `gzip` y lectura de `.next/static/chunks`. Donde no se pudo medir, se indica explícitamente y se recomienda validar con PageSpeed Insights / CrUX cuando el dominio esté indexado.

## Puntuación: 74/100

---

## Evidencia recopilada

### Peso de página (medido con `curl -H "Accept-Encoding: gzip"`, recursos referenciados en el `<head>`/body de cada HTML)

| Página | HTML (gzip) | Recursos referenciados (JS+CSS+fuentes+hero, gzip real) |
|---|---|---|
| `/` (home) | 13.8 KB | **625 KB** (incluye hero.jpg 324 KB sin comprimir más, ya es JPEG) |
| `/inmuebles` | 15.3 KB | 223 KB (sin hero, catálogo vacío en este espejo — ver limitación) |
| `/vender` | 10.2 KB | 294 KB |
| `/contacto` | 8.6 KB | 294 KB |

Home es la más pesada por el hero.jpg (1920×1280, JPEG progresivo, 324.057 bytes = **~52% del peso total de la página**).

JS compartido de la app (`.next/static/chunks`, build de producción real): 23 archivos, **916 KB sin comprimir**; el JS que carga home específicamente son 13 chunks = 696 KB sin comprimir / **210.7 KB gzip** (medido con `gzip -c`).

### LCP — candidatos por página
- **Home**: hero (`background-image: url(/hero.jpg)` en `hero-pov.tsx`) con `<link rel="preload" as="image" fetchPriority="high">` correctamente emitido en el `<head>` (verificado en el HTML servido) + `react-dom/preload()` desde el componente. Orden de carga en `<head>` es correcto: preloads de fuente → preload hero (`fetchPriority=high`) → CSS → preload script de baja prioridad. **Bien resuelto.**
- **Ficha de inmueble** (`/inmuebles/[slug]`): imagen principal de `PropertyGallery` usa `priority` en `SafeImage`/`next/image` (`src/components/public/property-gallery.tsx:89`) — correcto. Pero esa imagen se sirve directo desde Cloudinary/Drive (sin optimizador de Vercel, por diseño) y **no hay `preconnect`** a esos orígenes (ver hallazgo 4).
- **Listado `/inmuebles` y tarjetas de home**: cover de cada propiedad vía `FramedPhoto` (sin `priority`), razonable ya que están below-the-fold o no son el elemento de mayor contenido de esa vista.

### CLS — riesgos revisados
- Tarjetas de portafolio: contenedor `Link` con clase `aspect-[4/3]` fija (`portfolio-expand.tsx:47`) — el tamaño de caja no depende de si la imagen cargó. **Sin riesgo de CLS.**
- Galería de ficha: contenedor `aspect-[4/3] sm:aspect-[3/2]` fijo (`property-gallery.tsx:63`). **Sin riesgo.**
- Fuentes: `next/font/google` (Sora, Plus Jakarta Sans, Geist Mono) — CSS generado confirma **`font-display: swap` en las 18 declaraciones** de `@font-face` propias (21 en total, contando una `var()`), y las 3 fuentes tienen `<link rel="preload" as="font">` en home. **Mitiga bien el FOIT/CLS por fuentes.**
- Animaciones de entrada (`Reveal`, `.animate-rise` en `globals.css`) solo tocan `opacity`, `transform`, `filter` — no producen reflow. Respetan `prefers-reduced-motion`. **Sin riesgo de CLS.**

### INP — handlers revisados
- `hero-pov.tsx`: listener de `scroll`/`resize` con `{ passive: true }` + `requestAnimationFrame` + `cancelAnimationFrame` antes de reprogramar — patrón correcto, evita long tasks por scroll.
- `property-gallery.tsx`: `onMouseMove` para el zoom de producto solo escribe `style.transform`/`transformOrigin` (composición GPU), sin recalcular layout.
- `reveal.tsx`: usa `IntersectionObserver` (no listener de scroll) para las animaciones de aparición.
- Tamaño de DOM: ~343 nodos en home, ~285 en `/inmuebles` (conteo de etiquetas de apertura en el HTML) — muy por debajo del umbral de preocupación (1.500).
- No se detectaron scripts de terceros (analytics/GTM/Meta Pixel/chat) que puedan secuestrar el hilo principal.

### Render-blocking
- Único `<link rel="stylesheet">` (Tailwind v4 compilado): 83.7 KB sin comprimir / **14.1 KB gzip** — bloqueante por naturaleza pero de bajo costo real.
- Todos los `<script src>` del bundle llevan `async` (13 de 13 en home). No hay `<script>` síncrono bloqueante en el `<head>`.

### Caché
- `/_next/static/*` → `Cache-Control: public, max-age=31536000, immutable` (ya conocido, no se repite como hallazgo).
- `/hero.jpg` (activo plano en `public/`, sin fingerprint de contenido) → medido en el espejo local: **`Cache-Control: public, max-age=0`**. A diferencia de los chunks de `_next/static`, los archivos servidos tal cual desde `public/` no llevan hash en el nombre, así que Vercel no puede aplicarles `immutable` de forma segura por defecto.

---

## Hallazgos (priorizados)

1. **Hero sin variantes responsive ni formato moderno** — `hero.jpg` es un único JPEG progresivo de 1920×1280 (324 KB) sin AVIF/WebP ni tamaño reducido para móvil; se sirve como `background-image` CSS (decisión conocida) con `preload`+`fetchPriority=high` ya bien resueltos, pero todo dispositivo descarga el mismo archivo de escritorio. Al ser un asset estático propio (no pasa por el loader de Cloudinary/Drive), sí se puede pre-optimizar en build sin tocar la decisión de coste cero del catálogo: generar una copia AVIF/WebP y una versión más pequeña para viewports móviles (`image-set()` o variante por media query en el CSS del hero).

2. **`Cache-Control: public, max-age=0` en `hero.jpg`** (verificado en el espejo local) — a diferencia de `/_next/static` (immutable, ya sabido), los archivos planos de `public/` no están fingerprinted. No se pudo confirmar el comportamiento real en Vercel producción desde este sandbox; recomendamos verificarlo y, si aplica, versionar el nombre del archivo (`hero.v2.jpg`) para poder usar cache larga + `immutable`, o al menos un `max-age` razonable vía `headers()` en `next.config.ts`.

3. **Doble descarga de imagen por cada foto de inmueble** — `FramedPhoto` (tarjetas, `framed-photo.tsx`) y `PropertyGallery` (ficha, `property-gallery.tsx:65-92`) renderizan **dos** `<SafeImage>` por foto: una copia de fondo `blur-2xl object-cover` y la foto nítida `object-contain`. Es un patrón de diseño intencional (evita recortes en fotos verticales), pero duplica peticiones/bytes de imagen en todo el sitio: un portafolio de 12 tarjetas en home implica hasta 24 descargas de imagen si todas tienen `cover`.

4. **Sin `preconnect`/`dns-prefetch` hacia los CDNs de imágenes de terceros** — `next.config.ts` declara `remotePatterns` para `res.cloudinary.com`, `lh3.googleusercontent.com`, `drive.google.com`, `i.ytimg.com`, `img.youtube.com`, `images.unsplash.com`, pero no se encontró ningún `<link rel="preconnect">` en el `<head>` (verificado en el HTML). Como las fotos de propiedades se sirven directo desde esos orígenes (sin el optimizador de Vercel, por diseño de coste cero), la imagen `priority` de la galería de ficha —candidata a LCP en esa página— paga el handshake DNS+TLS completo sin poder adelantarlo.

5. **Video de YouTube embebido sin lazy-loading ni "facade"** — en la ficha de inmueble (`inmuebles/[slug]/page.tsx:178-184`), cuando hay `videoId` se inserta un `<iframe src="youtube.com/embed/...">` sin `loading="lazy"` y sin patrón de miniatura-diferida (lite-embed). Esto descarga JS/CSS de YouTube aunque el usuario nunca reproduzca el video, sumando peso y riesgo de coste en el hilo principal en las fichas que tengan video.

6. **Sin estrategia de ISR/`revalidate`** — no se encontró `export const revalidate` en `page.tsx` de home/inmuebles/ficha, ni uso de `fetch` con opciones de caché en la capa de datos (`src/lib/data/*`). Cada visita a home o al listado dispara una lectura en vivo del repositorio (Supabase o memoria); esto añade el round-trip de datos como parte del TTFB (subparte de LCP). No se pudo medir el TTFB real de producción (Supabase) desde este sandbox — recomendamos medirlo con PageSpeed/CrUX una vez el dominio tenga tráfico, y evaluar `revalidate` o cache de datos si el TTFB resulta alto.

7. **Anomalía observada (posiblemente solo de `next dev`)**: a diferencia de `/`, `/vender` y `/contacto`, la ruta `/inmuebles` **no** emite los 3 `<link rel="preload" as="font">` en el `<head>` (verificado con `curl` en el espejo local; único `<link>` de esa ruta son el stylesheet, un preload de script de baja prioridad y el canonical). Esto puede ser una particularidad de la compilación on-demand del servidor de desarrollo y no reproducirse en un build de producción (`next build && next start`) — se recomienda confirmarlo antes de tratarlo como bug real, ya que `font-display: swap` ya mitiga el impacto de un posible retraso.

8. **Limitación de datos para este análisis** — el catálogo del espejo local devuelve 0 propiedades (`vitrina.length === 0` en home, confirmado por el texto "Estamos preparando el portafolio" en el HTML), por lo que no fue posible verificar con datos reales el peso/CLS de las fotos de tarjetas ni de la galería de ficha, ni confirmar cuántas fotos por propiedad se cargan en promedio. Recomendamos repetir este análisis contra un entorno con catálogo real (staging o producción) antes de cerrar el capítulo de imágenes.

---

## Puntos positivos (evidencia, no fabricado)

- Preload + `fetchPriority="high"` del hero correctamente resuelto y bien ordenado en el `<head>`.
- `font-display: swap` en las 3 familias tipográficas + preload de los 3 `.woff2` en la mayoría de rutas.
- Contenedores con `aspect-ratio` fijo (Tailwind `aspect-[4/3]`, `aspect-[3/2]`) en todas las imágenes con `fill` → sin riesgo de CLS por imágenes.
- Animaciones limitadas a `opacity`/`transform`/`filter`, con `prefers-reduced-motion` respetado.
- Scroll-driven zoom del hero (`hero-pov.tsx`) con listener `passive` + `requestAnimationFrame`/`cancelAnimationFrame` — patrón correcto para no bloquear INP.
- DOM ligero (~300 nodos por página) y ningún script de terceros (analytics/chat/pixels) detectado que compita por el hilo principal.
- Todos los `<script>` del bundle son `async`; no hay JS síncrono bloqueante en el `<head>`.
- `Cache-Control: immutable` ya correcto en `/_next/static/*` (confirmado, no se repite como hallazgo per instrucciones).

## Recomendación general de medición

Ninguna cifra de LCP/INP/CLS en segundos o milisegundos fue inventada en este informe. En cuanto el dominio `cicinmuebles.com` tenga tráfico indexado por Chrome (CrUX), correr:
```
python3 scripts/pagespeed_check.py https://cicinmuebles.com --json
python3 scripts/crux_history.py https://cicinmuebles.com --json
```
para obtener datos de campo reales y contrastarlos con los hallazgos estáticos de este documento.
