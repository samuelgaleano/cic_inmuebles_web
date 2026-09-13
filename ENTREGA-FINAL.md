# 📦 Entrega final — CIC Inmuebles (versión lista para modificaciones finales)

> **Este documento es la guía única de la entrega.** Explica el estado actual,
> cómo bajar la versión final a tu computador, y **exactamente qué falta para
> activar la pasarela de pagos** (las "modificaciones finales").
>
> Última corroboración (13-sep-2026): build ✅ · lint ✅ · tipos ✅ ·
> **83/83 tests ✅** · producción en vivo y verificada ruta por ruta ✅.

## 0. Novedades del 13-sep-2026

- **Correos activados.** `RESEND_API_KEY` y `LEADS_NOTIFICATION_EMAIL`
  (`cic.inmuebles@gmail.com`) ya están en Vercel. Los avisos de leads y de
  pagos llegan a esa casilla. El dominio `cicinmuebles.com` está en proceso de
  verificación en Resend para usar un remitente propio.
- **Llaves de Wompi cargadas** en Vercel (pública, integridad, eventos y
  privada). Con el siguiente despliegue los planes cobran en línea.
- **Pagos endurecidos.** El webhook ya no rechaza los reintentos de Wompi,
  persiste cada evento en Supabase (tablas `pagos_referencias`, `pagos_eventos`
  y `pagos_avisos`, migración `0003_pagos.sql` ya aplicada), confirma
  estado/referencia/monto contra la API de Wompi y nunca avisa "pago aprobado"
  por referencias que no sean de CIC.
- **Confirmación por la página de retorno.** Al volver del widget la página
  consulta la transacción y muestra el estado real (aprobado / pendiente /
  rechazado) y dispara el aviso al negocio, sin depender del webhook.
- **Reconciliación diaria** (`/api/pagos/wompi/reconciliar`, 06:30, protegida
  con `CRON_SECRET`): re-consulta lo pendiente, reenvía avisos que fallaron y
  lista referencias emitidas sin confirmación. `?tx=<id>` devuelve la traza.
- **La URL de Eventos de Wompi sigue apuntando a otro sitio** (la cuenta se
  comparte hoy). Hasta que ese sitio tenga su propia cuenta, CIC se entera de
  los pagos por el retorno y por la reconciliación. Plan completo en la
  documentación del proyecto (planes de acción del 13-sep-2026).
- Variable nueva: `PAGOS_ALERT_EMAIL` (correo operativo para alertas de pagos).

---

## 1. ¿Dónde está la "versión final"?

La versión final **es el repositorio de GitHub** (rama `main`) y ya está
**desplegada en producción** en https://www.cicinmuebles.com.

No hay una copia "aparte": el repo = la verdad. Para tenerla en tu carpeta local
`C:\Users\samuel\Documents\cic_INMUEBLES`, se **clona o actualiza** desde GitHub
(ver sección 6).

### Lo que ya está EN VIVO
- Catálogo de inmuebles, filtros, fichas, sincronización desde Google Drive.
- **Sección nueva "Publica tu inmueble"** (Trabaja con nosotros):
  - `/publica` → elige **propietario** o **agente/inmobiliaria**.
  - `/vender` (propietario) → *sin costo · agencia de cabecera · foto/video · 3% al cerrar*.
  - `/publica/agente` → planes con precio + **pago en línea**.
  - `/publica/condiciones` → condiciones de publicación.
- **Pasarela de pagos Wompi** integrada y probada, con **modo seguro**: mientras
  no cargues las credenciales, los botones dicen "Contratar por WhatsApp" y **no
  se cobra nada**. En cuanto pongas las variables (sección 3), se activan solos.

---

## 2. La pasarela de pagos, en simple

- **Cada plan cobra su propio precio**, y el precio se decide **en el servidor**,
  no en el navegador → un usuario **no puede pagar menos** manipulando la página.
- **El monto va correcto**: en Wompi los valores van en *centavos* (pesos × 100).
  $10.000 → `1.000.000`. (Nota: se revisó XIAOMI el 30-jul y **su cobro en
  producción está bien**; el bug del 100× vive en un archivo que Vercel no
  despliega. Pero ese repo tiene un asunto de seguridad urgente: ver
  `PASOS-SIGUIENTES.md`.)
