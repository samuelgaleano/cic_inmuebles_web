# SXO — CIC Inmuebles (Search Experience Optimization)

**Método:** page-type match (taxonomía SXO) + user stories por intención + persona scoring (4 dimensiones × 25 pts).
**Fuentes:** espejo local `http://localhost:3110` (`curl -s`, HTML servido sin ejecutar JS) para `/`, `/inmuebles`, `/vender`, `/contacto`; ficha real de producción (`prod-ficha-bella-suiza.txt`, renderizada) para `/inmuebles/bella-suiza`.
**Limitación honesta:** sin acceso a SERPs reales (sandbox sin salida a Google). Las intenciones y el "consenso SERP" de abajo son **hipótesis razonadas** a partir de conocimiento del sector inmobiliario colombiano (Fincaraíz, Metrocuadrado, La Haus, Properati, Habi como referencia de qué domina esas SERPs), no datos de Search Console/SERP scraping. Márcalas como tal al priorizar. Además, `/` y `/inmuebles` en el espejo local devuelven 0 inmuebles (`ItemList numberOfItems:0`, "Estamos preparando el portafolio") — probablemente por falta de datos semilla en el entorno local, no un defecto confirmado de producción — por lo que no pude evaluar visualmente las tarjetas del catálogo con datos reales; la ficha de Bella Suiza sí es una página real de producción.

---

## 1. Clasificación de tipo de página vs. intención dominante

| Página | Intención probable | Tipo SERP dominante (hipótesis) | Tipo real de la página | Veredicto |
|---|---|---|---|---|
| `/` | Navegacional (marca) + transaccional amplia ("apartamentos y casas en venta en Colombia") | Portales/listados con oferta visible, filtros, mapa | Landing Page (hero + proceso + portafolio + confianza) | ALINEADO para marca/genérico; DÉBIL para volumen (portafolio de ~7 inmuebles no compite en profundidad con portales grandes) |
| `/inmuebles` | Transaccional con corte geográfico: "apartamentos en venta bogotá", "casas en venta medellín", "apartamentos en venta 3 habitaciones" | Catálogo/listado indexable por ciudad+tipo+precio | Catálogo con filtros, pero **los filtros son solo estado de cliente**: `?ciudad=bogota` devuelve el mismo `<title>`, meta description y `<link rel="canonical">` que `/inmuebles` sin filtro | MISMATCH ALTO — no existe página indexable por ciudad; Google no tiene qué rankear para la intención local, que es la dominante en este vertical |
| `/inmuebles/bella-suiza` (prod) | Transaccional específico (comprador que ya identificó el inmueble, o quien busca "apartamento venta bella suiza bogotá") | Product/Local Page (precio, specs, fotos, ubicación, contacto) | Ficha con precio, área, habitaciones, galería (10 fotos), schema `Offer`+`Apartment`, WhatsApp contextual | ALINEADO estructuralmente, pero con defectos de datos que dañan confianza (ver sección 5) |
| `/vender` | Consideración/decisión: "vender mi apartamento", "vender apartamento rápido [ciudad]" | Service Page (agencias) | Service Page: beneficios + formulario corto + WhatsApp | ALINEADO para "vender mi apartamento"; **MISMATCH** para el clúster "cuánto vale mi apartamento" / "avalúo apartamento", donde el consenso son herramientas de estimación instantánea (Habi, La Haus, Fincaraíz) — CIC no tiene ese formato ni ese contenido |
| `/contacto` | Navegacional/marca | Contact Page | Contact Page simple | ALINEADO |

**Hallazgo raíz:** el sitio tiene la mecánica de UX correcta (filtros, formularios, WhatsApp) pero le faltan las **páginas indexables** que el SERP objetivo realmente premia: no hay una URL única y rankeable por ciudad/tipo, y no hay página de "avalúo/cuánto vale mi apartamento". El catálogo entero depende de una sola URL genérica (`/inmuebles`), y el sitemap.xml solo declara 4 URLs (`/`, `/inmuebles`, `/vender`, `/contacto`) — **ninguna ficha de inmueble individual está en el sitemap**, y en el espejo local no hay ningún `<a href="/inmuebles/...">` en `/` ni en `/inmuebles` (portafolio vacío), por lo que el descubrimiento orgánico de fichas depende 100% de que el listado se popule y enlace correctamente en producción.

