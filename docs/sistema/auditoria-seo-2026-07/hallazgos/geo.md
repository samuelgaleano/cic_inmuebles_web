# Auditoría GEO (Generative Engine Optimization) — CIC Inmuebles

Sitio: cicinmuebles.com (inmobiliaria de venta, Colombia, español) · sitio nuevo, sin
autoridad, sin backlinks. Fuentes: espejo local `http://localhost:3110` (curl, 4 páginas:
`/`, `/inmuebles`, `/vender`, `/contacto`), código fuente `/home/user/cic_inmuebles_web`,
ficha real de producción `/inmuebles/bella-suiza` (snapshot pre-fix de dominio,
`prod-ficha-bella-suiza.txt`). Marco de referencia: `~/.claude/agents/seo-geo.md` +
`/root/.claude/skills/seo-geo/SKILL.md` (incl. `google-ai-optimization-guide.md` y
`llmstxt-evidence.md`) + `seo-technical/references/agent-friendly-pages.md`.

**GEO Readiness Score: 42/100**

Nota de calibración: Google (guía oficial de optimización para IA, referenciada en el
SKILL) sostiene que GEO/AEO es "SEO con otro nombre" — no existe un índice de IA aparte;
la elegibilidad para AI Overviews/AI Mode exige estar indexado en Search normal. Este
informe evalúa por tanto señales de SEO fundamentals con lente de citabilidad por IA, no
"trucos" específicos de IA.

| Dimensión | Peso | Puntuación | Nota |
|---|---|---|---|
| Citabilidad (pasajes) | 25% | 30/100 | Sin bloques de respuesta directa ni FAQ |
| Estructura amigable a agentes | 20% | 50/100 | Jerarquía H1-H3 correcta, cero preguntas, cero tablas |
| Contenido multi-modal | 15% | 50/100 | Galería + video en fichas; páginas estáticas solo texto/iconos |
| Autoridad y señales de marca | 20% | 20/100 | Schema RealEstateAgent sin `sameAs`; sin presencia externa (nuevo) |
| Accesibilidad técnica para IA | 20% | 55/100 | SSR real y robots.txt abierto, pero riesgo crítico de `noindex` sin confirmar en prod |

---

## Acceso de crawlers de IA (robots.txt)

`src/app/robots.ts` (confirmado también en `curl http://localhost:3110/robots.txt`):

```
User-Agent: *
Allow: /
Disallow: /admin
Sitemap: https://cicinmuebles.com/sitemap.xml
```

Política actual = **todo permitido** para cualquier user-agent, incluidos GPTBot,
OAI-SearchBot, ChatGPT-User, ClaudeBot, PerplexityBot, Google-Extended, CCBot,
anthropic-ai, Bytespider, cohere-ai. No hay bloqueo explícito de ningún crawler de IA.
Para un sitio nuevo que necesita toda la exposición posible, esto es correcto — no se
recomienda restringir nada todavía. Como mejora menor (coste cero, prioridad baja): listar
explícitamente `GPTBot`, `ClaudeBot`, `PerplexityBot`, `Google-Extended` con `Allow: /` deja
la política auditable en vez de implícita en el wildcard, útil cuando en el futuro se quiera
bloquear selectivamente crawlers de solo-entrenamiento (CCBot, anthropic-ai) sin tocar los
de búsqueda/citación.

### ⚠️ Riesgo crítico que anula lo anterior (verificación pendiente)