- **Confirmación segura**: cuando un pago se aprueba, Wompi avisa a un "webhook"
  que valida la firma oficial; si la firma no cuadra, se rechaza. Al aprobarse,
  llega un **correo** al negocio con el plan, el monto y la referencia.

---

## 3. ⭐ MODIFICACIONES FINALES — activar los cobros (lo único que falta)

Todo el código está listo. Para pasar de "WhatsApp" a **pago en línea real**,
solo hay que cargar las credenciales de Wompi. Son **los mismos valores que ya
usa tu proyecto XIAOMI**.

### Paso 1 — Copiar las llaves desde Wompi
Entra a tu panel de **Wompi → Desarrolladores**. Vas a necesitar:

| Valor en Wompi | Variable a crear | ¿Secreta? |
|---|---|---|
| Llave pública (`pub_prod_…`) | `WOMPI_PUBLIC_KEY` | No |
| Secreto de integridad | `WOMPI_INTEGRITY_SECRET` | **Sí** |
| Secreto de eventos | `WOMPI_EVENTS_SECRET` | **Sí** |
| Llave privada (`prv_prod_…`) *(opcional, recomendada)* | `WOMPI_PRIVATE_KEY` | **Sí** |

### Paso 2 — Pegarlas en Vercel
En **Vercel → proyecto CIC → Settings → Environment Variables**, crea cada
variable de la tabla (entorno **Production**). Opcionales útiles:

```
APP_URL=https://www.cicinmuebles.com     # para el redireccionamiento tras pagar
RESEND_API_KEY=...                        # para que llegue el correo de "pago aprobado"
RESEND_FROM=CIC Inmuebles <onboarding@resend.dev>
LEADS_NOTIFICATION_EMAIL=tu-correo@ejemplo.com
```

### Paso 3 — Registrar el webhook en Wompi
En **Wompi → Configuración → Eventos / URL de eventos**, pega:

```
https://www.cicinmuebles.com/api/pagos/wompi/webhook
```

### Paso 4 — Redesplegar y probar
Cualquier push (o "Redeploy" en Vercel) activa las variables. Luego:
1. Entra a `/publica/agente` → el botón ahora dice **"Contratar por $10.000"** (ya no WhatsApp).
2. Haz una prueba real pequeña (el plan "Alianza por resultados", $10.000).
3. Confirma que llegó el correo de pago aprobado.

> 🔒 **Importante**: si falta `WOMPI_EVENTS_SECRET`, el webhook **rechaza todo**
> (responde 503) a propósito, para que nadie pueda fingir un pago. Es seguro por
> diseño.

---

## 4. Los planes y precios (y cómo cambiarlos)

**Fuente única de verdad:** `src/lib/config/plans.ts`. Cambiar un precio ahí lo
cambia en la página **y** en el cobro, automáticamente.

| Plan | Precio | Cobro | Para |
|---|---|---|---|
| Alianza por resultados | $10.000 / 90 días | En línea | Agentes (comisión 50/50) |
| Publicación independiente | $20.000 / mes | En línea | Agentes |
| Paquete Mensual 5 | $75.000 / mes | En línea | Inmobiliarias |
| Paquete Mensual 10 | $150.000 / mes | En línea | Inmobiliarias |
| Anual Aliado 5 | $239.900 / año | En línea | Inmobiliarias |
| Anual Aliado 10 | $399.900 / año | En línea | Inmobiliarias |
| Contenido Profesional | desde $250.000 | WhatsApp (variable) | Todos |
| Gestión de venta (propietario) | 3% al cerrar | Contrato (`/vender`) | Propietarios |

**Para cambiar un precio:** abre `plans.ts`, busca el plan por su `nombre` y
edita `precioCOP` (en pesos, sin puntos: `10000`). No toques nada más.

**Para agregar un plan nuevo:** copia un bloque existente en el arreglo `PLANS`,
cambia `id` (único, sin espacios), `nombre`, `precioCOP`, `periodo`, `resumen` e
`incluye`. Si `mode: "pago"` se cobra en línea; si `mode: "contacto"` va por WhatsApp.

---

## 5. ¿Qué se verificó? (corroboración)

- **Seguridad (agente dedicado):** el monto es inmanipulable desde el cliente; la
  firma es correcta; el webhook valida la firma oficial de Wompi, rechaza firmas
  falsas, rechaza eventos vencidos (anti-reenvío) y **falla cerrado** si falta el
  secreto. Sin hallazgos críticos. Quedó **más estricto que el patrón de XIAOMI**.
