# Migraciones de Supabase

El esquema de la base vive en `migrations/`, un archivo por cambio, numerado. No hay CLI ni
despliegue automático: **cada migración se pega a mano en el SQL Editor de Supabase**
(proyecto de producción, ver `docs/ARQUITECTURA.md`). Todas son idempotentes: correr una
dos veces no rompe nada ni borra datos (salvo 0002, que retira columnas viejas que ya no existen).

Reglas:

- Numeración única y consecutiva. Una rama no reserva número hasta fusionarse; si dos ramas
  traen el mismo número, la segunda en llegar se renumera antes de fusionar.
- Solo se agrega (`if not exists`, `add column if not exists`, `create or replace`). Nada de
  `drop table` ni de cambiar columnas que el código ya usa.
- Cada migración trae al final sus consultas de comprobación (de solo lectura).
- El código debe seguir funcionando mientras la migración no esté aplicada: o degrada (como
  `reemplazar_medios` de 0014, que tiene camino de respaldo) o avisa en `/admin/conexiones`.

## Qué migraciones están aplicadas

Desde **0014** la base lleva un registro: la tabla `migraciones_aplicadas`. Cada migración nueva
inserta su propia fila al aplicarse. Las anteriores **no se marcan solas**: quien compruebe que
una está aplicada (con la consulta de la tabla de abajo) la registra a mano:

```sql
insert into migraciones_aplicadas (nombre, nota)
values ('0009_salud_y_permisos', 'comprobada el AAAA-MM-DD con la consulta del README')
on conflict (nombre) do nothing;
```

Para ver el registro:

```sql
select nombre, aplicada_at, nota from migraciones_aplicadas order by nombre;
```

## Tabla de migraciones

Cada consulta es de **solo lectura** y devuelve una columna `aplicada` (`true` / `false`). Se
probaron contra un Postgres limpio: dan `false` antes de su migración y `true` después (salvo
0002, ver nota).

