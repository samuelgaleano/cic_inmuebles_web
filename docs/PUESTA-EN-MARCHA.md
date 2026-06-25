# Puesta en marcha de CIC Inmuebles — Guía paso a paso

Esta guía cubre **todo lo que debes hacer tú manualmente** (yo ya dejé el
código y el sitio desplegados). Hazlo en este orden. No necesitas saber
programar: todo es en paneles web (Vercel, Google, Supabase).

> El sitio **ya funciona** con datos de ejemplo aquí:
> https://cic-inmuebles-web-samuelgaleanoalvis-8896s-projects.vercel.app
> Estos pasos sirven para conectar tus datos reales, Google Drive y Google Sheets.

Cada paso termina en una o más **variables de entorno** que se pegan en
**Vercel → tu proyecto `cic-inmuebles-web` → Settings → Environment Variables**.
Al final hay una tabla resumen con todas.

---

## PASO 0 — Verifica el panel de administración (5 min, sin configurar nada)

1. Abre la URL del sitio (arriba).
2. Baja hasta el **pie de página (footer)**. A la derecha verás el enlace **"🔒 Panel"**.
3. Haz clic → te lleva al **login**.
4. Entra con: usuario `admin@cicinmuebles.com` y contraseña `cic-admin-2026`.
5. Recorre las secciones (Dashboard, Inmuebles, Leads, Agenda, Plantillas, Reportes).
   Crea un inmueble de prueba para confirmar que todo responde.

> Estas credenciales son provisionales; en el PASO 5 las cambias por unas seguras.

---

## PASO 1 — Cuenta de servicio de Google (para Drive y Sheets)

Una "cuenta de servicio" es un robot de Google al que tu app le delega el
acceso. Se crea una sola vez y sirve **tanto para Drive como para Sheets**.

### 1.1 Crear/elegir un proyecto en Google Cloud
1. Entra a **https://console.cloud.google.com** con tu cuenta de Google.
2. Arriba, en el selector de proyectos, **"Nuevo proyecto"** → nombre: `CIC Inmuebles` → Crear.
3. Asegúrate de que ese proyecto quede **seleccionado** (arriba a la izquierda).

### 1.2 Habilitar las APIs
1. Menú ☰ → **APIs y servicios → Biblioteca**.
2. Busca **"Google Drive API"** → ábrela → **Habilitar**.
3. Vuelve a la Biblioteca, busca **"Google Sheets API"** → **Habilitar**.

### 1.3 Crear la cuenta de servicio
1. Menú ☰ → **IAM y administración → Cuentas de servicio**.
2. **"Crear cuenta de servicio"** → nombre: `cic-app` → Crear y continuar →
   (puedes omitir roles) → **Listo**.
3. Verás un correo tipo `cic-app@cic-inmuebles-xxxx.iam.gserviceaccount.com`.
   **Cópialo y guárdalo** (lo usarás en los pasos 2 y 3). Ese es tu
   **`GOOGLE_SERVICE_ACCOUNT_EMAIL`**.

### 1.4 Crear la llave (archivo JSON)
1. Haz clic en la cuenta de servicio que creaste → pestaña **"Claves"**.
2. **"Agregar clave → Crear clave nueva → JSON"** → se descarga un archivo `.json`.
3. Ábrelo con el Bloc de notas. Te interesan dos campos:
   - `"client_email"` → es tu **`GOOGLE_SERVICE_ACCOUNT_EMAIL`** (el mismo de antes).
   - `"private_key"` → es tu **`GOOGLE_PRIVATE_KEY`**. Copia **todo** el valor entre
     comillas, incluyendo `-----BEGIN PRIVATE KEY-----` y `-----END PRIVATE KEY-----`
     y los `\n` que aparecen. (No copies las comillas exteriores.)

> ⚠️ Ese archivo JSON es secreto. No lo subas a internet ni al repositorio.

---

## PASO 2 — Carpeta raíz en Google Drive

Aquí vivirán las carpetas de cada inmueble (fotos + ficha).

1. Entra a **https://drive.google.com** con la cuenta donde quieres el archivo.
2. **Nueva → Carpeta** → nómbrala `CIC Inmuebles`.
3. Entra a la carpeta. **Compártela con el robot**: clic derecho → **Compartir** →
   pega el `client_email` (del paso 1.3) → rol **Editor** → Enviar.
4. Copia el **ID de la carpeta**: estando dentro, mira la URL del navegador:
   `https://drive.google.com/drive/folders/`**`ESTE_ES_EL_ID`**
   Ese texto es tu **`GOOGLE_DRIVE_ROOT_FOLDER_ID`**.

---

## PASO 3 — Hoja de cálculo en Google Sheets (catálogo maestro)

1. Entra a **https://sheets.google.com** → **En blanco** (hoja nueva).
2. Nómbrala `Catálogo CIC` (arriba a la izquierda).
3. **Compártela con el robot**: botón **Compartir** (arriba a la derecha) →
   pega el `client_email` → rol **Editor** → Enviar.
4. Copia el **ID de la hoja** desde la URL:
   `https://docs.google.com/spreadsheets/d/`**`ESTE_ES_EL_ID`**`/edit`
   Ese texto es tu **`GOOGLE_SHEETS_SPREADSHEET_ID`**.

> No tienes que crear columnas: la app escribe el encabezado y los datos sola.

---

## PASO 4 — Base de datos real (Supabase) [recomendado]

Sin esto, el sitio usa datos de ejemplo que no se guardan de verdad.