---

## 2. Historias de usuario (derivadas de la intención + evidencia on-page)

1. **Como comprador serio con presupuesto definido**, quiero ver precio, área, habitaciones y fotos de un apartamento concreto, porque necesito decidir si vale la pena escribir, **pero me bloquea** la falta de una forma de llegar directo a "apartamentos en Bogotá 3 habitaciones" desde buscador — solo puedo filtrar una vez que ya estoy dentro de `/inmuebles`.
   *(Evidencia: ficha real tiene todos los datos + WhatsApp con nombre/código del inmueble precargado; pero `/inmuebles?ciudad=bogota` no genera título/meta/canonical propios → no es una landing rankeable)*

2. **Como comprador que busca por ciudad/barrio** ("apartamentos en venta chapinero", "casas en venta medellín"), quiero encontrar directamente el listado de esa zona, **pero me bloquea** que no existe esa página — solo el filtro cliente-side de `/inmuebles`.
   *(Evidencia: mismo `<title>Inmuebles en venta | CIC Inmuebles</title>` y canonical `https://cicinmuebles.com/inmuebles` con o sin parámetro `ciudad`)*

3. **Como propietario apurado por vender**, quiero saber cuánto vale mi apartamento antes de dejar mis datos, **pero me bloquea** que `/vender` no ofrece ninguna estimación ni contenido educativo sobre el proceso/documentos — solo pide mis datos directamente.
   *(Evidencia: contenido de `/vender` = 4 bullets de beneficios + formulario; sin calculadora, sin rango de precios de referencia, sin FAQ de proceso legal)*

4. **Como propietario indeciso que compara agencias**, quiero ver pruebas de que CIC vende rápido y bien (casos, reseñas, cuántos inmuebles han vendido), **pero me bloquea** la ausencia total de testimonios, casos de éxito o cifras ("vendimos X en Y días") en `/vender` y en el home.
   *(Evidencia: extracción de texto de `/vender` y `/` no contiene ninguna reseña/testimonio/cifra de ventas)*

5. **Como agente inmobiliario aliado** (audiencia terciaria), quiero entender los términos de la alianza 50/50 antes de contactar, **pero me bloquea** que toda la propuesta es una sola frase en letra pequeña al pie del home, enlazando a `/contacto` genérico (sin WhatsApp precargado para "soy agente", a diferencia de comprador/propietario que sí lo tienen).
   *(Evidencia: `<p class="... text-white/60">` con "¿Eres agente inmobiliario?... <a href="/contacto">Hablemos</a>" — único punto de contacto para esta audiencia)*

---

## 3. Persona scoring (4 dimensiones × 25 pts)

| Persona | Relevance | Clarity | Trust | Action | Total | Rating |
|---|---|---|---|---|---|---|
| Comprador serio (inmueble ya identificado) | 18/25 | 17/25 | 13/25 | 22/25 | 70/100 | Bueno |
| Comprador por ciudad/zona (awareness/consideration) | 8/25 | 10/25 | 12/25 | 15/25 | 45/100 | Necesita trabajo |
| Propietario apurado por vender | 18/25 | 20/25 | 12/25 | 22/25 | 72/100 | Bueno |
| Propietario que compara agencias (decisión) | 12/25 | 15/25 | 8/25 | 18/25 | 53/100 | Necesita trabajo |
| Agente inmobiliario aliado (terciaria) | 10/25 | 8/25 | 8/25 | 10/25 | 36/100 | Mismatch crítico (baja prioridad) |

**Persona más débil (mayor oportunidad): Comprador por ciudad/zona — 45/100.** Es probablemente el volumen de búsqueda más alto en este vertical ("apartamentos en venta + ciudad/barrio") y la página que debería servirlo (`/inmuebles`) no genera contenido/URL diferenciado por ubicación.