La captura real de producción de `/inmuebles/bella-suiza` (antes del fix de dominio)
devolvió el header HTTP **`x-robots-tag: noindex`** (`prod-ficha-bella-suiza.txt`, no viene
del código: `grep -rn "x-robots-tag" src/` no tiene coincidencias fuera de
`admin/login/page.tsx`). El equipo técnico ya documentó esto en `findings/technical.md`
como hallazgo crítico de SEO clásico; se repite aquí porque **aplica igual a crawlers de
IA**: `X-Robots-Tag: noindex` es una directiva a nivel HTTP que la mayoría de crawlers que
respetan REP (incluido GPTBot, que documenta soporte de robots directives) obedecen sin
mirar el robots.txt del sitio ni el HTML. Si esta cabecera persiste en `cicinmuebles.com`
(hipótesis: dominio custom aún no promovido a "Production" en Vercel, o Deployment
Protection activa), **todas las fichas de inmuebles — el contenido con mayor potencial de
cita — quedan invisibles para IA y buscadores por igual**, sin importar cuánto se optimice
el contenido. Verificar con `curl -sI https://cicinmuebles.com/inmuebles/<slug>` es la
acción de coste cero más urgente de todo el audit.

---

## llms.txt

No existe `/llms.txt` (confirmado: `find` sobre el repo sin resultados; `curl` a rutas
esperadas no aplica porque no hay build de prod accesible, pero tampoco hay ninguna ruta ni
archivo estático en `public/` ni generador en `src/app`).

Postura basada en evidencia primaria (`llmstxt-evidence.md`): John Mueller y Gary Illyes
(Google) han declarado que ningún sistema de IA relevante consume hoy `/llms.txt`; el
estudio de SE Ranking sobre 300k dominios encontró solo 1 de los 50 dominios más citados
por IA con `llms.txt`; los logs de OtterlyAI muestran 0.1% de tráfico de bots de IA hacia
ese archivo. **No se reporta como palanca de ranking/citación.** Dicho esto, es contenido
de coste absolutamente cero (un archivo Markdown estático) y tiene valor defensivo/opcional
(agentes de código como Cursor/Claude Code sí lo consumen para documentación). Recomendación:
crear un `/llms.txt` mínimo, sin presentarlo como mejora de citación:

```markdown
# CIC Inmuebles
> Inmobiliaria colombiana especializada en venta de apartamentos y casas.

## Páginas principales
- [Inicio](https://cicinmuebles.com/): resumen de la propuesta de valor y cómo funciona
- [Catálogo de inmuebles](https://cicinmuebles.com/inmuebles): apartamentos y casas en venta, con filtros
- [Vender mi inmueble](https://cicinmuebles.com/vender): proceso para propietarios que quieren vender
- [Contacto](https://cicinmuebles.com/contacto): WhatsApp +57 324 907 1717, cc.inmuebles@gmail.com

## Datos clave
- Cobertura: Colombia (venta únicamente, no arriendo)
- Contacto directo por WhatsApp
```

---

## Citabilidad por pasajes (¿responde preguntas directas?)

Analizado con texto extraído (boilerplate fuera) de las 4 páginas + la ficha real:

- **Home (`/`)**: copy de marketing puro ("De la búsqueda a las llaves, en tres pasos"),
  sin datos concretos, sin fechas, sin cifras verificables. Cero pasajes autocontenibles
  de 134-167 palabras que respondan una pregunta.
