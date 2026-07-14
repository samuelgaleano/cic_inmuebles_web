# 6. Plan de acción

Tareas concretas con responsable y estado. Se actualiza en la revisión
trimestral (ver `05-tablero-y-cadencia.md`). Marcar `[x]` al completar.

> Basado en la auditoría SEO del 2026-07-14 (8 agentes especialistas del
> sistema claude-seo). Informe completo: `Informe-SEO-CIC-Inmuebles.pdf`.

## ✅ Hecho por desarrollo (ya en producción)

- [x] Dominio canónico corregido y fijo en código → `www.cicinmuebles.com`.
- [x] Metadatos de fichas desde datos estructurados (tipo, ubicación, specs, precio).
- [x] Grafo schema.org conectado + buscador (SearchAction) + FAQPage + Offer por inmueble.
- [x] `sitemap.xml` con auto-reparación horaria + `lastModified` real.
- [x] `robots.txt` con crawlers de IA + `llms.txt`.
- [x] Hero en WebP responsive (−81% en móvil), preconnect, cabeceras de seguridad.
- [x] FAQ real en `/vender`.
- [x] Sistema documentado (esta carpeta `docs/sistema/`).

## 🔴 Fase 1 — Crítico · **DUEÑO** · esta semana

- [ ] **Google Search Console:** registrar `www.cicinmuebles.com`, verificar
      (por DNS o meta tag) y enviar `https://www.cicinmuebles.com/sitemap.xml`.
      *Es el paso nº1 para que Google indexe el sitio.*
- [ ] **Vercel → Settings → Environment Variables:** borrar la variable
      `NEXT_PUBLIC_SITE_URL` vieja (apunta a specifinance.com). *El código ya
      ignora ese valor, pero conviene limpiarla.*
- [ ] **Vercel → Settings → Domains:** confirmar que `specifinance.com` NO esté
      colgado de este proyecto.
- [ ] **Corregir datos en el Sheet:** `"BogotÁ"` → `"Bogotá"`; *Bella Suiza*
      3 vs 4 habitaciones/baños (dejar el dato correcto en specs y descripción).

## 🟠 Fase 2 — Alto impacto · **DUEÑO** · 2-3 semanas

- [ ] **Google Business Profile** como negocio de área de servicio
      (categoría "Agencia inmobiliaria", zona Bogotá y alrededores; sin
      dirección física inventada).
- [ ] **Instagram/Facebook** del negocio → cargar sus URLs en Vercel
      (`NEXT_PUBLIC_INSTAGRAM`, `NEXT_PUBLIC_FACEBOOK`). El sitio las publica
      solo como señal de entidad.
- [ ] **Correo de dominio propio** (contacto@cicinmuebles.com) → actualizar
      `NEXT_PUBLIC_CONTACT_EMAIL`.
- [ ] **PageSpeed Insights** sobre `www.cicinmuebles.com` y revisar CWV.

## 🟡 Fase 3 — Contenido y autoridad · **DUEÑO + DESARROLLO** · mes 2

- [ ] Página **"Sobre nosotros"** *(mayor déficit de confianza — requiere
      insumos del negocio: quiénes son, trayectoria, contacto real).*
- [ ] Ampliar **`/vender`** con proceso paso a paso y tiempos reales.
- [ ] Guía **"Cómo vender mi apartamento en Bogotá"**.
- [ ] Guía **"Documentos para vender un inmueble en Colombia"**.
- [ ] **Descripciones únicas** por inmueble (reemplazar el texto tipo WhatsApp).
- [ ] Conseguir las **primeras reseñas** en Google.

## 🟢 Fase 4 — Monitoreo · **DUEÑO** · continuo

- [ ] Revisar Search Console quincenalmente.
- [ ] Correr `/seo audit` mensual y comparar el puntaje.
- [ ] Crear **páginas por ciudad/sector** cuando haya 8-10 inmuebles por zona.
- [ ] Reevaluar si se retoma **arriendo** (requiere añadir el campo "operación"
      al modelo; el desarrollo lo puede implementar cuando se decida).

---

### Leyenda de responsables
- **DUEÑO:** solo lo puede hacer el negocio (accesos, decisiones, insumos reales).
- **DESARROLLO:** implementación de código (pedir cuando se decida el contenido).