1. Entra a **https://supabase.com** → inicia sesión → **New project**.
2. Nombre: `cic-inmuebles`, contraseña de BD (guárdala), región la más cercana → Create.
3. Cuando termine, ve a **Project Settings → API**. Copia:
   - **Project URL** → **`NEXT_PUBLIC_SUPABASE_URL`**
   - **anon public** → **`NEXT_PUBLIC_SUPABASE_ANON_KEY`**
   - **service_role** (secreta) → **`SUPABASE_SERVICE_ROLE_KEY`**
4. Carga el esquema: menú **SQL Editor → New query**. Abre el archivo
   `supabase/migrations/0001_init.sql` del repositorio (en GitHub), copia
   **todo** su contenido, pégalo en el editor y pulsa **Run**.
   Eso crea las tablas (inmuebles, leads, agentes, citas, plantillas).

---

## PASO 5 — Seguridad del panel de administración [recomendado]

Define tus propias credenciales (en vez de las de prueba):
- **`ADMIN_EMAIL`** → tu correo de acceso (ej. `admin@cicinmuebles.com`).
- **`ADMIN_PASSWORD`** → una contraseña fuerte y nueva.
- **`ADMIN_SESSION_SECRET`** → una cadena larga y aleatoria (mínimo 32 caracteres;
  puedes generarla en https://generate-secret.vercel.app/32).

---

## PASO 6 — Datos de contacto del sitio [recomendado]

Para que WhatsApp, correo y teléfono sean los reales:
- **`NEXT_PUBLIC_SITE_URL`** → la URL final del sitio.
- **`NEXT_PUBLIC_CONTACT_EMAIL`** → correo de contacto público.
- **`NEXT_PUBLIC_WHATSAPP`** → número con código de país, **solo dígitos** (ej. `573001234567`).
- **`NEXT_PUBLIC_PHONE_DISPLAY`** → cómo se muestra el teléfono (ej. `+57 300 123 4567`).
- (Opcional) `NEXT_PUBLIC_INSTAGRAM`, `NEXT_PUBLIC_FACEBOOK`.

---

## PASO 7 — (Opcional) Correo de leads e imágenes
- **Resend** (avisos por correo de nuevos leads): crea cuenta en https://resend.com,
  genera un API Key → **`RESEND_API_KEY`**, y define `RESEND_FROM` y
  `LEADS_NOTIFICATION_EMAIL`. Sin esto, los leads igual se guardan; solo no llega correo.
- **Cloudinary** (CDN de imágenes): solo si quieres subir fotos optimizadas desde
  el panel. Las fotos de Drive ya funcionan sin esto.

---

## PASO 8 — Pegar las variables en Vercel y redesplegar

1. Entra a **https://vercel.com** → proyecto **`cic-inmuebles-web`** →
   **Settings → Environment Variables**.
2. Por cada variable: escribe el **Name** y el **Value**, marca **Production**
   (y Preview/Development si quieres) → **Save**.
3. Cuando termines, ve a **Deployments → (último) → ⋯ → Redeploy** para que
   tomen efecto.

### Resumen de variables

| Variable | ¿Para qué? | ¿Obligatoria? |
|---|---|---|
| `GOOGLE_SERVICE_ACCOUNT_EMAIL` | Acceso a Drive/Sheets | Para Drive y Sheets |
| `GOOGLE_PRIVATE_KEY` | Acceso a Drive/Sheets | Para Drive y Sheets |
| `GOOGLE_DRIVE_ROOT_FOLDER_ID` | Carpeta raíz de inmuebles | Para Drive |
| `GOOGLE_SHEETS_SPREADSHEET_ID` | Catálogo maestro | Para Sheets |
| `NEXT_PUBLIC_SUPABASE_URL` | Base de datos | Recomendada |
| `NEXT_PUBLIC_SUPABASE_ANON_KEY` | Base de datos | Recomendada |
| `SUPABASE_SERVICE_ROLE_KEY` | Base de datos (servidor) | Recomendada |
| `ADMIN_EMAIL` / `ADMIN_PASSWORD` / `ADMIN_SESSION_SECRET` | Seguridad admin | Recomendada |
| `NEXT_PUBLIC_SITE_URL` / `NEXT_PUBLIC_CONTACT_EMAIL` / `NEXT_PUBLIC_WHATSAPP` / `NEXT_PUBLIC_PHONE_DISPLAY` | Contacto real | Recomendada |
| `RESEND_API_KEY` (+ `RESEND_FROM`, `LEADS_NOTIFICATION_EMAIL`) | Correo de leads | Opcional |
| Cloudinary (`NEXT_PUBLIC_CLOUDINARY_*`, `CLOUDINARY_*`) | CDN de imágenes | Opcional |

---

## PASO 9 — Probar de punta a punta (cuando ya redesplegaste)

1. **Drive**: en `CIC Inmuebles` crea una subcarpeta `Apartamento de prueba – Medellín`,
   sube 2-3 fotos y la `especificaciones.md` (plantilla que te envié) rellena.
2. **Importar**: panel → **Inmuebles → "Importar de Drive" → "Escanear e importar"**.
   Debe crear el inmueble como **borrador** con sus fotos.
3. **Revisar y publicar**: ábrelo, verifica datos y marca **Publicado**.
4. **Sheets**: panel → **Reportes → "Abrir catálogo"**. Debe aparecer la fila del
   inmueble con toda su info. Cambia el estado en el panel y vuelve a mirar: se actualiza.
5. **Sitio público**: el inmueble publicado aparece en el catálogo.

---

## (Opcional) Dominio
- **URL corta** `cic-inmuebles-web.vercel.app`: Settings → Domains → Add → escribe
  `cic-inmuebles-web`.
- **Dominio propio** (ej. `cicinmuebles.com`): Settings → Domains → Add → sigue las
  instrucciones de DNS que te muestre Vercel.

---

¿Dudas en algún paso? Avísame en cuál estás y te guío en detalle.
