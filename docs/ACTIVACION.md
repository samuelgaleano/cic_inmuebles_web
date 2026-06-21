# Guía de activación (producción)

El sitio funciona desde el primer momento con datos de ejemplo. Para pasar a
producción real con **costo ≈ 0**, activa cada servicio definiendo sus
variables en `.env.local` (o en el panel de Vercel → Project → Settings →
Environment Variables). No hay que tocar código: el sistema detecta las
variables y cambia de comportamiento automáticamente.

## 1. Credenciales del panel admin (obligatorio)
```
ADMIN_EMAIL=tu-correo@dominio.com
ADMIN_PASSWORD=una-contraseña-fuerte
ADMIN_SESSION_SECRET=<cadena-larga-aleatoria>   # genera con: openssl rand -base64 48
```
Sin esto se usan credenciales de desarrollo por defecto (no usar en producción).

## 2. Base de datos — Supabase (persistencia real)
1. Crea un proyecto gratis en https://supabase.com.
2. SQL Editor → pega y ejecuta `supabase/migrations/0001_init.sql`.
3. Project Settings → API, copia los valores:
```
NEXT_PUBLIC_SUPABASE_URL=https://xxxx.supabase.co
NEXT_PUBLIC_SUPABASE_ANON_KEY=eyJ...
SUPABASE_SERVICE_ROLE_KEY=eyJ...   # SOLO servidor, nunca al cliente
```
Al definirlas, el catálogo, leads, agenda y plantillas pasan a guardarse en la
base de datos (dejan de ser efímeros).

## 3. Imágenes — Cloudinary (CDN gratis)
1. Crea cuenta en https://cloudinary.com.
2. Settings → Upload → crea un **upload preset sin firmar** (unsigned).
```
NEXT_PUBLIC_CLOUDINARY_CLOUD_NAME=tu-cloud-name
NEXT_PUBLIC_CLOUDINARY_UPLOAD_PRESET=tu-preset
```
Con esto, el botón "Subir imágenes" del panel sube directo a Cloudinary.

## 4. Correos de leads — Resend (gratis)
1. Crea cuenta en https://resend.com → API Keys.
2. Verifica un dominio remitente (o usa el de pruebas).
```
RESEND_API_KEY=re_...
RESEND_FROM="CIC Inmuebles <no-reply@tudominio.com>"
LEADS_NOTIFICATION_EMAIL=cc.inmuebles@gmail.com
```
Sin la API key, los leads se registran en consola (no se pierden, pero no se
envía correo).

## 5. Google Drive — archivo por inmueble (opcional)
1. Google Cloud Console → crea una **cuenta de servicio** y una **clave JSON**.
2. Habilita la **Google Drive API**.
3. Crea una carpeta raíz en el Drive de `cc.inmuebles@gmail.com` y **compártela**
   con el correo de la cuenta de servicio (permiso de editor). Copia su ID
   (de la URL de la carpeta).
```
GOOGLE_SERVICE_ACCOUNT_EMAIL=...@...iam.gserviceaccount.com
GOOGLE_PRIVATE_KEY="-----BEGIN PRIVATE KEY-----\n...\n-----END PRIVATE KEY-----\n"
GOOGLE_DRIVE_ROOT_FOLDER_ID=1AbC...
```
Al crear un inmueble se generará su carpeta `Título – Ciudad` con el documento
`especificaciones.md`.

## 6. Contacto y WhatsApp (públicas)
```
NEXT_PUBLIC_SITE_URL=https://cicinmuebles.com
NEXT_PUBLIC_WHATSAPP=573000000000      # solo dígitos, con código de país
NEXT_PUBLIC_PHONE_DISPLAY=+57 300 000 0000
NEXT_PUBLIC_CONTACT_EMAIL=cc.inmuebles@gmail.com
```

## Despliegue en Vercel
1. Importa el repositorio en https://vercel.com.
2. Añade las variables de entorno anteriores.
3. Cada `git push` a la rama desplegada actualiza el sitio automáticamente.
4. Subdominio admin: en Vercel → Domains, apunta `admin.tudominio.com` al mismo
   proyecto (las rutas del panel viven en `/admin`).
