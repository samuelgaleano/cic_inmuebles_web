# Auditoría de Sitemap — CIC Inmuebles

Fuente de verdad revisada: `src/app/sitemap.ts`, `src/app/robots.ts`, `src/lib/config/site.ts`,
`src/lib/data/supabase-repository.ts`, `src/app/(public)/inmuebles/[slug]/page.tsx`,
docs de Next.js 16.2.9 en `node_modules/next/dist/docs/.../sitemap.md`.

Espejo local (`curl -s http://localhost:3110/sitemap.xml` y `/robots.txt`): sitemap con
las 4 rutas estáticas (Supabase inaccesible desde el sandbox → cae al catch). Producción
(según nota `prod-sitemap-nota.md`): 4 estáticas + 7 fichas = 11 URLs totales, ya con el
dominio corregido `https://cicinmuebles.com`.

## 1. Formato XML — PASS
`urlset` con namespace correcto (`http://www.sitemaps.org/schemas/sitemap/0.9`), declaración
`<?xml version="1.0" encoding="UTF-8"?>`, sin caracteres a escapar (slugs en minúsculas con
guiones: `corinto-alejandria`, `bella-suiza`, etc.). Coincide exactamente con el formato que
generaría `sitemap.ts` según los docs oficiales de Next 16 incluidos en el repo. Sin errores
de sintaxis.

## 2. `lastModified` — HALLAZGO (Medio)
- Rutas estáticas (`/`, `/inmuebles`, `/vender`, `/contacto`): **no** se define `lastModified`
  en `sitemap.ts` (líneas 17-20) → no aparece `<lastmod>` en el XML. Confirmado en el
  espejo local: ninguna de las 4 entradas trae `<lastmod>`.
- Rutas de fichas (`/inmuebles/[slug]`): sí traen `lastModified: p.actualizadoEn`, que mapea
  a `updated_at` de Supabase (`src/lib/data/supabase/mappers.ts:73`) — fecha real, no
  fabricada, correcto.
- Impacto: Google usa `lastmod` como señal (débil pero real) de re-crawl prioritario. Las 4
  páginas más importantes del sitio (home e inmuebles-listado incluidas) no dan ninguna señal
  de frescura. Es fácil de corregir: usar la fecha del build/deploy o una constante de "última
  edición de contenido" para esas 4 rutas.

## 3. `changeFrequency` / `priority` — INFO
Se usan en las 19 combinaciones posibles (`daily`/`monthly`/`weekly` y prioridades 0.5–1).
Google confirmó públicamente que ignora ambos atributos desde hace años (John Mueller,
Google Search Central). No son dañinos, pero no aportan valor real de ranking ni de
frecuencia de rastreo — es peso muerto en el archivo. No es necesario quitarlos con urgencia,
pero no vale la pena invertir tiempo en afinar estos valores (p. ej. decidir si `/vender` debe
ser `monthly` o `weekly`): esa energía es mejor gastarla en contenido o en el punto 6.

## 4. Cobertura — PASS
`sitemap.ts` enumera exactamente las rutas públicas indexables del árbol de páginas:
`/`, `/inmuebles`, `/vender`, `/contacto` (estáticas) + `/inmuebles/[slug]` para cada
propiedad devuelta por `listPublic()`. Verificado en `supabase-repository.ts:72`:
`listPublic()` filtra por `p.publicado` — las fichas no publicadas no entran ni al listado
público ni al sitemap, consistente con `getPublicBySlug` (línea 97) que también exige
`publicado`. No se detectaron páginas indexables ausentes del sitemap.
Correctamente **excluidas**: todo `/admin/**` (panel), `/admin/login`, y `/api/cron/sync`
(ruta de servidor, no una página) — ninguna aparece en `sitemap.ts` ni debería.

