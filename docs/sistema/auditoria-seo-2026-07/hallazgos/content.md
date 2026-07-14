# Auditoría de Contenido / E-E-A-T — CIC Inmuebles

**Puntuación de calidad de contenido: 40/100**

Metodología: se auditaron las 4 páginas estáticas vía `curl` contra el espejo local (`/`, `/inmuebles`, `/vender`, `/contacto`), la ficha real de producción (`bella-suiza`, HTML renderizado provisto), y el código fuente en `src/app/(public)/` y `src/components/public/` para confirmar si los hallazgos son puntuales o sistémicos (aplicables a todo el catálogo).

---

## 1. [CRÍTICO] Ausencia total de señales de confianza y "Sobre nosotros" (E-E-A-T: Trust/Authority)

**Evidencia:**
- No existe ninguna página `/nosotros`, `/sobre-nosotros`, `/quienes-somos` ni componente equivalente. Búsqueda en `src/app/` y `src/components/public/` de "nosotros", "historia", "equipo", "about" y "testimonio"/"reseña" no arroja ninguna página ni sección dedicada (solo 2 usos incidentales de la palabra "nosotros" en frases sueltas del home).
- El único contacto público es un correo **Gmail genérico** (`cc.inmuebles@gmail.com`, definido en `src/lib/config/site.ts`), no un correo de dominio propio (`@cicinmuebles.com`), lo cual es una señal débil de institucionalidad para un negocio que gestiona transacciones de alto valor.
- La única "cobertura" mostrada es la palabra `"Colombia"` (`siteConfig.city`) — no hay dirección física, NIT/registro mercantil, ni cifras de trayectoria (años operando, inmuebles vendidos, clientes atendidos).
- No hay testimonios, reseñas ni casos de éxito en ninguna página.
- `siteConfig.social.instagram` / `.facebook` están vacíos por defecto (sin perfiles configurados), eliminando otra señal externa de autoridad/actividad.

**Por qué importa:** la compra/venta de un inmueble es una decisión financiera mayor; sin biografía del equipo, trayectoria, dirección o testimonios, el sitio no supera la prueba "Who/How/Why" de Google para contenido útil, y un LLM no tiene nada citable para responder "¿quién es CIC Inmuebles y es confiable?".

**Recomendación:** crear una página "Sobre nosotros" con historia real del negocio, fundadores/equipo (si aplica), años operando, número de inmuebles gestionados, zonas de cobertura reales, y testimonios verificables. Usar un correo de dominio propio. Añadir dirección/zona de oficina si existe. (No inventar cifras: si el negocio no tiene estos datos aún, documentarlo como tarea pendiente antes de publicar la página).

---

## 2. [CRÍTICO] Metadatos de ficha de inmueble = texto crudo sin curaduría editorial (bug sistémico, no puntual)

**Evidencia (ficha real `bella-suiza` en producción):**
- `<title>`: `Bella Suiza | CIC Inmuebles` — solo el nombre del conjunto, sin tipo de inmueble, ciudad ni habitaciones.
- `<meta name="description">`: `🏡 Ficha Técnica del Apartamento` — 32 caracteres, empieza con emoji, no menciona precio, ubicación, habitaciones ni ciudad. Muy por debajo del largo recomendado (~150-160 car.) y sin ningún gancho para CTR.
- Causa raíz confirmada en código, `src/app/(public)/inmuebles/[slug]/page.tsx` líneas 60-71:
  ```ts
  return {
    title: property.titulo,
    description: property.descripcion,
    ...
  };
  ```
  El `<title>` y meta description usan directamente los campos libres `titulo`/`descripcion` que carga el asesor (estilo ficha de WhatsApp con emojis), sin plantilla SEO. Esto aplica a **todas** las fichas del catálogo, no solo a este ejemplo — es el problema de contenido de mayor impacto porque las fichas son las páginas con intención de búsqueda más alta ("apartamento en venta en [barrio]").

**Recomendación:** generar `title`/`description` con una plantilla server-side independiente del campo de descripción libre, ej.: `title: "{tipo} en venta en {sector}, {ciudad} — {habitaciones} hab, {area} m² | CIC Inmuebles"` y `description` a partir de un resumen curado (precio, ubicación, habitaciones, un rasgo destacado), truncado a ~155 caracteres, en vez de tomar los primeros caracteres del campo `descripcion`.