**Problema sistémico transversal: Trust (12-13/25 en casi todas las personas).** Ninguna página tiene testimonios, casos de éxito, cifras de gestión, credenciales del equipo o registro/tarjeta profesional visibles. El contacto usa un correo genérico de Gmail (`cc.inmuebles@gmail.com`) en vez de un dominio propio, lo que resta profesionalismo en un producto de alto valor (compraventa de vivienda).

---

## 4. Fricciones del recorrido (evidencia concreta)

- **Positivo fuerte:** botón flotante de WhatsApp (`fixed bottom-5 right-5`, verde `#25D366`) presente y server-renderizado en todas las páginas → contacto en 1 clic desde cualquier scroll.
- **Positivo fuerte:** mensajes de WhatsApp precargados y contextuales por página/CTA ("...quiero más información sobre sus inmuebles", "...tengo un inmueble que quiero vender", y en la ficha real: `me interesa el inmueble "Bella Suiza" (1013)` + URL) — reduce fricción y ambigüedad para el asesor que responde.
- **Positivo:** formulario de `/vender` es corto (nombre, WhatsApp, opcionales) con copy "toma menos de un minuto" — baja fricción para propietario apurado.
- **Positivo de posicionamiento:** el copy del home reencuadra el portafolio corto como ventaja ("Pocos inmuebles. Los correctos.") en lugar de parecer un catálogo vacío — mitiga el riesgo de "thin content" percibido con solo ~7 inmuebles.
- **Fricción:** para un comprador que llega al home por una intención de ciudad específica, el recorrido es Home → clic en "Ver el portafolio" (ancla `#portafolio`, misma página) → sin poder filtrar por ciudad hasta estar en `/inmuebles` → clic en ficha → WhatsApp. La intención geográfica no se resuelve hasta el 3er paso como mínimo.
- **Fricción para audiencia terciaria:** la propuesta a agentes no tiene CTA de WhatsApp contextual (a diferencia de comprador/propietario), rompe el patrón de bajo esfuerzo que sí existe para las otras dos audiencias.

---

## 5. Defectos de datos que dañan confianza (ficha real Bella Suiza, producción)

Estos son hechos verificados en la ficha real, no hipótesis:

- **Inconsistencia de habitaciones/baños:** el campo estructurado y el schema `Apartment.numberOfRooms` dicen **4**, pero el texto de la descripción (visible al usuario y también dentro de `Offer.description` en el JSON-LD) dice **"Habitaciones: 3" / "Baños: 3"** repetidamente. Un comprador serio que cuenta habitaciones como criterio de descarte ve un dato contradictorio en la misma página; también es un riesgo de cita contradictoria si una IA generativa (AI Overviews/ChatGPT) resume la ficha citando un número u otro.
- **Error de capitalización en ubicación:** `addressLocality` y el texto visible muestran **"BogotÁ"** (A mayúscula tras la tilde) en vez de "Bogotá", tanto en el UI como en el schema.org `PostalAddress`. Detalle menor de pulido, pero visible y repetido, y afecta percepción de profesionalismo en una compra de alto valor.
- **Meta description sobredimensionada y con formato de ficha interna, no de snippet:** 466 caracteres (vs. ~155-160 recomendados), con emojis y saltos de línea (`🏡 Ficha Técnica del Apartamento\n\n📍 Apartamento en venta...`) — parece un volcado directo del texto operativo/WhatsApp en vez de una meta description redactada para CTR en SERP. Google truncará el snippet de forma imprevisible y el resultado se verá menos profesional que el de un portal competidor con snippet curado.

---

## 6. Puntuación

### SXO Gap Score: **51/100** (Necesita trabajo — separado del SEO Health Score técnico)

