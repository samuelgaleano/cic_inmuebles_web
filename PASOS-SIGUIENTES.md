# 🧭 Pasos siguientes + Auditoría — CIC Inmuebles

> **Este archivo es el guion de trabajo.** Está escrito para que **Claude Code**,
> ejecutándose desde la terminal dentro de esta carpeta, lo siga paso a paso para
> terminar el proyecto. También sirve como checklist para una persona.
>
> **Cómo arrancar (usuario):** abre una terminal en esta carpeta y ejecuta
> `claude`. Cuando abra, pégale exactamente esto:
>
> > *"Lee `PASOS-SIGUIENTES.md` y `ENTREGA-FINAL.md` y ejecuta los pasos
> > pendientes uno por uno. Detente y pregúntame cada vez que necesites una
> > llave secreta, una contraseña o que yo haga clic en un panel web. No
> > inventes valores secretos."*

---

## ⚠️ Instrucciones para el agente (Claude Code) — LÉELAS PRIMERO

1. **Nunca inventes secretos** (llaves de Wompi, contraseñas, tokens). Cuando un
   paso los necesite, **DETENTE y pídeselos al usuario**.
2. **No hagas `git push --force`** ni reescribas historia. Trabaja en una rama y
   haz commits claros.
3. **No expongas** ningún secreto en commits, logs ni en el chat. Verifica que
   `.env.local` esté en `.gitignore` (lo está).
4. Tras cualquier cambio de código, corre **`pnpm typecheck && pnpm lint &&
   pnpm test && pnpm build`** antes de dar un paso por terminado.
5. Los pasos que requieren un panel web (Vercel, Wompi) los hace el **usuario**;
   tú lo guías con el valor exacto a pegar y luego **verificas** el resultado.

---

## 📋 Resultado de la auditoría (29-jul-2026)

| Área | Estado | Nota |
|---|---|---|
| Secretos en el repo | ✅ Limpio | Ningún `.env` rastreado; `.gitignore` cubre `.env*` |
| Tipos / Lint / Tests | ✅ Verde | 17/17 tests; `tsc` y `eslint` sin errores |
| Build | ✅ Verde | 19 páginas generadas |
| Pasarela de pagos | ✅ Correcta y segura | Monto inmanipulable; webhook con firma oficial; falla cerrado |
| Autenticación admin | 🟠 **Acción requerida** | Ver Riesgo 1 — hay valores por defecto inseguros |
| Dependencias | 🟡 Mejorado | Next 16.2.9→**16.2.12** (parche de seguridad). Quedan 4 vulns transitivas de build (postcss/sharp dentro de Next), riesgo práctico bajo |
| Endpoint cron | ✅ Protegido | Exige `Authorization: Bearer CRON_SECRET` |

### 🔴 Riesgo 1 (el más importante): credenciales admin por defecto
`src/lib/auth/session.ts` usa valores **por defecto conocidos** si no defines las
variables de entorno:
- `ADMIN_SESSION_SECRET` → si falta, el secreto de firma de sesión es un texto
  público del repo ⇒ **cualquiera podría falsificar una sesión de admin.**
- `ADMIN_EMAIL` / `ADMIN_PASSWORD` → si faltan, valen
  `admin@cicinmuebles.com` / `cic-admin-2026` ⇒ **login abierto con credenciales
  conocidas.**

➡️ **Corrección:** definir esas 3 variables en Vercel con valores fuertes
(**Paso 1**). El código ya avisa en los logs de producción si faltan.

---

## ✅ PASO 0 — Verificar que el proyecto corre (el agente puede hacerlo solo)

```bash
node -v            # se espera Node 20+ (ideal 22)
corepack enable    # habilita pnpm si hace falta
pnpm install
pnpm typecheck && pnpm lint && pnpm test && pnpm build
pnpm dev           # abre http://localhost:3000 para revisar visualmente
```
✔️ Criterio de éxito: todo en verde y la home carga en el navegador.

---