---

## 3. [ALTO] Descripción de ficha = ficha técnica en emojis, no contenido editorial (riesgo de duplicidad estructural + Experience débil)

**Evidencia (texto real de `bella-suiza`):**
> "🏡 Ficha Técnica del Apartamento 📍 Apartamento en venta 💰 Valor: $850.000.000 🏢 Administración: $950.000 📐 Área: 128 m² 🛏️ Habitaciones: 3 🚿 Baños: 3 🧹 Cuarto y baño de servicio 🛋️ Sala comedor amplia 🔥 Chimenea 👨‍👩‍👧 Family room 📚 Estudio 🧺 Zona de lavandería 🌿 Balcón 🚗 Parqueaderos: 2 en línea 📦 Depósito 🛡️ Vigilancia 24/7 ✨ Apartamento amplio, cómodo y funcional..."

Es una lista de datos con emojis como viñetas (formato típico de mensaje de WhatsApp de un agente), no una descripción redactada. No hay narrativa sobre el sector/barrio, el edificio, la luz natural, la vista, cercanía a servicios, ni ningún elemento de "experiencia directa" (visita, fotos comentadas, opinión del asesor). Si este mismo patrón de plantilla se repite en cada inmueble (el encabezado literal "Ficha Técnica del Apartamento" sugiere un hábito/plantilla de captura), el catálogo completo corre riesgo de contenido casi-duplicado en estructura, aunque los datos cambien.

**Recomendación:** definir una guía editorial mínima para las descripciones que cargan los asesores: 2-3 frases de contexto de la zona/edificio + lista de características (los emojis pueden mantenerse como apoyo visual, no como único contenido), evitando que la ficha sea solo una lista de specs ya mostrada en las tarjetas de la página.

---

## 4. [ALTO] Inconsistencia factual dentro de la misma ficha (confianza y citabilidad IA)

**Evidencia:** en la ficha `bella-suiza`, la tarjeta de especificaciones (generada desde `property.caracteristicas`) muestra **Habitaciones: 4 / Baños: 4**, pero el cuerpo de la descripción (texto libre) dice **"🛏️ Habitaciones: 3 🚿 Baños: 3"**. Ambos datos están en la misma página.

**Por qué importa:** un usuario o un motor de IA que lea la página encuentra dos respuestas distintas a "¿cuántas habitaciones tiene?" — esto es exactamente el tipo de señal que reduce confianza (Trustworthiness) y hace que un sistema de IA generativa evite citar la página por datos contradictorios.

**Recomendación:** validar en el formulario de carga que el texto libre no contradiga los campos estructurados, o mejor, no repetir specs numéricos dentro del texto libre (dejar que la tarjeta de specs sea la única fuente de verdad) y limitar el texto libre a contexto cualitativo.

---

## 5. [ALTO] Contenido por debajo de los mínimos de cobertura temática en páginas clave

**Evidencia (conteo de palabras de texto visible, excluyendo HTML):**

| Página | Palabras (texto visible) | Mínimo orientativo | Estado |
|---|---|---|---|
| Home (`/`) | ~345 | 500 | Por debajo |
| Catálogo (`/inmuebles`) | ~175 (estado vacío de sandbox) | 500-600 | Muy por debajo, sin copy editorial de respaldo |
| Vender (`/vender`) | ~220 | 800 (página de servicio) | Muy por debajo |
| Contacto (`/contacto`) | ~149 | — (bajo esperado en esta plantilla) | Aceptable para su tipo |
| Ficha (`bella-suiza`) | ~257 (todo el texto de la página, incl. nav/footer) | 300+ | Al límite, y gran parte es boilerplate de header/footer repetido |

`/vender` en particular es la página que más debería profundizar (es la página de captación de propietarios, el otro público objetivo del negocio) y hoy solo tiene 4 tarjetas de una frase cada una ("Mayor exposición", "Presentación profesional", "Gestión completa", "Acompañamiento legal") sin explicar el proceso paso a paso, plazos típicos, documentos requeridos, ni cómo funciona la promesa de compraventa que se menciona. `/inmuebles` no tiene ningún párrafo introductorio de apoyo SEO (solo filtros + grilla dinámica), por lo que en el estado vacío de sandbox la página queda casi sin contenido rastreable.