| Dimensión | Score | Evidencia clave |
|---|---|---|
| Page Type (0-15) | 8/15 | Home/Vender alineados a intención genérica y de marca; `/inmuebles` no resuelve la intención geográfica dominante (filtros no indexables) |
| Content Depth (0-15) | 5/15 | Sin contenido informacional (proceso legal, documentos, avalúo); catálogo sin poder verificarse con datos reales localmente |
| UX Signals (0-15) | 13/15 | WhatsApp flotante contextual, formularios cortos, CTAs claros arriba del pliegue |
| Schema Markup (0-15) | 9/15 | `RealEstateAgent`, `WebSite`, `ItemList`, `Offer`+`Apartment`, `BreadcrumbList` presentes; falta `FAQPage`, `Review`/`AggregateRating`, variantes locales |
| Media Richness (0-15) | 8/15 | Ficha real con galería de 10 fotos (buena); tarjetas del catálogo no verificables con datos reales |
| Authority Signals (0-15) | 4/15 | Sin testimonios, casos de éxito, cifras, credenciales de equipo; correo de contacto en Gmail |
| Freshness (0-10) | 4/10 | Sitemap declara `changefreq daily` pero no hay fechas visibles de actualización en fichas ni contenido |

---

## 7. Acciones prioritarias (ordenadas por oportunidad)

1. **Crear páginas indexables por ciudad/tipo** (ej. `/inmuebles/bogota`, `/inmuebles/apartamentos-en-bogota`) con `<title>`, H1, meta description y canonical propios — resuelve la persona más débil (comprador por ciudad, 45/100) y es el hallazgo raíz de mismatch.
2. **Agregar todas las fichas individuales al sitemap.xml** (hoy solo tiene 4 URLs) para asegurar descubrimiento/indexación independiente del enlazado interno.
3. **Corregir la inconsistencia de datos en la ficha** (habitaciones 3 vs 4) y el error "BogotÁ" — impacto directo en confianza y en citabilidad para IA generativa (GEO).
4. **Reescribir la meta description de las fichas** a 150-160 caracteres, sin emojis/saltos de línea, orientada a CTR (ubicación + precio + diferenciador), separando ese campo del texto operativo de WhatsApp.
5. **Añadir contenido/herramienta de "¿cuánto vale mi apartamento?"** en `/vender` (aunque sea un rango estimado + CTA a WhatsApp) para capturar el clúster de intención tipo-herramienta que hoy no tiene página.
6. **Sumar señales de autoridad**: testimonios, cifras ("X inmuebles vendidos", "tiempo promedio de venta"), correo con dominio propio en vez de Gmail — ataca el problema sistémico de Trust (12-13/25 transversal).
7. (Prioridad baja, audiencia terciaria) Dar a la propuesta de agentes un mensaje de WhatsApp precargado específico y, si el volumen de alianzas lo justifica, una sección/página propia en vez de una frase al pie del home.

---

## Limitaciones

- Sin acceso a SERPs reales (Google/Search Console) desde el sandbox; los "consensos SERP" son hipótesis basadas en conocimiento del sector, marcadas explícitamente como tales.
- El espejo local devolvió 0 inmuebles en `/` y `/inmuebles` (probable falta de datos semilla), por lo que no se pudo evaluar el diseño real de las tarjetas del catálogo, el comportamiento visual de los filtros con resultados, ni el copy de precio/foto en el listado — solo se evaluó la estructura (schema `ItemList`, HTML de filtros, mensajes de estado vacío).
- El fetch de `/`, `/inmuebles`, `/vender`, `/contacto` se hizo con `curl -s` (HTML sin ejecutar JS) según instrucción explícita del espejo local; no se verificó si hay contenido adicional que solo aparece tras hidratación en el navegador real más allá de lo ya confirmado como server-rendered (header, WhatsApp flotante, formularios).
- La ficha de Bella Suiza es la única página de detalle de inmueble analizada (dato real de producción); no se pudo comparar contra otras fichas del portafolio de ~7 inmuebles para saber si los defectos de datos (habitaciones inconsistentes, capitalización) son sistémicos de la plantilla o puntuales de este registro.
