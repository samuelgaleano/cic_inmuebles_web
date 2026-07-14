# Auditoría SEO completa — CIC Inmuebles (www.cicinmuebles.com)

**Fecha:** 2026-07-13 · **Método:** plugin claude-seo v2.2.0, 8 agentes especialistas en paralelo (técnico, contenido/E-E-A-T, schema, sitemap, rendimiento, GEO/IA, SXO, local) sobre espejo local de producción + ficha real de producción + código fuente (caja blanca).
**Tipo de negocio detectado:** inmobiliaria boutique (solo venta), negocio de área de servicio (SAB), mercado Colombia/Bogotá, sitio nuevo (~3 semanas), dominio propio recién conectado.

## Puntuación de salud SEO

**56/100 al momento de la auditoría → ~68/100 estimado tras las correcciones aplicadas hoy** (las puntuaciones post-fix son estimaciones; validar con Search Console/PageSpeed cuando el dominio esté indexado).

| Categoría | Peso | Antes | Después (est.) |
|---|---|---|---|
| SEO técnico | 22% | 62 | ~75 |
| Calidad de contenido | 23% | 40 | ~45 |
| On-page | 20% | ~52 | ~75 |
| Schema / datos estructurados | 10% | 78 | ~90 |
| Rendimiento (CWV, análisis estático) | 10% | 74 | ~82 |
| Preparación para búsqueda por IA (GEO) | 10% | 42 | ~55 |
| Imágenes | 5% | 60 | ~75 |

Puntuaciones auxiliares (no ponderan): Sitemap 80 · SXO 51 · SEO local 35.

## Top 5 críticos encontrados (estado)

1. **Sitemap/canonicals de producción apuntaban a specifinance.com** (dominio ajeno capturado por `VERCEL_PROJECT_PRODUCTION_URL` durante el cambio de dominios) → **corregido**: URL canónica fijada a `https://www.cicinmuebles.com` (el ápex redirige 308 a www en Vercel; www responde 200 sin noindex).
2. **Metadatos de fichas rotos en todo el catálogo** (title = nombre del proyecto a secas; description = texto operativo con emojis de 466 caracteres) → **corregido**: title/description generados desde tipo + sector + ciudad + habitaciones + baños + área + precio, ≤160 caracteres.
3. **Déficit estructural de confianza (E-E-A-T)**: sin "Sobre nosotros", equipo, testimonios ni reseñas; correo Gmail genérico → **pendiente (requiere insumos del negocio)**.
4. **Sin Google Business Profile ni Search Console** → **pendiente (solo puede hacerlo el dueño)**.
5. **`x-robots-tag: noindex` en URLs \*.vercel.app** → **sin acción necesaria**: es el comportamiento correcto de Vercel cuando existe dominio propio (evita duplicados); www.cicinmuebles.com sirve sin noindex.

## Correcciones aplicadas hoy (commits c3108d8…d96561c)

**Técnico**: cabeceras de seguridad (nosniff, X-Frame-Options, Referrer-Policy, Permissions-Policy), `lang="es-CO"`, raíz del sitemap alineada al canonical, robots.txt con crawlers de IA explícitos (GPTBot, ClaudeBot, PerplexityBot, Google-Extended).
**Sitemap**: revalidación horaria (ya no queda congelado si la BD falla en un build) + `lastModified` real en `/` e `/inmuebles`.
**On-page**: title/description de fichas desde campos estructurados.
**Schema**: grafo conectado con `@id` (WebSite → publisher → RealEstateAgent), `SearchAction` hacia el buscador real `/inmuebles?q=`, `areaServed` con ciudades reales del inventario, `numberOfBedrooms`/`numberOfBathroomsTotal`, `floorSize` solo en tipos residenciales, `seller` enlazado, `ItemList` omitido si está vacío, `sameAs` cableado (se activa al configurar redes).
**GEO/IA**: FAQ real con 5 preguntas en `/vender` + marcado FAQPage, `llms.txt`, specs de ficha como `<dl>` semántica.
**Rendimiento**: hero en WebP responsive (316KB JPEG → 179KB escritorio / 61KB móvil, −81%), preload con `imagesrcset`, preconnect a lh3.googleusercontent.com (fotos Drive), YouTube `loading="lazy"`, caché para assets del hero, revalidación en home.

## Hallazgos que requieren al dueño (no son de código)

1. **Google Search Console**: registrar `www.cicinmuebles.com`, verificar y enviar `sitemap.xml`. Es el paso nº1 para indexar.
2. **Google Business Profile** como negocio de área de servicio (categoría "Agencia inmobiliaria", área Bogotá y alrededores; sin dirección inventada).
3. **Datos con errores en el Sheet/BD**: "BogotÁ" (capitalización) y Bella Suiza con 4 habitaciones/baños en specs pero "3" en el texto libre — corregir en el Sheet e importar.
4. **Vercel**: confirmar en Settings → Environment Variables que no exista `NEXT_PUBLIC_SITE_URL` apuntando a specifinance.com u otro valor viejo (si existe, borrarla o ponerla en `https://www.cicinmuebles.com`); confirmar en Settings → Domains que specifinance.com no esté colgado del proyecto.
5. **Correo con dominio propio** (p. ej. contacto@cicinmuebles.com) — señal de confianza; muchos registradores lo incluyen o hay reenvío gratuito.
6. **Redes sociales**: crear/configurar Instagram/Facebook y poner las URLs en `NEXT_PUBLIC_INSTAGRAM`/`NEXT_PUBLIC_FACEBOOK` (el sitio ya las emite como `sameAs` automáticamente).
7. **Reseñas**: tras crear el GBP, pedir reseñas a clientes cerrados.

## Hoja de ruta de contenido (cuando quieras, requiere tus insumos)

- Página "Sobre nosotros" (quiénes son, trayectoria, por qué confiar) — el mayor déficit de E-E-A-T.
- Ampliar `/vender` con el proceso paso a paso y tiempos reales del negocio.
- Guías: "cómo vender mi apartamento en Bogotá", "documentos para vender un inmueble en Colombia".
- Páginas por ciudad/sector **solo cuando haya ~8-10 inmuebles por zona** (antes sería thin content).
- Descripciones de fichas: narrativa única por inmueble (barrio, luz, distribución) en vez del volcado de ficha técnica.

## Informes por especialista

Detalle completo en `findings/`: technical.md, content.md, schema.md, sitemap.md, performance.md, geo.md, sxo.md, local.md.