**Recomendación:** añadir un bloque editorial corto (80-150 palabras) en `/inmuebles` explicando el enfoque del catálogo (tipos de inmueble, ciudades típicas, criterios de selección) y ampliar `/vender` con una sección de proceso detallado + aspectos legales/tributarios básicos de vender en Colombia (sin inventar cifras o garantías que el negocio no ofrezca realmente).

---

## 6. [MEDIO] No hay FAQ ni contenido en formato pregunta-respuesta (débil para GEO/IA)

**Evidencia:** ninguna de las 4 páginas ni la ficha de inmueble tiene sección de preguntas frecuentes; no se detectó schema `FAQPage` ni `QAPage` en ningún JSON-LD revisado (`WebSite`, `Offer`, `BreadcrumbList`, `PostalAddress`, `QuantitativeValue`).

**Por qué importa:** preguntas como "¿cómo funciona la comisión 50/50 con agentes?", "¿qué documentos necesito para vender mi apartamento en Colombia?", "¿cuánto tarda el proceso de venta?" son consultas de alta intención que hoy no tienen una respuesta directa y citable en el sitio — ni para usuarios ni para AI Overviews/ChatGPT/Perplexity.

**Recomendación:** agregar un bloque FAQ en `/vender` (proceso, tiempos, documentos, comisión) y uno en `/contacto` o home (cobertura, cómo agendar visita), redactado en formato pregunta-respuesta directa, sin necesidad de fabricar datos: usar únicamente información que el negocio ya comunica hoy por WhatsApp.

---

## 7. [MEDIO] Sin páginas de ciudad/sector ni contenido de guía de compra (oportunidad de keywords no explotada)

**Evidencia:** `ciudad` es un campo de texto libre por inmueble (`src/lib/domain/property.ts`), sin páginas dedicadas del tipo `/inmuebles/bogota` o `/inmuebles/medellin`, ni artículos tipo "guía para comprar apartamento en Bogotá". Todo el posicionamiento de ciudad depende de que existan inmuebles activos en esa ciudad en el catálogo dinámico.

**Recomendación:** evaluar páginas o secciones por ciudad/sector principales donde CIC Inmuebles ya opera (solo para ciudades donde el negocio tenga presencia real, no crear páginas vacías), y contenido de guía de compra/venta ("qué revisar antes de comprar apartamento usado", "documentos para vender tu casa en Colombia") como oportunidad de contenido a mediano plazo.

---

## 8. [BAJO] H1 y anchors de ficha usan solo el nombre del proyecto, sin tipo+ubicación

**Evidencia:** el H1 de la ficha es literalmente `property.titulo` (ej. "Bella Suiza"), igual que el `<title>` y el texto del `<h3>` en las tarjetas del catálogo (`src/components/public/property-card.tsx`). Ninguno combina tipo de inmueble + sector/ciudad, que es como realmente buscan los usuarios ("apartamento en venta Bella Suiza Bogotá").

**Recomendación:** mantener `property.titulo` (nombre del conjunto) como dato, pero componer un H1/anchor de cara a SEO que anteponga tipo+ubicación, ej. "Apartamento en venta en Bella Suiza, Bogotá".

---

## Aspectos positivos detectados (para contexto, no requieren acción)

- Jerarquía de encabezados correcta: un solo `<h1>` por página en las 4 páginas estáticas y en la ficha revisada; sin saltos de nivel evidentes.
- Metadatos `title`/`description` de las páginas estáticas (`/`, `/inmuebles`, `/vender`, `/contacto`) son únicos entre sí y cubren de forma natural las palabras clave objetivo ("apartamentos y casas en venta en Colombia", "vende tu inmueble", etc.), sin keyword stuffing.
- El catálogo (`/inmuebles`) fija `alternates: { canonical: "/inmuebles" }` de forma estática, evitando contenido duplicado por combinaciones de filtros en query string — buena práctica ya implementada.
- Existe JSON-LD (`WebSite`, `Offer`, `BreadcrumbList`) en home y fichas, base útil para citabilidad de IA una vez se resuelvan los huecos de contenido de este informe.
