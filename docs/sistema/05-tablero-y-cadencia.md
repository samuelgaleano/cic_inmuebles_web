# 5. Tablero y cadencia

Qué mirar, cada cuánto y quién. Sin una rutina, el sistema se abandona. Esta es
la parte que lo mantiene vivo.

## Qué medir (indicadores)

| Indicador | Dónde se mira | Qué es bueno |
|-----------|---------------|--------------|
| **Impresiones y clics** | Google Search Console | Que suban mes a mes |
| **Posición media** | Google Search Console | Que baje (posición 1 = mejor) |
| **Inmuebles indexados** | Search Console → Cobertura | Que estén todos los publicados |
| **Salud SEO** | `/seo audit` (mensual) | Subir desde 68/100 |
| **Core Web Vitals** | PageSpeed Insights / Search Console | Verde en móvil |
| **Leads (contactos)** | WhatsApp + formularios | Que crezcan con el tráfico |
| **Reseñas** | Google Business Profile | Cantidad y promedio subiendo |

> Casi todo se mide con herramientas **gratuitas** de Google. El primer paso
> para tener datos es registrar Search Console (ver `06-plan-de-accion.md`).

## Rutina de revisión (cadencia)

### Cada semana (~15 min)
- [ ] Revisar leads/mensajes de WhatsApp y responder.
- [ ] Publicar/actualizar inmuebles nuevos o vendidos en el panel.
- [ ] Mirar Search Console: ¿algún error de cobertura nuevo?

### Cada mes (~1 hora)
- [ ] Correr `/seo audit https://www.cicinmuebles.com` y comparar el puntaje.
- [ ] Revisar impresiones/clics/posición del mes en Search Console.
- [ ] Publicar **1 pieza de contenido** de la hoja de ruta (`03-...`).
- [ ] Pedir reseñas a los clientes que cerraron ese mes.

### Cada trimestre (~medio día)
- [ ] Revisar el plan de acción (`06-...`) y actualizar estados.
- [ ] Evaluar si ya hay inventario para páginas por ciudad/sector.
- [ ] Revisar precios/competencia del portafolio.
- [ ] ¿El modelo sigue siendo solo venta? (si vuelve arriendo, se planifica el cambio).

## Responsables (RACI simple)

Ajustar los nombres según el equipo real. La idea es que cada cosa **tenga
dueño**:

| Área | Responsable | Apoyo |
|------|-------------|-------|
| Captación y trato con clientes | Dueño / comercial | — |
| Publicar inmuebles (Drive + panel) | Operación | — |
| Contenido y SEO | Dueño (decide) | Claude/desarrollo (ejecuta) |
| Configuración técnica (Vercel, Google) | Desarrollo | — |
| Revisión mensual del tablero | Dueño | — |

## Cómo pedir mejoras al sitio

El código y el sistema SEO ya están montados para crecer rápido. Para una
página o función nueva, basta describir **qué se quiere** y el equipo de
desarrollo la implementa siguiendo las plantillas de este sistema (tipo de
página, reglas de contenido, SEO automático). No hay que rehacer nada desde cero.
