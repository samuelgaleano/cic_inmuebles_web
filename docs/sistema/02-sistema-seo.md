# 2. Sistema SEO

Cómo el sitio aparece en Google y en los buscadores de IA (ChatGPT,
Perplexity, AI Overviews), y **cómo se mantiene** sin depender de nadie.

> **Base de la auditoría (2026-07-14): 68/100.** Es una buena base para un sitio
> de pocas semanas. El SEO no es un botón: sube con contenido y autoridad
> sostenidos en el tiempo (ver cadencia en `05-tablero-y-cadencia.md`).

## Qué ya está resuelto **en el código** (automático, no hay que tocarlo)

Estas cosas funcionan solas en cada despliegue; están listadas para que se
sepa que existen y no se rompan por accidente:

| Pieza | Qué hace | Dónde vive |
|-------|----------|-----------|
| **Dominio canónico** | Todo apunta a `www.cicinmuebles.com` (fijo en código para que ninguna variable vieja lo pise) | `src/lib/config/site.ts` |
| **Metadatos** | Título + descripción por página; las fichas se arman con tipo + ubicación + specs + precio | `src/app/**/page.tsx` |
| **Datos estructurados (schema.org)** | Grafo conectado: WebSite + RealEstateAgent + buscador (SearchAction) + Offer por inmueble + FAQPage + migas de pan | `src/app/layout.tsx`, `src/components/seo/json-ld.tsx` |
| **Sitemap** | Se genera solo con todas las URLs publicadas; se auto-repara cada hora | `src/app/sitemap.ts` |
| **robots.txt** | Permite todo menos `/admin`; nombra a los crawlers de IA | `src/app/robots.ts` |
| **llms.txt** | Resumen del negocio para buscadores de IA | `public/llms.txt` |
| **Rendimiento** | Hero en WebP responsive (−81% en móvil), preconnect, cabeceras de seguridad | `hero-pov.tsx`, `next.config.ts` |

**Regla de oro:** cuando se edite el sitio, no cambiar el dominio de
`site.ts`, ni quitar los `JsonLd`, ni el `sitemap.ts`/`robots.ts`. Si algo de
esto se toca, revisar con una auditoría (abajo).

## Qué depende del dueño (no es código)

Esto es lo que **más mueve la aguja** ahora y solo lo puede hacer el negocio:

1. **Google Search Console** — registrar `www.cicinmuebles.com`, verificar y
   enviar el sitemap. **Es el paso nº1 para que Google indexe.**
2. **Google Business Profile** — como negocio de área de servicio (categoría
   "Agencia inmobiliaria", zona Bogotá). Da visibilidad en Maps y búsqueda local.
3. **Redes sociales** — Instagram/Facebook; al cargar sus URLs en Vercel el
   sitio las publica solo como señal de entidad (`sameAs`).
4. **Correo de dominio propio** (contacto@cicinmuebles.com) — señal de confianza.
5. **Reseñas** — tras crear el Business Profile, pedirlas a clientes cerrados.

Detalle con pasos exactos en `06-plan-de-accion.md`.

## Cómo se audita (repetible, gratis)

El proyecto tiene instalado el sistema **claude-seo** (25 skills + agentes
especialistas). Para volver a auditar el sitio en cualquier momento:

```
/seo audit https://www.cicinmuebles.com
```

Genera un informe por categoría (técnico, contenido, schema, rendimiento,
GEO/IA, local) con puntuación y plan de acción. Conviene correrlo:

- Después de un cambio grande en el sitio.
- Una vez al mes como chequeo (ver cadencia).

## Las 7 categorías que se miden (base actual)

| Categoría | Base | Nota |
|-----------|------|------|
| SEO Técnico | 75 | Sólido; falta consolidar dominio en Search Console |
| Contenido / E-E-A-T | 45 | El mayor margen de mejora → contenido y confianza |
| On-Page | 75 | Metadatos ya descriptivos |
| Schema | 90 | Muy completo |
| Rendimiento | 82 | Hero optimizado |
| Búsqueda por IA (GEO) | 55 | Base lista; falta autoridad externa |
| Imágenes | 75 | WebP responsive |