- **UX / accesibilidad (agente dedicado):** modal de pago con foco atrapado,
  etiquetas para lectores de pantalla, mensajes de error anunciados, bloqueo de
  scroll y diseño responsive (móvil/escritorio).
- **Automático:** `pnpm typecheck`, `pnpm lint`, `pnpm test` (34 pruebas: monto,
  firma y referencia de pago; parseo de las fichas de Drive; y el blindaje de la
  sesión de admin) y `pnpm build`, todos en verde.
- **En vivo:** cada caso probado contra el servidor (pago correcto, plan
  inexistente → 404, plan de contacto → 400, sin credenciales → 503, webhook
  válido → 200, inválido → 401, duplicado → deduplicado).
- **Producción (30-jul-2026):** todas las rutas públicas 200, `/admin` protegido
  (307 al login), webhook 503 mientras no haya credenciales, cron 401 sin
  autorización, dominio canónico correcto y ápex redirigiendo 308 a `www`.

### Verificación del monto en el webhook (implementado)
El webhook compara `amount_in_cents` contra `wompiAmountInCents(plan)`. Si no
cuadra, el aviso **se envía igual** pero con "REVISAR" en el asunto y una
advertencia en el cuerpo, y queda un `console.error` con lo recibido y lo
esperado. Se marca en vez de descartarse porque perder la notificación de un
pago real sería peor que recibirla con una advertencia.

---

## 6. Cómo tener la versión final en tu carpeta (Windows)

Abre **PowerShell** o **Git Bash** y:

**Primera vez (clonar):**
```bash
cd "C:\Users\samuel\Documents"
git clone https://github.com/samuelgaleano/cic_inmuebles_web.git cic_INMUEBLES
cd cic_INMUEBLES
```

**Si ya la tienes (actualizar a lo último):**
```bash
cd "C:\Users\samuel\Documents\cic_INMUEBLES"
git checkout main
git pull origin main
```

**Para correrla en tu computador:**
```bash
pnpm install          # instala dependencias (o: npm install)
pnpm dev              # abre http://localhost:3000
```
Para probar pagos en local, crea un archivo `.env.local` con las mismas variables
de la sección 3 (usa las llaves de **pruebas** `pub_test_…` de Wompi para no
cobrar de verdad). El archivo `.env.example` lista todas las variables.

---

## 7. ✅ Checklist de las modificaciones finales

- [x] Cargar `WOMPI_PUBLIC_KEY`, `WOMPI_INTEGRITY_SECRET`, `WOMPI_EVENTS_SECRET` en Vercel (CIC). *(13-sep-2026)*
- [x] `WOMPI_PRIVATE_KEY` (ahora obligatoria: la API es la fuente de verdad). *(13-sep-2026)*
- [x] **`RESEND_API_KEY`** y `LEADS_NOTIFICATION_EMAIL`. *(13-sep-2026)*
- [x] Aplicar la migración `supabase/migrations/0003_pagos.sql` en el SQL Editor de Supabase. *(13-sep-2026)*
- [x] Cargar `PAGOS_ALERT_EMAIL` en Vercel (`cic.inmuebles@gmail.com`, decisión del negocio). *(13-sep-2026)*
- [x] `RESEND_FROM="CIC Inmuebles <notificaciones@cicinmuebles.com>"` (dominio verificado en Resend). *(13-sep-2026)*
- [ ] Registrar el webhook `…/api/pagos/wompi/webhook` en Wompi — **solo cuando el otro
      sitio que usa la cuenta tenga la suya** (ver planes de acción del 13-sep-2026).
- [ ] Redesplegar y hacer un pago de prueba de $10.000; comprobar que la página de
      retorno diga "Pago aprobado" y que llegue el correo.
- [x] Revisar los textos de `/publica`, `/vender` y `/publica/agente`. *(13-sep-2026, cambios del cliente)*
- [ ] Revisar/ajustar precios en `src/lib/config/plans.ts` si hace falta.
- [ ] 🔴 (URGENTE, otro proyecto) **XIAOMI**: un parche de seguridad quedó en un
      archivo que Vercel no despliega, así que producción sigue sin él. El cobro
      sí está bien. Ver `PASOS-SIGUIENTES.md`.

---

*Documentación técnica ampliada: `docs/sistema/07-planes-y-pagos.md` y el resto de
`docs/sistema/`.*
