# 1. Modelo de negocio

Define **qué es la empresa** para que todas las demás decisiones (contenido,
SEO, diseño) sean coherentes. Si algo no encaja aquí, no debería estar en el
sitio.

## Qué somos

**CIC Inmuebles** es una **inmobiliaria boutique** colombiana. "Boutique"
significa **pocos inmuebles, los correctos**: un portafolio corto, visitado y
verificado por nosotros, en vez de un catálogo masivo. Esa es la promesa de
marca y el diferenciador frente a portales grandes (Fincaraíz, Metrocuadrado).

- **Operación:** solo **venta** (no arriendo por ahora).
- **Cobertura:** Colombia, con inventario concentrado en **Bogotá** y alrededores.
- **Canal de conversión:** **WhatsApp** directo (+57 324 907 1717), sin intermediarios.

## A quién le hablamos (3 audiencias)

| Audiencia | Qué busca | Dónde la atendemos |
|-----------|-----------|--------------------|
| **Comprador** | Un inmueble concreto para comprar | Catálogo `/inmuebles` + fichas |
| **Propietario** | Vender su apartamento/casa sin complicaciones | `/vender` + WhatsApp |
| **Agente inmobiliario** | Un aliado que le ayude a mover su inmueble | `/vender` + `/contacto` |

## Cómo gana dinero

1. **Comisión de venta** de los inmuebles del portafolio propio.
2. **Alianza con agentes:** el agente trae el inmueble, CIC lo promociona y
   gestiona, y se **comparte la comisión 50/50**. Es una vía de crecimiento del
   inventario sin costo de captación.

## Prioridades permanentes (reglas del sistema)

Estas tres reglas mandan sobre cualquier decisión técnica o de contenido:

1. **Costo ≈ 0.** Toda la infraestructura debe ser gratuita o casi (Vercel,
   Supabase, Google Drive/Sheets, WhatsApp por enlace). Ver `../ARQUITECTURA.md`.
2. **Sin datos inventados.** Nunca se publican inmuebles, precios, reseñas ni
   cifras ficticias. El contenido refleja la realidad del negocio.
3. **Confianza primero.** Al ser boutique, la credibilidad (fotos reales,
   verificación, acompañamiento) es el activo central. Todo lo que la refuerce
   (reseñas, "sobre nosotros", correo propio) es prioritario.

## Cómo se traduce esto al sitio

| Decisión de negocio | Cómo se ve en el sitio |
|---------------------|------------------------|
| Boutique / pocos inmuebles | Hero "Pocos inmuebles. Los correctos.", portafolio corto |
| Solo venta | Todo el copy y el SEO dicen "en venta" (sin "arriendo") |
| WhatsApp-first | Botón flotante en todas las páginas + mensajes precargados |
| Alianza con agentes | Bloque "¿Eres agente inmobiliario? 50/50" en home y `/vender` |
| Confianza | (Pendiente) página "Sobre nosotros", reseñas, correo propio |
