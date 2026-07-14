# Auditoría SEO Local — CIC Inmuebles (cicinmuebles.com)

**Fecha:** 2026-07-13
**Fuentes:** espejo local http://localhost:3110 (`/`, `/inmuebles`, `/vender`, `/contacto`), código en `/home/user/cic_inmuebles_web`, ficha real de producción `/inmuebles/bella-suiza` (snapshot guardado).
**Sin acceso a red externa**: no se pudo verificar GBP, citations ni reseñas en vivo. Las verificaciones externas quedan marcadas como tareas para el dueño del negocio.

## Puntuación Local SEO: 35/100

| Dimensión | Peso | Estado |
|---|---|---|
| Señales GBP | 25% | Bajo — no existe perfil creado, sin plan documentado |
| Reseñas y reputación | 20% | Bajo — cero reseñas, sin `aggregateRating`, sin plan |
| SEO local on-page | 20% | Bajo-Parcial — NAP visible bien, pero targeting nacional no local; fichas de sector con bug crítico (ver H1) |
| Consistencia NAP y citations | 15% | Parcial — NAP consistente en el sitio espejo, pero rota en la ficha real por bug de dominio; cero citations |
| Schema local | 10% | Parcial-Bajo — `RealEstateAgent` presente y con subtipo correcto, pero solo en home, sin geo/áreas reales |
| Enlaces y autoridad local | 10% | Bajo — sin cámara de comercio, prensa, redes ni menciones |

## Tipo de negocio y vertical

- **Tipo**: Service Area Business (SAB) confirmado — no hay dirección física en ningún lado del sitio (ni HTML ni schema, que solo trae `addressCountry: "CO"`). Correcto: **no se debe inventar una dirección** para GBP ni para schema.
- **Vertical**: Inmobiliaria / Real Estate confirmado por listados, fichas tipo `Offer`+`Apartment`/`House`, formulario "Vende tu inmueble", código de inmueble (`sku`), administración, parqueaderos.

---

## Hallazgo crítico (bloqueante): la ficha real de producción está rota para SEO local

La ficha `/inmuebles/bella-suiza` en producción (snapshot capturado) presenta:

- **Canonical, Open Graph, `WebSite`, `Offer.url` y `BreadcrumbList` apuntan a `https://specifinance.com`**, no a `cicinmuebles.com` (0 menciones de `cicinmuebles.com` en toda la página, 14 de `specifinance.com`).
- **Header `x-robots-tag: noindex`** en la respuesta — Google no puede indexar esta ficha aunque quisiera.
- El código (`src/lib/config/site.ts:6-14`) ya documenta este mismo problema en un comentario ("pasó con specifinance.com") y ya trae un default seguro (`https://cicinmuebles.com`), lo que indica que **la variable de entorno `NEXT_PUBLIC_SITE_URL` en Vercel Producción probablemente sigue apuntando (o el deploy vivo es anterior al fix)** a ese dominio ajeno.
- Impacto directo en SEO local: precisamente las páginas que llevan la señal de sector/ciudad (`addressLocality: "Bogotá"` en el schema `Offer→itemOffered.address`) son las que están noindexed y mal atribuidas. Cualquier trabajo de contenido por sector (Bella Suiza, Alhambra, Cedritos) es inútil mientras esto no se corrija.
- **Acción para el dueño (owner action, no requiere presupuesto)**: verificar en el dashboard de Vercel del proyecto (a) que el dominio de producción asignado sea `cicinmuebles.com`, (b) que `NEXT_PUBLIC_SITE_URL` no esté fijado a `specifinance.com` en Production env vars, y (c) redeploy. Confirmar con `curl -sI https://cicinmuebles.com/inmuebles/bella-suiza` que ya no aparece `x-robots-tag: noindex` y que el HTML referencia `cicinmuebles.com`.

---

## 1. Preparación para Google Business Profile (no existe, plan gratuito)

No hay ninguna señal de GBP en el sitio (sin iframe de Maps, sin place ID, sin widget de reseñas) ni en el repo/docs. Al ser SAB, el alta debe hacerse **sin publicar una dirección física**:

