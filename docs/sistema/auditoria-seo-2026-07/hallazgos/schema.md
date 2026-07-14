# Auditoría de Schema.org / Datos Estructurados — CIC Inmuebles

Fuentes revisadas:
- Código actual: `src/app/layout.tsx`, `src/app/(public)/page.tsx`, `src/app/(public)/inmuebles/page.tsx`,
  `src/app/(public)/inmuebles/[slug]/page.tsx`, `src/components/seo/json-ld.tsx`, `src/lib/config/site.ts`,
  `src/components/public/site-footer.tsx`, `src/components/public/property-filters.tsx`.
- Espejo local (`curl -s http://localhost:3110`): `/`, `/inmuebles`, `/vender`, `/contacto` (nota: DB no
  conectada localmente → catálogo vacío, `/inmuebles/[slug]` da 500 y el sitemap local solo trae las 4
  rutas estáticas; por eso la validación de la ficha se hizo contra el snapshot de producción + el código
  fuente actual, que coinciden exactamente).
- Ficha real de producción (`prod-ficha-bella-suiza.txt`, build anterior con dominio specifinance.com ya
  corregido en código): confirma que el JSON-LD desplegado es idéntico al que genera el código actual
  (`Offer` + `BreadcrumbList`).

## Inventario de schema existente

| Página | Bloques JSON-LD | @type |
|---|---|---|
| Todas (layout) | 1 | `WebSite` |
| `/` | +1 | `RealEstateAgent` |
| `/inmuebles` | +1 | `ItemList` (con `ListItem`) |
| `/inmuebles/[slug]` | +2 | `Offer` (con `itemOffered` Apartment/House/Place), `BreadcrumbList` |
| `/vender`, `/contacto` | solo `WebSite` | — |

Ningún tipo deprecado ni prohibido: no hay `Product` (correctamente evitado para listados inmobiliarios),
no hay `HowTo`, `SpecialAnnouncement`, `ClaimReview`, `VehicleListing`, etc. `@context` siempre
`https://schema.org`, JSON-LD siempre server-rendered (no inyectado por JS cliente — se ve en el HTML
crudo servido por curl, sin necesidad de Playwright).

## Validación contra producción

El bloque `Offer`+`BreadcrumbList` de `prod-ficha-bella-suiza.txt` es estructuralmente idéntico al que
genera `[slug]/page.tsx` hoy: mismos campos (`name`, `description`, `sku`, `category`, `url`, `price`,
`priceCurrency`, `availability`, `image[]`, `itemOffered.{@type,name,numberOfRooms,floorSize,address}`) y
mismo `BreadcrumbList` de 3 niveles. `availability` usa valores válidos del enum
`schema.org/ItemAvailability` (`InStock`/`LimitedAvailability`/`SoldOut` mapeados 1:1 desde
`disponible`/`en_proceso`/`vendido`). Las URLs del snapshot muestran `specifinance.com` (dominio viejo);
el código actual ya fija `siteConfig.url = https://cicinmuebles.com`, así que esto está resuelto — no
requiere acción.

Detalle menor de **datos** (no de schema): en el snapshot, `itemOffered.address.addressLocality` es
`"BogotÁ"` (mayúscula suelta). Es un problema de captura/normalización del campo `ubicacion.ciudad` en la
base de datos, no del marcado — vale la pena corregir en el dato de origen para no propagar el error a
todas las fichas de Bogotá.

## Hallazgos

### 1. [Alto] Falta `SearchAction` en el `WebSite` → se pierde el Sitelinks Search Box
`/inmuebles` ya tiene un buscador funcional por query string (`property-filters.tsx`, input `name="q"`,
navega a `/inmuebles?q={término}`). El `WebSite` en `layout.tsx` no declara `potentialAction`. Este es uno
de los pocos rich results que Google **sigue soportando activamente** (no deprecado) y es de bajo esfuerzo
dado que el endpoint ya existe:
```json
{
  "@context": "https://schema.org",
  "@type": "WebSite",
  "@id": "https://cicinmuebles.com/#website",
  "name": "CIC Inmuebles",
  "url": "https://cicinmuebles.com",
  "inLanguage": "es",
  "potentialAction": {
    "@type": "SearchAction",
    "target": "https://cicinmuebles.com/inmuebles?q={search_term_string}",
    "query-input": "required name=search_term_string"
  }
}
```

### 2. [Medio] Grafo desconectado: falta `@id` compartido
Ninguno de los bloques usa `@id`. `WebSite`, `RealEstateAgent`, `Offer`, `BreadcrumbList` e `ItemList`
existen como nodos aislados sin relación explícita. Para mejorar la resolución de entidad (Knowledge
Graph) y la comprensión por LLMs/AI Overviews, conviene:
- `WebSite` → `@id: {url}/#website`
- `RealEstateAgent` → `@id: {url}/#organization`, y que `WebSite.publisher` referencie `{"@id": "{url}/#organization"}`
- `Offer` → que `itemOffered` o el propio `Offer` lleve `seller: {"@id": "{url}/#organization"}` (hoy el
  `Offer` no indica quién vende el inmueble; falta la propiedad `seller`, recomendada para `Offer`)
