# Imágenes del sitio

Evaluación de noviembre de 2026 contra la guía oficial de `next/image` de Next 16.4.5
(`node_modules/next/dist/docs/01-app/03-api-reference/02-components/image.md`).

## Cómo funciona

- Toda `<Image>` pasa por `SafeImage` (`src/components/ui/safe-image.tsx`), que le pone el loader
  propio `mediaLoader` (`src/lib/utils/image-loader.ts`).
- **Cloudinary** transforma en el origen: `f_auto,q_auto,c_limit,w_<ancho>`.
- **Drive** (lh3) usa su parámetro `=w<ancho>`.
- **YouTube** (`i.ytimg.com`) y cualquier otra URL pasan tal cual.
- El optimizador de Vercel (`/_next/image`) no se usa nunca. Su cuota en Hobby es de 5.000
  transformaciones al mes.

## Lo que se evaluó

| Pieza | Antes | Ahora |
|---|---|---|
| Ancho máximo pedido al origen | Sin tope: el srcset llegaba a 3.840 px | **1.600 px** (`ANCHO_MAXIMO`). Las fotos de Drive entran a 1.600: pedir más no agrega detalle |
| `deviceSizes` | Los de Next (hasta 3.840): 3 de cada 9 variantes eran la misma foto | `[640, 750, 828, 1080, 1200, 1600]`, la misma lista que usa el precargado del visor |
| Optimizador `/_next/image` | Abierto para la cuenta propia de Cloudinary: cualquiera podía gastar cuota con foto × ancho | **Apagado** con `images.loader: "custom"` (Next responde 404, ver `next-server.js`) y `remotePatterns: []` |
| Foto principal de la ficha | `loading="eager"` + `fetchPriority="high"` | `preload`: es el LCP en todos los anchos (primera de la tira en móvil, la grande del mosaico en escritorio). La guía lo recomienda para la imagen principal sobre el pliegue |
| Fotos de «parecidos» de la ficha | Las 3 con carga anticipada y prioridad alta, compitiendo con la principal | Diferidas (`RejillaInmuebles conPrioridad={0}`) |
| Tira de la portada (bajo el hero) | 2 tarjetas con prioridad alta | Diferidas. La única foto prioritaria de la portada es la del hero |
| `sizes` de la galería | Valores fijos para la primera foto y para las demás | Según la celda real del mosaico: 4, 2 o 1 columna dentro de la caja de 75rem |
| `sizes` de las tarjetas | `100vw` en móvil | Descuenta el margen de la caja; la rejilla de 3 columnas mide ≈ 370 px |
| Miniatura del video | srcset con 9 copias de la misma URL de YouTube | `unoptimized`: una sola petición |
| Texto alternativo de la galería | «Título — foto N» | «Apartamento en Bella Suiza, Bogotá — foto 3 de 12» (tipo, sector, ciudad y número) |
| Open Graph | Declaraba 1200×630 aunque la foto no viniera recortada | Las medidas solo se declaran con Cloudinary, que sí la recorta. Drive pide `=w1200` sin medidas |

Sin cambios, porque ya estaban bien:

- La foto del hero: `loading="eager"` y `fetchPriority="high"` solo en la primera. Sus `sizes` son
  `92vw` y luego 540 px, y la columna mide unos 525 px.
- Las miniaturas del buscador, los pasos y el comparador: `sizes` fijos y pequeños.
- El visor a pantalla completa: `100vw`, que el tope deja en 1.600 px.

## Regla para código nuevo

- Usar siempre `SafeImage`. Con `loader: "custom"`, una `<Image>` de `next/image` sin loader **falla al
  renderizar**.
- `preload` solo para la imagen principal de la página. Las de más abajo quedan diferidas, que es lo que
  hace Next por defecto.
- Dar `sizes` con el ancho real del contenedor. Sin `sizes`, el navegador asume `100vw`.

## Pendiente

- **Cloudinary**: el preset de subida es sin firmar, así que cualquiera puede subir archivos a la
  cuenta. Hay que pasarlo a subida firmada. Está en la consultoría y no es de este cambio.
- **Drive en Open Graph**: lh3 permite recortar con `=w1200-h630-c`, pero no se probó en producción.
  Hoy esas fichas comparten la foto sin recortar.
- **Catálogo y favoritos**: siguen dando prioridad a las 3 primeras tarjetas. Están arriba de la
  página, pero se puede medir en PageSpeed si con solo la primera mejora el LCP.
- **Medir**: PageSpeed Insights de una ficha y de la portada, antes y después del despliegue, para
  confirmar el efecto del `preload` y del tope de 1.600 px.