- **Categoría primaria recomendada**: "Agencia inmobiliaria" (Real Estate Agency). Es el factor #1 de ranking en Whitespark 2026 (score 193) y elegir mal categoría es el factor negativo #1 (score 176) — no usar "Agente inmobiliario" individual si CIC opera como agencia/negocio.
- **Tipo de perfil**: Service Area Business — en el asistente de alta de GBP, marcar "entrego bienes y servicios a mis clientes" y **ocultar la dirección** (Google la pide solo para verificación, no la publica).
- **Área de servicio a declarar**: Bogotá y municipios/sectores reales de inventario (Bella Suiza, Alhambra, Cedritos como barrios dentro de Bogotá), **no todo el país**. Google desaconseja áreas de servicio que excedan ~2h en auto desde la base; declarar "Colombia" completa es una señal de riesgo (histórico de suspensiones de perfiles con área de servicio desproporcionada) y además diluye la relevancia geográfica real.
- **Qué publicar en el perfil**: teléfono +57 324 907 1717 (igual al del sitio), horario de atención (si lo hay, aunque sea "atención por WhatsApp"), sitio web enlazado a la home (no a la página con mejor ranking orgánico — evitar canibalización, recomendación Sterling Sky), categoría, 3-5 fotos reales de fichas recientes, descripción del negocio (puede reusar la meta description del sitio), y FAQ propia en el sitio como reemplazo de Preguntas y Respuestas de GBP (la función Q&A fue removida en dic-2025 sin exportación).
- **Enlace desde el sitio hacia GBP**: hoy no existe ningún enlace "Ver en Google Maps" ni social/`sameAs`. Una vez creado el perfil, añadir su URL corta de Google (`g.page/...`) en el footer o en `/contacto`, y agregarla al array `sameAs` del schema `RealEstateAgent`.

## 2. NAP (Nombre, Dirección, Teléfono)

- **Teléfono SÍ aparece como texto rastreable**, no solo en botones `wa.me`: en el footer de las 4 páginas (`/`, `/inmuebles`, `/vender`, `/contacto`) hay un enlace `<a href="tel:+573249071717">+57 324 907 1717</a>` con el número visible como texto, además de los CTA de WhatsApp. Esto es correcto y consistente en todo el sitio espejo — buena práctica ya implementada, no hace falta cambiarla.
- **Email** `cc.inmuebles@gmail.com` consistente en footer y en el schema `RealEstateAgent`.
- **Nombre** "CIC Inmuebles" consistente en `<title>`, footer, schema.
- **Dirección**: correctamente ausente en todo el sitio (coherente con SAB) — no fabricar una.
- **Discrepancia real detectada**: en la ficha de producción (`bella-suiza`) todo el bloque de identidad (dominio en canonical/OG/JSON-LD) es `specifinance.com`, rompiendo la consistencia NAP/identidad de marca en las páginas de listado (ver hallazgo crítico arriba).
- **Calidad de dato menor**: el campo `ciudad` de al menos un inmueble se guardó como `"BogotÁ"` (mayúscula suelta en la tilde), lo que se propaga literalmente al schema (`addressLocality: "BogotÁ"`). Recomendación de bajo esfuerzo: normalizar valores de ciudad a una lista controlada (ej. "Bogotá") en vez de texto libre en el panel admin, para evitar que errores de tipeo lleguen al schema público.

## 3. Schema local (`RealEstateAgent`)

Código: `src/app/(public)/page.tsx:34-46`.

```json
{"@type":"RealEstateAgent","address":{"@type":"PostalAddress","addressCountry":"CO"},
"areaServed":{"@type":"Country","name":"Colombia"}}
```