| Migración | Qué hace | Comprobar que está aplicada |
|---|---|---|
| `0001_init` | Esquema inicial: tipos enumerados, `properties`, `property_media`, `agents`, `agent_availability`, `leads`, `appointments`, `templates`; trigger `updated_at`; RLS en inmuebles, medios y leads con dos políticas de lectura pública (inmuebles y fotos publicados). | `select to_regclass('public.properties') is not null and to_regclass('public.appointments') is not null and to_regclass('public.templates') is not null as aplicada;` |
| `0002_lean_schema` | Alinea `properties` al modelo de solo venta: quita columnas viejas (operación, barrio, estrato…) y agrega `administracion`, `sector`, `conjunto`, `area`, `parqueaderos`, `notas_internas`, `drive_folder_id`, `descripcion`. Solo hacía falta en bases creadas antes de 0001 actual. | `select count(*) = 8 and not exists (select 1 from information_schema.columns where table_schema = 'public' and table_name = 'properties' and column_name in ('operacion', 'barrio', 'descripcion_corta')) as aplicada from information_schema.columns where table_schema = 'public' and table_name = 'properties' and column_name in ('administracion', 'sector', 'conjunto', 'area', 'parqueaderos', 'notas_internas', 'drive_folder_id', 'descripcion');` (en una base creada con la 0001 actual ya da `true`) |
| `0003_pagos` | Pagos de Wompi: `pagos_referencias` (referencias emitidas), `pagos_eventos` (eventos con UNIQUE anti-repetición), `pagos_avisos` (aviso único por transacción) y la función `pagos_purgar_raw()` (borra el payload crudo a las 72 h). | `select to_regclass('public.pagos_eventos') is not null and to_regclass('public.pagos_avisos') is not null and to_regprocedure('public.pagos_purgar_raw()') is not null as aplicada;` |
| `0004_servicios_publicacion` | Vigencias de los planes pagados: `servicios_publicacion`, `servicios_renovaciones` (cada renovación se aplica una vez) y `pagos_referencias.renueva_servicio_id`. | `select to_regclass('public.servicios_renovaciones') is not null and exists (select 1 from information_schema.columns where table_schema = 'public' and table_name = 'pagos_referencias' and column_name = 'renueva_servicio_id') as aplicada;` |
| `0005_rls_y_endurecimiento` | RLS en `agents`, `agent_availability`, `appointments` y `templates`; retira la política de inserción pública de leads; solo el servidor ejecuta `pagos_purgar_raw()`. | `select bool_and(relrowsecurity) and not exists (select 1 from pg_policies where tablename = 'leads' and policyname = 'public insert leads') as aplicada from pg_class where relnamespace = 'public'::regnamespace and relname in ('agents', 'agent_availability', 'appointments', 'templates');` |
| `0006_servicios_descartado` | Estado `descartado` en `servicios_publicacion` (sacar de `/admin/vigencias` un pago reversado o de prueba sin borrarlo). | `select coalesce(bool_or(pg_get_constraintdef(oid) like '%descartado%'), false) as aplicada from pg_constraint where conname = 'servicios_publicacion_estado_check';` |
| `0007_crm` | CRM interno: `contactos`, `captaciones` (vendedores), `busquedas` (compradores), `busqueda_inmuebles` (N a N) y `actividades` (línea de tiempo). RLS sin políticas. | `select count(*) = 5 as aplicada from pg_tables where schemaname = 'public' and tablename in ('contactos', 'captaciones', 'busquedas', 'busqueda_inmuebles', 'actividades');` |
| `0008_relaciones_pagos_crm` | Llaves que faltaban: `leads.contacto_id`, `servicios_publicacion.contacto_id` / `property_id` / `pagado_at`, llave de `reference` hacia `pagos_referencias`, y el libro `servicios_periodos`. Rellena los enlaces que ya coincidían. | `select to_regclass('public.servicios_periodos') is not null and exists (select 1 from pg_constraint where conname = 'servicios_reference_fk') as aplicada;` |
| `0009_salud_y_permisos` | Tabla `latidos` (última corrida de cada cron, la lee `/api/salud`); la llave anónima solo lee columnas públicas de inmuebles y no escribe nada. | `select to_regclass('public.latidos') is not null and not has_column_privilege('anon', 'public.properties', 'propietario_telefono', 'select') as aplicada;` |
| `0010_crm_seguimiento_y_cierres` | `contactos.proximo_contacto_at` / `proximo_contacto_nota` (resumen diario por correo) y la tabla `cierres` (ventas cerradas con precio y comisión). | `select to_regclass('public.cierres') is not null and exists (select 1 from information_schema.columns where table_schema = 'public' and table_name = 'contactos' and column_name = 'proximo_contacto_at') as aplicada;` |
| `0011` a `0013` | Llegan con las ramas de pagos y CRM que se trabajan en paralelo. Al fusionarlas, agregar aquí su fila con la misma estructura. | — |
| `0014_infra` | Registro `migraciones_aplicadas`; funciones `reemplazar_medios(uuid, jsonb)` y `fijar_disponibilidad(uuid, jsonb)` (borrar e insertar en una sola transacción, solo `service_role`); índices en llaves foráneas que se filtran o que recorren los borrados en cascada (`servicios_publicacion.reference` y `.property_slug`, `servicios_renovaciones.servicio_id`, `actividades.property_id`, `appointments.property_id` y `.lead_id`, `leads.property_id`). | `select to_regclass('public.migraciones_aplicadas') is not null and to_regprocedure('public.reemplazar_medios(uuid, jsonb)') is not null and to_regprocedure('public.fijar_disponibilidad(uuid, jsonb)') is not null as aplicada;` |

## Cómo aplicar una migración

1. Abrir Supabase → proyecto de producción → **SQL Editor** → *New query*.
2. Pegar el archivo completo y ejecutar. Si algo falla, la consulta se detiene y no queda a medias
   lo que estaba en esa instrucción; como todo es idempotente, se corrige y se vuelve a correr.
3. Correr la consulta de comprobación de la tabla de arriba: debe dar `aplicada = true`.
4. Si la migración es anterior a 0014, registrar la fila en `migraciones_aplicadas` (arriba).
5. Revisar `/admin/conexiones` en el panel y, si aplica, `/api/salud`.

## Respaldo antes de tocar la base

Supabase Free no hace copias automáticas. El repositorio privado `cic-inmuebles-operacion` hace
un respaldo semanal cifrado de la base; antes de una migración que mueva datos (como 0008), conviene
lanzarlo a mano desde su pestaña *Actions* y confirmar que terminó bien.