- Considerar envolver los bloques de cada página en un único `@graph` en vez de varios `<script>` sueltos.

### 3. [Medio] `RealEstateAgent` sin `logo` ni `sameAs`
- `logo`: no existe ningún archivo estático de logo en `public/` (solo `hero.jpg`, que es una foto de
  portada panorámica, no un logo cuadrado); la marca se renderiza como componente SVG inline
  (`src/components/brand/brand-mark.tsx`). Sin un archivo real no se puede declarar `logo` sin inventar una
  URL. Recomendación: exportar el `BrandMark` a un PNG/SVG estático servible (p. ej. `/logo.png`) y añadir
  `logo` al `RealEstateAgent` (ayuda a Knowledge Panel / consistencia de marca).
- `sameAs`: `siteConfig.social.instagram` / `.facebook` existen en `src/lib/config/site.ts:34-35` pero no
  se usan en ningún lugar del código — ni en el footer (`site-footer.tsx`, que no muestra iconos sociales)
  ni en ningún JSON-LD. Si el negocio tiene perfiles activos, cablear un `sameAs` condicional (solo cuando
  la env var no esté vacía) en el `RealEstateAgent`. No inventar URLs si no existen los perfiles.

### 4. [Medio] Propiedades de `Accommodation` aplicadas a `Place` (tipos no residenciales)
En `[slug]/page.tsx` (líneas ~134-148), `itemOffered` añade siempre `numberOfRooms` y `floorSize` cuando
existen datos, sin condicionar al `@type` resultante. Para `oficina`, `local`, `bodega`, `lote`
(`SCHEMA_ITEM_TYPE` los mapea a `Place`), `numberOfRooms` y `floorSize` **no son propiedades válidas de
`Place`** en schema.org (son propiedades de `Accommodation`, que `Place` no hereda). Para esos tipos, mover
área/habitaciones a `additionalProperty` (`PropertyValue`) en vez de `floorSize`/`numberOfRooms`, o usarlos
solo cuando el `@type` sea `Apartment`/`House`.

### 5. [Bajo-Medio] `numberOfRooms` debería ser `numberOfBedrooms`; falta `numberOfBathroomsTotal`
`c.habitaciones` (dormitorios) se mapea a `numberOfRooms`, que en schema.org `Accommodation` se define como
"número de habitaciones **excluyendo baños y closets**" — es un conteo distinto al de dormitorios.
`Accommodation` tiene la propiedad específica `numberOfBedrooms`, más precisa para este dato. Además,
`c.banos` (baños) existe en el dominio pero no se expone en absoluto en el JSON-LD — falta
`numberOfBathroomsTotal`. Ambos son cambios de bajo esfuerzo con datos ya disponibles.

### 6. [Bajo] `ItemList` vacío cuando no hay catálogo
Confirmado en el espejo local (DB no conectada): `/inmuebles` emite
`{"@type":"ItemList","numberOfItems":0,"itemListElement":[]}`. No es un error de sintaxis, pero un
`ItemList` vacío no aporta valor y podría omitirse (no renderizar el `<JsonLd>` cuando
`pageItems.length === 0`) — es un estado de borde legítimo (catálogo real vacío o caída temporal de datos),
conviene manejarlo explícitamente.

### 7. [Info] `Offer` no dispara rich results propios en Google (no hay tipo "listado inmobiliario")
Confirmado que la política de evitar `Product` para inmuebles está bien aplicada, pero vale dejar
expectativas claras: Google no tiene una característica de resultado enriquecido específica para
"real estate listing" fuera de `Product` (prohibido aquí). Es decir, el bloque `Offer` actual no generará
un rich snippet en el SERP — su valor es semántico/estructural para crawlers y para IA (AI Overviews,
LLMs vía GEO). Esto está bien como está; no se recomienda perseguir un rich result inexistente.

### 8. [Info] `FAQPage` no aplica todavía
Se revisó `/vender` y `/contacto` (único texto con "¿" es un mensaje de WhatsApp, no contenido de
preguntas/respuestas) — no hay contenido FAQ real hoy, así que no hay nada que marcar. Si en el futuro se
añade una sección de preguntas frecuentes (p. ej. en `/vender` sobre el proceso de venta), usar
`FAQPage` solo con fines de señal para IA: Google retiró el rich result de FAQ para todos los sitios el
7 de mayo de 2026, así que no esperar aparición en el SERP.

## Otras notas menores (no priorizadas arriba)
- `knowsLanguage: "es"` como string simple es válido (Text/Language aceptado).
- `address: {"@type":"PostalAddress","addressCountry":"CO"}` + `areaServed: Country Colombia` en
  `RealEstateAgent` es el patrón correcto para negocios sin local físico/de cobertura nacional (cumple la
  guía de Google de declarar `areaServed` cuando no aplica dirección física) — bien implementado, no
  inventar una dirección de calle.
- `priceValidUntil` no aplica: solo es relevante para el rich result de `Product`, que aquí está
  correctamente evitado. No inventar una fecha de expiración de precio sin una política real del negocio.
- El `image` de `RealEstateAgent` (`hero.jpg`) es apaisado; si se añade `logo` (hallazgo #3), debe ser un
  activo cuadrado distinto, no la misma foto de portada.