- Subtipo correcto (`RealEstateAgent`, no genérico `LocalBusiness`) — bien.
- **Solo existe en la home** (`page.tsx` de `/`). Las páginas `/inmuebles`, `/vender` y `/contacto` únicamente traen el schema `WebSite` (verificado con curl+grep en las 4 rutas). Recomendación: mover el bloque a un componente compartido (o al menos duplicarlo en `/contacto`, la página con más intención de "encontrar el negocio") para que el negocio esté identificado en todas las páginas relevantes.
- **`areaServed` es solo `Country: Colombia`**, pese a que el modelo de datos (`src/lib/domain/property.ts:66-68`) ya tiene `ciudad` (obligatorio) y `sector` (opcional) por inmueble. Recomendación: cambiar a un array de `City` reales del inventario, ej. `areaServed: [{"@type":"City","name":"Bogotá"}]`, y si se quiere granularidad de barrio, usar `Place` con `name` para Bella Suiza/Alhambra/Cedritos dentro de `containedInPlace`.
- Faltan propiedades recomendadas: `geo` (no aplica coordenadas de oficina por ser SAB, pero sí podría usarse el centroide de Bogotá si se decide declarar como área principal — opcional, bajo impacto), `aggregateRating` (no hay reseñas aún), `sameAs` (no hay redes configuradas), `openingHoursSpecification` (si el negocio atiende en horario definido por WhatsApp, vale la pena declararlo).
- **Fichas de inmueble** (`src/app/(public)/inmuebles/[slug]/page.tsx:120-160`) sí usan `addressLocality: ubicacion.ciudad` en el schema `Offer→itemOffered.address` — buena práctica de granularidad por ciudad ya implementada a nivel de código; el problema es que en producción esa página está `noindex` y mal atribuida a otro dominio (ver hallazgo crítico).

## 4. Páginas por ciudad/sector — cuándo crearlas

- Inventario real citado en el brief: ~7 inmuebles en Bogotá (sectores Bella Suiza, Alhambra, Cedritos). El espejo local tiene la base de datos vacía (`numberOfItems: 0` en el `ItemList` de `/inmuebles`), así que no se pudo verificar el conteo real desde aquí.
- **No crear páginas dedicadas por sector todavía.** Con 2-3 inmuebles por barrio, una página `/sectores/bella-suiza` sería "thin content" y probablemente fallaría el swap-test (cambiar el nombre del barrio y el contenido seguiría sirviendo igual) — el patrón que penalizó a agencias tras el Core Update de marzo 2024.
- **Recomendación de bajo esfuerzo mientras el inventario es bajo**: en lugar de páginas por sector, reforzar `/inmuebles` con:
  - Filtro de ciudad ya existe en el código (`aria-label="Ciudad"` en `/inmuebles`) pero sin opciones visibles porque no hay datos cargados en el espejo; confirmar que en producción sí lista las ciudades reales.
  - Un bloque de texto único en `/inmuebles` o `/contacto` que mencione explícitamente "Bogotá y alrededores (Bella Suiza, Alhambra, Cedritos, ...)" — hoy el sitio entero (title, meta description, keywords, H1, footer "Cobertura: Colombia") solo dice "Colombia", nunca "Bogotá" ni los sectores reales. Esto es una oportunidad de contenido de bajo esfuerzo y alto impacto de relevancia local.
  - Umbral sugerido para crear página dedicada por sector: cuando un sector acumule ~8-10 inmuebles simultáneos con contenido único real (fotos propias, descripción específica del sector, no solo un filtro).

## 5. Señales de reseñas (no hay ninguna)

- Cero menciones de reseñas/testimonios/calificaciones en las 4 páginas del sitio espejo. No hay `aggregateRating` en ningún schema.
- Plan de bajo/cero costo:
  1. Crear el GBP primero (sin perfil no hay dónde acumular reseñas de Google).
  2. Tras cada cierre de venta, enviar por WhatsApp el enlace corto de reseña de Google ("g.page/r/.../review") — respetando que Google prohíbe filtrar clientes antes de pedir la reseña (no preguntar "¿quedó satisfecho?" antes de dirigir a la reseña).
  3. Mantener cadencia: la "regla de 18 días" indica que un perfil sin reseñas nuevas en 3 semanas cae en rankings — con pocas ventas al mes, complementar pidiendo reseñas también a compradores que solo consultaron/visitaron, no solo a quienes cerraron.
  4. Meta inicial: 10 reseñas (umbral "mágico" citado por Sterling Sky) antes de optimizar más.
  5. Responder todas las reseñas (88% de consumidores prefiere negocios que responden).

