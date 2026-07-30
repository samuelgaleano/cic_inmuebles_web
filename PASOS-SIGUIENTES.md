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

## 📋 Resultado de la auditoría (actualizado 30-jul-2026)

| Área | Estado | Nota |
|---|---|---|
| Secretos en el repo | ✅ Limpio | Ningún `.env` rastreado; `.gitignore` cubre `.env*` |
| Tipos / Lint / Tests | ✅ Verde | **29/29** tests; `tsc` y `eslint` sin errores |
| Build | ✅ Verde | 19 páginas generadas |
| Pasarela de pagos | ✅ Correcta y segura | Monto inmanipulable; webhook con firma oficial; falla cerrado |
| Autenticación admin | ✅ Resuelto | Variables ya estaban en Vercel; además el código ahora **falla cerrado** |
| Dependencias | 🟡 Sin ruta de arreglo | Next **16.2.12** (última). Quedan 4 vulns transitivas de build (postcss 8.4.31 y sharp, clavadas dentro de Next); se corrigen cuando Next las actualice |
| Endpoint cron | ✅ Protegido | Exige `Authorization: Bearer CRON_SECRET` (verificado: 401 en producción) |

### ✅ Riesgo 1 — cerrado (la auditoría anterior se equivocaba)
La auditoría del 29-jul dio por hecho que faltaban las variables. **No era así:**
`ADMIN_EMAIL`, `ADMIN_PASSWORD` y `ADMIN_SESSION_SECRET` ya estaban definidas en
Vercel desde el 21-jun, para Production y Preview. `ADMIN_EMAIL` vale
`cic.inmuebles@gmail.com`, no el valor por defecto del repo.

Aun así se endureció el código (defensa en profundidad): antes, si una de esas
variables se borraba, `session.ts` volvía en silencio a los valores por defecto
—que están publicados en este repositorio— y el panel quedaba abierto. Ahora,
**en producción, si falta cualquiera de las tres el panel queda inaccesible**:
no se validan credenciales, no se emiten sesiones y las existentes dejan de
verificarse.

> Verificado en producción sin usar credenciales: `proxy.ts` llama
> `verifySessionToken` en toda ruta `/admin/*`, y los logs de Vercel no
> muestran el error `[seguridad] Panel admin DESACTIVADO`.

### 🐛 Dos defectos encontrados al ejecutar este runbook
1. **`parseSpecDoc` no leía archivos con saltos de línea de Windows (CRLF).** La
   expresión regular no llevaba flag `/m` y en JavaScript `.` no coincide con
   `\r`, así que solo se reconocían los campos vacíos. Un `especificaciones.md`
   escrito en Bloc de notas y subido a Drive **se importaba vacío y sin error**.
   Corregido normalizando los saltos de línea al entrar (commit `49a45b3`).
2. **`pnpm-workspace.yaml` estaba subido con los marcadores sin resolver**
   (`sharp: set this to true or false`), lo que rompía cualquier comando con
   pnpm 11. Resuelto manteniendo el comportamiento de producción.

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

## ✅ PASO 1 — Asegurar el panel admin — **HECHO**

Las tres variables ya estaban cargadas en Vercel (Production y Preview) desde el
21-jun, así que no hubo nada que crear. El código además se endureció para
fallar cerrado (ver Riesgo 1 arriba). **Nada pendiente.**

Si algún día hay que rotar el secreto de firma:
```bash
node -e "console.log(require('crypto').randomBytes(48).toString('base64url'))"
```
y se reemplaza `ADMIN_SESSION_SECRET` en Vercel. Rotarlo cierra todas las
sesiones abiertas, que es justo lo que se busca al rotarlo.

⚠️ Ojo: al fallar cerrado, **borrar** cualquiera de las tres variables deja el
panel inaccesible hasta volver a definirla y redesplegar.

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
- [x] Paso 0 — el proyecto corre en local (29/29 tests, tipos, lint y build verdes).
- [x] Paso 1 — `ADMIN_SESSION_SECRET`, `ADMIN_EMAIL`, `ADMIN_PASSWORD` en Vercel
      (ya estaban) + código endurecido para fallar cerrado.
- [ ] Paso 2 — llaves `WOMPI_*` en Vercel + webhook registrado + pago de prueba OK.
      **Único paso pendiente.** Requiere las llaves de la cuenta de Wompi.
- [x] Paso 3 — precios y textos revisados (todos salen de `plans.ts`; la
      descripción SEO ya no repite el precio a mano).
- [x] Paso 4 — cambios en `main` y desplegados (verificado en producción).
- [ ] (Aparte) XIAOMI corregido — sigue pendiente, ver recordatorio arriba.
- [ ] (Limpieza) Borrar `NEXT_PUBLIC_SITE_URL` del proyecto CIC en Vercel: vale
      `https://specifinance.com` (otro proyecto). Hoy es inofensivo porque
      `site.ts` fija el dominio en código, pero es una trampa esperando.
