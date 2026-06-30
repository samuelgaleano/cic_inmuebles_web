# Proceso operativo CIC Inmuebles — flujo, sincronización y corroboraciones

Guía general del proceso correcto para operar el sistema, con los puntos de
verificación en cada etapa.

## 1. Requisitos previos (una sola vez)
- [ ] **Supabase** configurado (base de datos persistente) — sin esto los datos no se guardan de verdad.
- [ ] **Cuenta de servicio de Google** creada (Drive API + Sheets API) y su llave JSON.
- [ ] **`BD inmuebles`** (Drive) compartida como **Editor** con la cuenta de servicio.
- [ ] **Hoja de Sheets** (nueva) compartida como **Editor** con la cuenta de servicio.
- [ ] Variables en Vercel: `GOOGLE_SERVICE_ACCOUNT_EMAIL`, `GOOGLE_PRIVATE_KEY`,
      `GOOGLE_DRIVE_ROOT_FOLDER_ID`, `GOOGLE_SHEETS_SPREADSHEET_ID`, `CRON_SECRET`,
      Supabase y `ADMIN_*`. Luego **Redeploy**.

**Corroboración:** en el panel → **Reportes** debe verse "Abrir catálogo" (Sheets OK);
al **editar un inmueble** debe verse el panel "Archivo en Google Drive" (Drive OK).

## 2. Cómo se agrega un inmueble (dos caminos)

### A) Desde Google Drive (carga masiva / agentes)
1. En `BD inmuebles/<Ciudad>/inmuebles disponibles/` crea la carpeta del inmueble
   `NNNN-Nombre-Sector` (ej. `1015-Colina-Norte`).
2. Sube las **fotos** dentro de una subcarpeta `contenido visual` (o `contenido audiovisual`).
3. (Ideal) agrega `especificaciones.md` (plantilla) para que entren precio/área/etc.
4. **Importa:** Panel → **Inmuebles → Importar de Drive → Escanear** (o espera al cron, ver §4).
5. El inmueble entra como **borrador**. Revísalo, completa lo que falte y **Publica**.

**Corroboración:** el inmueble aparece en la lista de Inmuebles con sus fotos y
estado correctos; al publicarlo, aparece en el catálogo público.

### B) Desde el panel (alta manual)
1. Panel → **Inmuebles → Nuevo inmueble** → llena el formulario → Guardar.
2. (Si Drive está configurado) se crea automáticamente su carpeta de archivo en Drive.

**Corroboración:** queda en la lista; si Drive está activo, su carpeta aparece en `BD inmuebles/<Ciudad>/`.

## 3. Estados y actualización
- Cambia el **estado** (Disponible / En proceso / Vendido) editando el inmueble en el panel.
- El cambio se refleja **al instante** en el catálogo público y en la hoja de Google Sheets.

**Corroboración:** tras guardar, recarga el catálogo y la hoja: el estado coincide.

## 4. Sincronización (qué es automático)
| Flujo | Cuándo se actualiza |
|---|---|
| Panel → Sitio público | **Instantáneo** al guardar (crear/editar/eliminar) |
| Panel → Google Sheets | **Instantáneo** al guardar |
| Drive → Sitio/Sheets | **Botón** "Importar de Drive" (inmediato) **+ Cron automático** |
| Botón "Sincronizar ahora" (Reportes) | Reescribe toda la hoja de Sheets al momento |

- El **Cron de Vercel** llama a `/api/cron/sync` (protegido con `CRON_SECRET`) y trae
  los inmuebles nuevos de Drive y reescribe el catálogo en Sheets.
- Frecuencia por defecto: **diaria** (06:00 UTC) — límite del plan gratuito de Vercel.
  Para más frecuencia, sube el plan y ajusta `schedule` en `vercel.json`.
  Para traer algo al instante, usa el botón "Importar de Drive".

**Corroboración del cron:** en Vercel → proyecto → **Settings → Cron Jobs** debe
aparecer `/api/cron/sync`; en **Logs** se ve su ejecución diaria sin error 401.

## 5. Roles sugeridos
- **Agentes:** suben fotos + ficha a Drive con la estructura de carpetas.
- **Administrador:** importa, revisa borradores, completa datos y publica; gestiona
  leads, agenda y reportes.

## 6. Checklist de corroboración rápida (end-to-end)
1. [ ] Crear carpeta de inmueble de prueba en Drive (con fotos).
2. [ ] Importar de Drive → aparece como borrador con fotos.
3. [ ] Completar datos y publicar → aparece en el catálogo público.
4. [ ] Abrir catálogo en Sheets → existe la fila con su info.
5. [ ] Cambiar estado en el panel → se actualiza en web y en Sheets.
6. [ ] Esperar/forzar el cron → no duplica y mantiene todo al día.