## 6. Citations gratuitas relevantes (Colombia / inmobiliario)

Ninguna citation detectable hoy (sin `sameAs`, sin Instagram/Facebook configurados pese a que `site.ts` ya tiene las variables de entorno listas pero vacías: `NEXT_PUBLIC_INSTAGRAM=""`, `NEXT_PUBLIC_FACEBOOK=""`).

Directorios gratuitos recomendados (verificar en vivo, no se pudo consultar por falta de red):
- **Generales**: Google Business Profile, Bing Places (alimenta ChatGPT/Copilot/Alexa), Apple Business Connect, página de Facebook + Instagram Business (enlazar en `sameAs`).
- **Inmobiliarios Colombia (planes gratuitos/básicos)**: Fincaraiz.com.co, Metrocuadrado, Properati, Mercado Libre Inmuebles, OLX/Vivanuncios — publicar los mismos ~7 inmuebles ahí también sirve como citation + backlink + captación adicional sin costo.
- Mantener el NAP idéntico en cada uno: "CIC Inmuebles", +57 324 907 1717, cc.inmuebles@gmail.com (sin dirección, consistente con SAB).

## 7. Enlaces y autoridad local

Sin señales detectables de Cámara de Comercio, prensa local, patrocinios o comunidad. No accionable sin más contexto del negocio; queda como tarea a mediano plazo una vez GBP y reseñas estén en marcha.

---

## Top acciones priorizadas

**Crítico**
1. Corregir el dominio/`NEXT_PUBLIC_SITE_URL` en producción (Vercel) — las fichas de inmueble hoy se sirven `noindex` y con canonical/OG/schema apuntando a `specifinance.com`, no a `cicinmuebles.com`.

**Alto**
2. Crear Google Business Profile como SAB, categoría "Agencia inmobiliaria", área de servicio = Bogotá y alrededores (no "Colombia").
3. Cambiar `areaServed` del schema `RealEstateAgent` (`src/app/(public)/page.tsx:44`) de `Country: Colombia` a la(s) ciudad(es) reales de inventario (Bogotá), aprovechando que `ubicacion.ciudad`/`sector` ya existen en el modelo de datos.
4. Añadir el schema `RealEstateAgent` (o referencia a él) en `/contacto`, `/inmuebles` y `/vender`, hoy solo vive en la home.
5. Ajustar copy del sitio (title, meta description, H1, footer "Cobertura") para mencionar "Bogotá y alrededores" en vez de únicamente "Colombia".

**Medio**
6. Publicar los inmuebles activos en 2-3 portales inmobiliarios gratuitos colombianos (Fincaraiz, Metrocuadrado) como citation adicional.
7. Configurar Instagram/Facebook (variables ya existen en `.env`, vacías) y enlazarlos como `sameAs` en el schema.
8. Normalizar el campo `ciudad` en el panel admin a una lista controlada para evitar valores como `"BogotÁ"` filtrándose al schema público.

**Bajo**
9. Diseñar el flujo de solicitud de reseñas post-venta por WhatsApp, listo para activar en cuanto exista GBP.
10. No crear páginas de sector dedicadas (Bella Suiza/Alhambra/Cedritos) hasta acumular ~8-10 inmuebles únicos por sector; mientras tanto, reforzar `/inmuebles` con el filtro de ciudad y menciones textuales de los sectores reales.

## Limitaciones

No se pudo verificar en vivo: existencia real de GBP, presencia en directorios (Yelp/BBB no aplican en Colombia; portales locales no consultados por falta de red), reseñas reales, posición en el paquete local, backlinks locales, ni Domain Authority. Estas verificaciones quedan como tareas para el dueño del negocio con acceso a Google Search Console, GBP y a las herramientas pagas correspondientes.
