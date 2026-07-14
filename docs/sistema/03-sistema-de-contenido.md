# 3. Sistema de contenido

Qué se publica, con qué estructura y en qué orden. El objetivo es que el sitio
**responda lo que la gente busca** y **genere confianza**, sin improvisar cada
vez.

## Tipos de página (y su plantilla)

| Tipo | Intención que atiende | Estructura fija | Estado |
|------|----------------------|-----------------|--------|
| **Home** | Marca + descubrimiento | Hero → portafolio → cómo funciona → por qué CIC → captación | ✅ Publicada |
| **Catálogo** (`/inmuebles`) | "apartamentos en venta bogotá" | Filtros + grilla de inmuebles | ✅ Publicada |
| **Ficha** (`/inmuebles/[slug]`) | Inmueble concreto | Galería → specs → descripción → contacto | ✅ Publicada |
| **Vender** (`/vender`) | "vender mi apartamento" | Beneficios → formulario → FAQ | ✅ Publicada |
| **Contacto** | Navegacional | Canales + formulario | ✅ Publicada |
| **Sobre nosotros** | Confianza / E-E-A-T | Quiénes somos → trayectoria → equipo | ⚠️ **Pendiente (prioritaria)** |
| **Guías** (blog) | Informacional | Pregunta → respuesta paso a paso | ⚠️ Pendiente |
| **Página por ciudad/sector** | "apartamentos en [zona]" | Intro de zona + inmuebles de la zona | 🔒 Solo con 8-10 inmuebles/zona |

## Reglas de contenido (para no romper el SEO)

1. **Una intención por página.** No mezclar "comprar" y "vender" en la misma URL.
2. **Un solo `<h1>`** por página, con la keyword principal.
3. **Fichas:** la descripción debe ser **narrativa real** del inmueble (barrio,
   luz, distribución), no un volcado de ficha técnica con emojis. Los datos
   duros (habitaciones, área, precio) ya salen de los campos estructurados.
4. **Formato pregunta-respuesta** en guías y FAQ: cada respuesta autocontenida
   (así la citan Google y las IA).
5. **Sin contenido inventado.** Si no hay dato real, no se publica.
6. **No crear páginas de ciudad/sector** hasta tener inventario suficiente por
   zona (si no, es "contenido delgado" y perjudica).

## Hoja de ruta de contenido (orden recomendado)

Prioridad por impacto en confianza + búsqueda:

1. **"Sobre nosotros"** — cierra el mayor hueco de E-E-A-T. *(requiere: quiénes
   son, desde cuándo, foto/nombre de contacto, por qué confiar).*
2. **Ampliar `/vender`** — proceso paso a paso con tiempos reales del negocio.
3. **Guía "Cómo vender mi apartamento en Bogotá"** — capta intención de
   propietarios; enlaza a `/vender`.
4. **Guía "Documentos para vender un inmueble en Colombia"** — alta intención,
   muy citable por IA.
5. **Descripciones únicas** de cada ficha (reemplazar el texto tipo WhatsApp).
6. **Páginas por sector** (Bella Suiza, Cedritos, Alhambra…) cuando el
   inventario por zona lo justifique.

## Cómo se produce una pieza (flujo)

```
Idea (de esta lista) ─► Borrador con la plantilla del tipo de página
   ─► Revisión: ¿una intención? ¿un H1? ¿dato real? ¿responde una pregunta?
   ─► Publicar ─► (si es guía nueva) verificar que entra al sitemap
   ─► Anotar en el tablero (05) la fecha de publicación
```

> Para páginas nuevas de código (guías, "sobre nosotros") se puede pedir la
> implementación; el sistema de plantillas y SEO ya está montado para
> replicarlas rápido.