- **`/vender`**: es un formulario de captación + 4 bullets de ~10 palabras cada uno
  ("Mayor exposición", "Presentación profesional", "Gestión completa", "Acompañamiento
  legal"). **No hay ninguna respuesta real a "¿cómo vender mi apartamento en Colombia?"**
  — ni trámites (promesa de compraventa, paz y salvo, boletín catastral), ni tiempos, ni
  costos/comisión, ni documentos requeridos. Esta es la brecha de mayor impacto: es
  exactamente el tipo de contenido único de primera mano que Google señala como el
  diferenciador real para AI Overviews/AI Mode (vs. contenido "commodity"), y el negocio ya
  tiene ese conocimiento (lo transmite hoy por WhatsApp) — solo falta escribirlo.
- **Ficha de inmueble** (`bella-suiza`, prod): la descripción es una lista de emojis y
  datos en un único `<p className="whitespace-pre-line">` (confirmado en
  `src/app/(public)/inmuebles/[slug]/page.tsx:226-232`), no en HTML semántico (`<ul>`,
  `<table>`, `<dl>`). Es parcialmente extraíble (pares "campo: valor" en texto plano) pero
  no es una estructura de datos limpia para un LLM.
- **Contacto**: solo datos de NAP básicos (correo, teléfono, "Cobertura: Colombia"), sin
  dirección física — coherente con negocio sin oficina, pero deja el `PostalAddress` del
  schema con únicamente `addressCountry: "CO"` (sin ciudad), lo cual es una señal de
  entidad más débil que la que ya tienen datos (el negocio opera en ciudades específicas,
  visibles en el filtro de ciudad del catálogo).

**Cero encabezados en formato pregunta** en las 4 páginas (0 de 15 headings usa "¿...?").
Cero secciones FAQ. Cero tablas (`<table>`) en todo el sitio.

---

## Estructura amigable para agentes / IA

Positivo: jerarquía de encabezados correcta y consistente (H1 único por página, H2/H3
anidados sin saltos), listas `<ul>` para navegación, contenido 100% accesible sin JS —
confirmado con `curl` plano (sin renderizar JS) devolviendo el texto completo de las 4
páginas y de la ficha. Esto es la base técnica correcta que exige `agent-friendly-pages.md`
(el HTML crudo ya contiene todo lo citable; no depende de hidratación).

A mejorar (coste cero, solo HTML semántico, sin rediseño visual):
- Specs de la ficha (`habitaciones`, `baños`, `área`, `parqueadero`, `administración`) hoy
  son tarjetas `<div>` con ícono — visualmente claras pero no una tabla/`<dl>` real.
  Envolverlas en un `<dl>` (`<dt>`/`<dd>`) o `<table>` oculto/accesible mantiene el diseño
  visual y da a los crawlers un par campo-valor inequívoco.
- La descripción de la ficha como lista de emojis en un solo párrafo podría convertirse en
  una lista `<ul>` real (una `<li>` por característica) sin cambiar el copy, mejorando la
  extracción de pasajes.

---

## Señales de marca/entidad

- `RealEstateAgent` JSON-LD (`src/app/(public)/page.tsx`) está bien formado (name,
  description, url, telephone, email, image, address, areaServed, knowsLanguage) pero
  **no incluye `sameAs`** — no hay forma de que un LLM vincule la entidad "CIC Inmuebles"
  con perfiles externos.
- `siteConfig.social.instagram` / `.facebook` existen en `src/lib/config/site.ts:33-36`
  como variables de entorno, pero **están vacías por defecto y no se usan en ningún
  componente** (`grep` sobre `src/` no encuentra referencias a `siteConfig.social` fuera de
  la propia definición) — ni footer, ni header, ni schema. Cero presencia verificable en
  redes desde el sitio.
- Dado que las correlaciones documentadas con citación en IA son: YouTube ~0.737
  (la más fuerte), Reddit alta, Wikipedia alta, Domain Rating/backlinks solo ~0.266 (la más
  débil) — y que solo el 11% de dominios son citados tanto por ChatGPT como por Google AI
  Overviews — para un sitio nuevo sin autoridad, **crear presencia real en Google Business
  Profile, Instagram y/o Facebook y enlazarla como `sameAs`** es de las pocas acciones de
  bajo/cero costo con potencial real de mover la aguja, más que perseguir backlinks.
- Nombre de marca consistente: "CIC Inmuebles" se usa igual en `<title>`, JSON-LD, footer y
  metadata — sin inconsistencias detectadas.

---

## Contenido multi-modal

Fichas de inmuebles soportan galería de imágenes y video embebido de YouTube
(`youtubeId()` en `[slug]/page.tsx`), lo cual está alineado con el +156% de tasa de
selección reportado para contenido multi-modal. Las páginas estáticas (home, vender,
contacto) son solo texto + iconografía — sin infografías, sin video, sin elementos
interactivos (más allá del formulario). No se recomienda invertir en esto todavía dado que
el sitio no tiene aún inventario/autoridad; es una mejora de fase posterior.

---

## Resumen por plataforma

- **Google AI Overviews / AI Mode**: bloqueado en la práctica mientras el header
  `x-robots-tag: noindex` no se descarte en prod; una vez resuelto, el sitio cumple el
  piso de elegibilidad (indexable, con snippet), pero compite con contenido "commodity" —
  necesita el contenido único de `/vender` (trámites Colombia) para captar pasajes.
- **ChatGPT** (cita Wikipedia 47.9%, Reddit 11.3%): sin presencia en ninguna de las dos
  fuentes hoy; no accionable a coste cero a corto plazo más allá de crear/enlazar perfiles.
- **Perplexity** (cita Reddit 46.7%, Wikipedia): mismo diagnóstico que ChatGPT.
- **Bing Copilot**: depende del índice de Bing; no evaluado en este audit (fuera del
  alcance del espejo local/ficha provista).

---

## Hallazgos priorizados (accionables, coste cero salvo donde se indique)

1. **[Crítico]** Confirmar en `cicinmuebles.com` real que el header `x-robots-tag: noindex`
   visto en el snapshot de prod de `/inmuebles/bella-suiza` no persiste (revisar que el
   dominio esté como Production en Vercel, no Preview/Deployment Protection). Bloquea a
   TODOS los crawlers de IA por igual, sin importar robots.txt. Ver detalle técnico en
   `findings/technical.md` #1.
2. **[Alto, coste cero]** `/vender` no responde ninguna pregunta real tipo "cómo vender mi
   apartamento en Colombia" — solo formulario + 4 bullets. Escribir 300-500 palabras con
   trámites reales (promesa de compraventa, documentos, tiempos, comisión) es la mayor
   oportunidad de citabilidad del sitio.
3. **[Alto, coste cero]** Cero encabezados en formato pregunta y cero FAQ en todo el sitio.
   Añadir 4-6 preguntas frecuentes reales (proceso de venta, comisión, cobertura, cómo
   agendar visita) con encabezados "¿...?" y respuesta autocontenida en las primeras 40-60
   palabras.
4. **[Medio, coste cero]** Schema `RealEstateAgent` sin `sameAs`; `siteConfig.social.*`
   definido pero vacío y nunca renderizado. Crear/enlazar Google Business Profile,
   Instagram o Facebook reales y añadirlos como `sameAs` — la señal de marca con mayor
   correlación documentada con citación en IA, más barata que perseguir backlinks.
5. **[Medio, coste bajo]** No existe `/llms.txt`. Sin peso de ranking según evidencia
   primaria (Mueller/Illyes/SE Ranking/OtterlyAI) — no vender como mejora de citación —
   pero es coste cero y da opcionalidad futura + ayuda a agentes de código. Plantilla
   incluida arriba.
6. **[Medio, coste cero]** Datos de la ficha (specs, descripción) viven en `<div>`/`<p>`
   sin semántica de tabla/lista real. Envolver specs en `<dl>` y descripción en `<ul>` sin
   cambiar el diseño visual mejora la extracción de pares campo-valor por LLMs.
7. **[Bajo, coste cero]** robots.txt usa wildcard `User-Agent: *` sin nombrar crawlers de
   IA explícitamente. No es un bloqueo (está bien para un sitio nuevo), pero nombrar
   GPTBot/ClaudeBot/PerplexityBot/Google-Extended deja la política auditable para cuando se
   quiera diferenciar crawlers de búsqueda vs. entrenamiento.
8. **[Positivo, mantener]** El sitio es SSR real: todo el texto de las 4 páginas y de la
   ficha es accesible con `curl` plano (sin ejecutar JS), y ya existe JSON-LD válido
   (`WebSite`, `RealEstateAgent`, `Offer`+`BreadcrumbList` en fichas, `ItemList` en
   catálogo). La base técnica para GEO está resuelta; el trabajo pendiente es de contenido
   y señales de entidad, no de renderizado.
