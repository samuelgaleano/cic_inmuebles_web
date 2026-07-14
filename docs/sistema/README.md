# Sistema CIC Inmuebles — mapa general

Este es el **panel de control** de la empresa: un solo lugar desde donde se ve
cómo está organizado todo y a dónde ir para cada cosa. Está pensado para
consultarse de forma continua, no para leerse una vez.

> **Sitio en producción:** https://www.cicinmuebles.com
> **Modelo:** inmobiliaria boutique, **solo venta**, enfocada en Bogotá y Colombia.
> **Contacto del negocio:** WhatsApp/tel. +57 324 907 1717 · cc.inmuebles@gmail.com

---

## Las 4 piezas del sistema

| # | Pieza | Para qué sirve | Documento |
|---|-------|----------------|-----------|
| 1 | **Modelo de negocio** | Qué vende la empresa, a quién y cómo gana dinero | [`01-modelo-de-negocio.md`](./01-modelo-de-negocio.md) |
| 2 | **Sistema SEO** | Cómo el sitio aparece en Google y en las IA, y cómo se mantiene | [`02-sistema-seo.md`](./02-sistema-seo.md) |
| 3 | **Sistema de contenido** | Qué se publica, con qué plantilla y en qué orden | [`03-sistema-de-contenido.md`](./03-sistema-de-contenido.md) |
| 4 | **Operación del catálogo** | El recorrido de un inmueble: de Drive a publicado | [`04-operacion-del-catalogo.md`](./04-operacion-del-catalogo.md) |

Y dos documentos que hacen que el sistema **se sostenga en el tiempo**:

| Pieza | Para qué sirve | Documento |
|-------|----------------|-----------|
| **Tablero y cadencia** | Qué revisar, cada cuánto y quién | [`05-tablero-y-cadencia.md`](./05-tablero-y-cadencia.md) |
| **Plan de acción** | Tareas pendientes con responsable y estado | [`06-plan-de-accion.md`](./06-plan-de-accion.md) |

---

## Cómo fluye la empresa (una mirada)

```
   CAPTACIÓN                    OPERACIÓN                     VENTA
   ─────────                    ─────────                     ─────
 Propietario ─┐
              ├─► /vender ──► Lead ──► Drive (fotos+ficha) ──► Sheet ──► Panel admin
 Agente ──────┘   (WhatsApp)         │                                    │
                                     └──────► Importar ──► BORRADOR ──► PUBLICAR
                                                                          │
 Comprador ──► Google / IA ──► cicinmuebles.com ──► Ficha ──► WhatsApp ──► Visita ──► Cierre
```

- **Entra por SEO** (Google, AI Overviews) → lo cubre el **Sistema SEO** (pieza 2).
- **Se convierte por WhatsApp** → botón flotante en todas las páginas.
- **El catálogo se alimenta desde Drive/Sheet** → lo cubre la **Operación** (pieza 4).

---

## Documentación de apoyo (ya existente)

El sistema se apoya en los documentos técnicos que ya existían en `docs/`:

- [`../ARQUITECTURA.md`](../ARQUITECTURA.md) — decisiones técnicas (costo ≈ 0, catálogo sincronizado).
- [`../PROCESO.md`](../PROCESO.md) — flujo operativo detallado y puntos de verificación.
- [`../ESTRUCTURA-DRIVE.md`](../ESTRUCTURA-DRIVE.md) — cómo se organiza el Drive de inmuebles.
- [`../PUESTA-EN-MARCHA.md`](../PUESTA-EN-MARCHA.md) — pasos manuales de configuración (Vercel, Google, Supabase).
- [`../ACTIVACION.md`](../ACTIVACION.md) — variables de entorno por servicio.
- [`../plantilla-especificaciones.md`](../plantilla-especificaciones.md) — ficha que se llena por inmueble.

---

## Estado actual (2026-07-14)

| Indicador | Estado |
|-----------|--------|
| Sitio en producción | ✅ En línea en www.cicinmuebles.com |
| Salud SEO (auditoría) | 🟡 68/100 (base sólida; crece con contenido y autoridad) |
| Inventario publicado | 7 inmuebles |
| Google Search Console | ⚠️ Pendiente de registrar (**tarea nº1**) |
| Google Business Profile | ⚠️ Pendiente de crear |
| Redes sociales | ⚠️ Pendientes |

> Detalle completo en el [Informe SEO](./06-plan-de-accion.md) y el PDF `Informe-SEO-CIC-Inmuebles.pdf`.
