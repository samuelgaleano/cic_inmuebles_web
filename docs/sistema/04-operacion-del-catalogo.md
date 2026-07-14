# 4. Operación del catálogo

El recorrido de un inmueble desde que llega hasta que se publica. Aquí se
resume el flujo; el detalle técnico paso a paso está en
[`../PROCESO.md`](../PROCESO.md) y [`../ESTRUCTURA-DRIVE.md`](../ESTRUCTURA-DRIVE.md).

## Ciclo de vida de un inmueble

```
1. CAPTAR        2. DOCUMENTAR         3. IMPORTAR       4. PUBLICAR      5. VENDER
   ──────           ──────────            ────────          ────────         ──────
 Propietario     Carpeta en Drive       Panel admin →     Revisar y        Comprador
 o agente        (Código - Nombre)      "Importar de      pasar de         contacta por
 deja el         + fotos                Drive" →          BORRADOR a        WhatsApp →
 inmueble        + especificaciones.md  Escanear          PUBLICADO         visita → cierre
```

## Las 3 fuentes de datos (y qué hace cada una)

| Fuente | Rol | Regla |
|--------|-----|-------|
| **Google Drive** | Guarda **fotos** y la ficha `especificaciones.md` de cada inmueble | Estructura `ciudad → estado → inmueble` (ver `ESTRUCTURA-DRIVE.md`) |
| **Supabase** | Base de datos: es la **fuente de verdad** del catálogo publicado | El sitio lee de aquí |
| **Google Sheets** | **Espejo/exportación** legible del catálogo | Para revisar de un vistazo; incluye la URL pública de cada inmueble |

## Estados de un inmueble

| Estado | Significa | ¿Sale en el sitio? |
|--------|-----------|--------------------|
| **Borrador** (no publicado) | Importado, pendiente de revisar | ❌ No |
| **Disponible** | Publicado y a la venta | ✅ Sí |
| **En proceso** | En negociación / reservado | ✅ Sí (con distintivo) |
| **Vendido** | Cerrado | ✅ Sí (marcado como vendido) |

> En schema.org esto se traduce a `InStock` / `LimitedAvailability` / `SoldOut`
> automáticamente. **No hace falta hacer nada manual** para eso.

## Checklist para publicar un inmueble bien

- [ ] Carpeta en Drive nombrada `Código - Nombre` (ej. `1006 - Palmeira Mazurén`).
- [ ] Fotos subidas (la primera en orden es la portada). Fotos reales, buena luz.
- [ ] `especificaciones.md` llena con datos **verificados** (usar
      [`../plantilla-especificaciones.md`](../plantilla-especificaciones.md)).
- [ ] Ciudad escrita bien (**"Bogotá"**, no "BogotÁ" ni "bogota").
- [ ] Habitaciones/baños **coinciden** entre las specs y la descripción.
- [ ] Precio correcto.
- [ ] Importado en el panel → revisado → **publicado**.
- [ ] Verificar que aparece en `www.cicinmuebles.com/inmuebles`.

## Calidad de datos (por qué importa para el SEO)

Los datos del catálogo alimentan directamente los títulos de Google, los datos
estructurados y el sitemap. Un error en el Sheet **se propaga a todo el sitio**.
Por eso la limpieza de datos (ciudad bien escrita, specs coherentes) es parte
de la operación, no un extra.

> Errores detectados en la auditoría a corregir en el Sheet: `"BogotÁ"` →
> `"Bogotá"`, y el inmueble *Bella Suiza* que dice 4 habitaciones en las specs
> pero 3 en el texto libre.