## 5. Consistencia canonical ↔ sitemap — PASS
Todas las páginas públicas declaran `alternates.canonical` con ruta relativa, resuelta contra
`metadataBase = new URL(siteConfig.url)` (`src/app/layout.tsx:28`). El sitemap construye sus
`<loc>` con el mismo `siteConfig.url` (home/listado/vender/contacto) y con `propertyUrl(slug)`
(fichas), que también usa `siteConfig.url`. Una sola fuente de verdad para el dominio →
canonical y sitemap nunca pueden divergir en el dominio. La página `/inmuebles` usa
`canonical: "/inmuebles"` fijo (metadata estática, no `generateMetadata`) incluso con
filtros/paginación por query string — correcto: evita que variantes filtradas se autocaniquen
mal, y el sitemap solo lista la URL base, coherente.
Nota menor fuera de alcance estricto de sitemap: no se detectó redirect www→apex (ni en
`next.config.ts` ni middleware) pese a que la nota de producción menciona
`www.cicinmuebles.com` conectado al proyecto junto al apex. Si ambos hosts sirven contenido
sin redirect 301, hay riesgo de contenido duplicado por host que ningún canonical dentro del
sitemap resuelve (el canonical apunta siempre al apex, pero eso no evita que Google indexe el
www si responde 200). Vale la pena confirmarlo con el especialista técnico/canonical.

## 6. Referencia desde robots.txt — PASS
`robots.ts` expone `sitemap: https://cicinmuebles.com/sitemap.xml` (confirmado en el espejo
local) y `disallow: ["/admin"]`, coherente con que el panel no está en el sitemap. `allow: "/"`
para el resto. No hay `crawl-delay` ni bloqueos que interfieran con el rastreo de las páginas
públicas.

## 7. Tamaño / particionado — NO APLICA
11 URLs totales en producción (4 + 7). Límite protocolo: 50.000 URLs / 50MB por archivo.
Ni de lejos cerca del límite; `generateSitemaps`/sitemap index no aplica en esta escala y no
debe implementarse preventivamente (complejidad innecesaria).

## 8. Riesgo: fallo de BD durante el build — HALLAZGO (Alto)
`sitemap.ts` líneas 9-14:
```ts
try {
  properties = await getRepository().properties.listPublic();
} catch (err) {
  console.error("[sitemap] no se pudo listar inmuebles:", err);
}
```
Si Supabase no responde durante el build, `properties` queda `[]` y el sitemap se genera
**solo con las 4 rutas estáticas** — exactamente lo que observamos ahora mismo en el espejo
local (reproducción en vivo del escenario de fallo).

Lo que agrava esto: según los docs de Next 16 incluidos en el repo
(`sitemap.md`: *"sitemap.js is a special Route Handler that is cached by default unless it
uses a Request-time API or dynamic config option"*), y como `sitemap.ts` no exporta
`revalidate` ni `dynamic = "force-dynamic"`, no usa ninguna Request-time API — el archivo se
genera **una sola vez en build** y queda cacheado/estático. Si el build coincide con una caída
transitoria de Supabase:
1. El sitemap de producción queda congelado con solo 4 URLs.
2. No hay reintento automático ni revalidación — el error solo se registra con
   `console.error` en los logs de build, que normalmente nadie monitorea activamente.
3. Las 7 fichas desaparecen silenciosamente del sitemap hasta el **próximo deploy**, sin
   ninguna alerta visible para el equipo ni para Search Console.

Esto es un riesgo real y no hipotético para un catálogo pequeño (11 URLs): perder el 64% de
las URLs indexables (7 de 11) por una caída puntual de la base de datos, sin mecanismo de
autorrecuperación, es un punto único de fallo silencioso. Recomendación: como mínimo, que el
`catch` dispare una alerta (o falle el build) en vez de solo loguear; idealmente, mover el
fetch de propiedades a una ruta con `revalidate` corto (o `dynamic`) para que un fallo de build
no deje el sitemap "atascado" hasta el siguiente deploy.

---

## Resumen de severidad
| Hallazgo | Severidad |
|---|---|
| `lastModified` ausente en las 4 rutas estáticas | Media |
| `priority`/`changeFrequency` en todas las entradas (ignorados por Google) | Info |
| Cobertura completa y exclusión correcta de `/admin` y `/api` | Pass |
| Canonical ↔ sitemap consistentes (única fuente `siteConfig.url`) | Pass |
| Posible falta de redirect www→apex (fuera de alcance estricto) | Info/A confirmar |
| robots.txt referencia sitemap correctamente | Pass |
| Tamaño/particionado (11 URLs) | No aplica |
| Sitemap cacheado en build sin revalidate + catch silencioso ante fallo de Supabase | **Alta** |