## 🔐 PASO 1 — Asegurar el panel admin (Riesgo 1) — **REQUIERE AL USUARIO**

1. El agente **genera** un secreto fuerte y se lo muestra al usuario:
   ```bash
   node -e "console.log(require('crypto').randomBytes(48).toString('base64url'))"
   ```
2. **DETENTE.** Pídele al usuario que, en **Vercel → proyecto CIC → Settings →
   Environment Variables (Production)**, cree:
   - `ADMIN_SESSION_SECRET` = (el valor generado arriba)
   - `ADMIN_EMAIL` = (el correo real del administrador)
   - `ADMIN_PASSWORD` = (una contraseña nueva y fuerte, no la de por defecto)
3. Verificación: tras redeploy, entra a `/admin/login` y confirma que las
   credenciales nuevas funcionan y las viejas **no**.

---

## 💳 PASO 2 — Activar la pasarela de pagos — **REQUIERE AL USUARIO**

Detalle completo en `ENTREGA-FINAL.md` (sección 3). Resumen accionable:

1. **DETENTE.** Pide al usuario las llaves de **Wompi → Desarrolladores**
   (las mismas de su proyecto XIAOMI):
   `WOMPI_PUBLIC_KEY`, `WOMPI_INTEGRITY_SECRET`, `WOMPI_EVENTS_SECRET`, y
   opcional `WOMPI_PRIVATE_KEY`.
2. El usuario las carga en **Vercel (Production)**. (Opcional: `RESEND_API_KEY` y
   `LEADS_NOTIFICATION_EMAIL` para el correo de "pago aprobado".)
3. El usuario registra en **Wompi → Eventos** la URL:
   `https://www.cicinmuebles.com/api/pagos/wompi/webhook`
4. Redeploy. Verificación del agente: `curl -s -o /dev/null -w "%{http_code}"
   -X POST https://www.cicinmuebles.com/api/pagos/wompi -H "Content-Type:
   application/json" -d '{"planId":"alianza-90"}'` debe responder **200** (ya no
   503). En la web, el botón debe decir **"Contratar por $10.000"**.
5. El usuario hace **un pago de prueba real** de $10.000 (plan "Alianza por
   resultados") y confirma que llega el correo.

> Para probar en local sin cobrar de verdad: crear `.env.local` con las llaves
> **de pruebas** de Wompi (`pub_test_…`, `prv_test_…`). Ver `.env.example`.

---

## 🛠️ PASO 3 — Ajustes finales de contenido (el agente puede hacerlo)

- **Precios / planes:** `src/lib/config/plans.ts` (edita `precioCOP`, en pesos).
- **Textos propietario (3%, etc.):** `src/app/(public)/vender/page.tsx`.
- **Textos agentes / planes:** `src/app/(public)/publica/agente/page.tsx`.
- **Condiciones:** `src/app/(public)/publica/condiciones/page.tsx`.
- Tras editar: `pnpm build` y luego commit.

---

## 🚀 PASO 4 — Publicar cambios

```bash
git checkout -b ajustes-finales      # o la rama que prefieras
git add -A
git commit -m "ajustes finales"
git push -u origin ajustes-finales
```
Luego fusionar a `main` (Vercel despliega solo). **No** usar `--force`.

---

## 📌 Recordatorio aparte
Revisar el proyecto **XIAOMI**: con el mismo patrón de Wompi probablemente cobra
**100× menos** (mandaba pesos como centavos). En CIC ya está corregido.

---

## Checklist maestro
- [ ] Paso 0 — el proyecto corre en local (todo verde).
- [ ] Paso 1 — `ADMIN_SESSION_SECRET`, `ADMIN_EMAIL`, `ADMIN_PASSWORD` en Vercel.
- [ ] Paso 2 — llaves `WOMPI_*` en Vercel + webhook registrado + pago de prueba OK.
- [ ] Paso 3 — precios y textos revisados.
- [ ] Paso 4 — cambios en `main` y desplegados.
- [ ] (Aparte) XIAOMI corregido.
