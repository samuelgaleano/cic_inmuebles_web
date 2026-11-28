-- =============================================================================
-- 0014 · Infraestructura: registro de migraciones, reemplazos atomicos e indices
--
-- Aditiva e idempotente: se puede correr dos veces y no borra datos. Solo usa
-- tablas y columnas de 0001..0010, asi que no depende de 0011..0013.
-- Aplicar en el SQL Editor de Supabase. Mientras no se aplique, el sitio sigue
-- funcionando: el repositorio detecta que faltan las funciones y usa su camino
-- de respaldo (inserta primero, borra despues, revisando cada error).
--
-- Contenido:
--   1) migraciones_aplicadas: registro de que migracion esta en la base.
--   2) reemplazar_medios(): fotos de un inmueble en UNA transaccion.
--   3) fijar_disponibilidad(): franjas de un agente en UNA transaccion.
--   4) Indices en llaves foraneas que filtran las consultas o los borrados en cascada.
--   5) Permisos: nada de lo nuevo es accesible con la llave publica (anon).
-- =============================================================================

-- --- 1) Registro de migraciones ----------------------------------------------
-- Hasta ahora no habia forma de saber desde la base que migraciones se aplicaron
-- (se pegan a mano en el SQL Editor). Desde aqui, cada migracion deja su fila.
-- Las anteriores (0001..0013) NO se marcan solas: quien compruebe que estan
-- aplicadas (con la consulta de supabase/README.md) inserta su fila, p. ej.:
--   insert into migraciones_aplicadas (nombre, nota)
--   values ('0009_salud_y_permisos', 'comprobada el AAAA-MM-DD con la consulta del README')
--   on conflict (nombre) do nothing;
create table if not exists migraciones_aplicadas (
  nombre      text primary key,                 -- nombre del archivo sin .sql
  aplicada_at timestamptz not null default now(),
  nota        text
);

alter table migraciones_aplicadas enable row level security; -- sin politicas: solo la llave de servicio
revoke all on migraciones_aplicadas from anon, authenticated;

insert into migraciones_aplicadas (nombre, nota)
values ('0014_infra', 'registrada al aplicar la propia migracion el ' || to_char(now() at time zone 'America/Bogota', 'YYYY-MM-DD'))
on conflict (nombre) do nothing;

-- --- 2) Reemplazo atomico de los medios de un inmueble -----------------------
-- Antes: borrar todas las fotos y luego insertar en otra llamada. Si la insercion
-- fallaba, el inmueble quedaba publicado sin fotos. Una funcion plpgsql corre en
-- una sola transaccion: o quedan las nuevas, o siguen las anteriores.
-- p_medios: arreglo JSON con las columnas de property_media (sin property_id):
--   [{"tipo":"image","provider":"drive","url":"...","thumbnail_url":null,
--     "alt":null,"orden":0,"is_cover":true}, ...]
create or replace function reemplazar_medios(p_property uuid, p_medios jsonb)
returns integer
language plpgsql
security invoker
set search_path = public
as $$
declare
  insertados integer := 0;
begin
  if p_medios is null or jsonb_typeof(p_medios) <> 'array' then
    raise exception 'p_medios debe ser un arreglo JSON' using errcode = '22023';
  end if;

  -- Bloquea la fila del inmueble: dos guardados simultaneos del mismo inmueble se ordenan
  -- en vez de mezclar sus fotos. Si el inmueble no existe, no se toca nada.
  perform 1 from properties where id = p_property for update;
  if not found then
    raise exception 'inmueble % no existe', p_property using errcode = 'P0002';
  end if;

  delete from property_media where property_id = p_property;

  insert into property_media (property_id, tipo, provider, url, thumbnail_url, alt, orden, is_cover)
  select p_property, m.tipo, m.provider, m.url, m.thumbnail_url, m.alt, coalesce(m.orden, 0), coalesce(m.is_cover, false)
  from jsonb_to_recordset(p_medios)
    as m(tipo media_type, provider media_provider, url text, thumbnail_url text, alt text, orden int, is_cover boolean);

  get diagnostics insertados = row_count;
  return insertados;
end
$$;

revoke all on function reemplazar_medios(uuid, jsonb) from public, anon, authenticated;
grant execute on function reemplazar_medios(uuid, jsonb) to service_role;

-- --- 3) Reemplazo atomico de la disponibilidad de un agente ------------------
-- Mismo patron para agent_availability (antes: delete sin revisar error + insert).
-- p_slots: [{"dia_semana":1,"hora_inicio":"09:00","hora_fin":"12:00"}, ...]
create or replace function fijar_disponibilidad(p_agent uuid, p_slots jsonb)
returns integer
language plpgsql
security invoker
set search_path = public
as $$
declare
  insertados integer := 0;
begin
  if p_slots is null or jsonb_typeof(p_slots) <> 'array' then
    raise exception 'p_slots debe ser un arreglo JSON' using errcode = '22023';
  end if;

  perform 1 from agents where id = p_agent for update;
  if not found then
    raise exception 'agente % no existe', p_agent using errcode = 'P0002';
  end if;

  delete from agent_availability where agent_id = p_agent;

  insert into agent_availability (agent_id, dia_semana, hora_inicio, hora_fin)
  select p_agent, s.dia_semana, s.hora_inicio, s.hora_fin
  from jsonb_to_recordset(p_slots) as s(dia_semana int, hora_inicio time, hora_fin time);

  get diagnostics insertados = row_count;
  return insertados;
end
$$;

revoke all on function fijar_disponibilidad(uuid, jsonb) from public, anon, authenticated;
grant execute on function fijar_disponibilidad(uuid, jsonb) to service_role;

-- --- 4) Indices faltantes ----------------------------------------------------
-- Revisadas todas las migraciones 0001..0010 y los filtros .eq()/.in() del codigo.
-- Ya existian (no se repiten): leads.contacto_id, servicios_publicacion.contacto_id
-- y .property_id, busqueda_inmuebles.property_id, captaciones.*, busquedas.contacto_id,
-- actividades.contacto_id, cierres.*, property_media.property_id,
-- agent_availability.agent_id, appointments.agent_id, pagos_eventos.reference.
-- Se agregan solo las llaves foraneas que una consulta filtra o que un borrado en
-- cascada / "set null" recorre (sin indice, borrar un inmueble lee la tabla entera).

-- servicios_publicacion.reference -> pagos_referencias (0008, "on delete set null").
create index if not exists servicios_reference_idx on servicios_publicacion (reference) where reference is not null;

-- servicios_publicacion.property_slug: filtro .eq("property_slug") al renombrar una ficha.
create index if not exists servicios_property_slug_idx on servicios_publicacion (property_slug) where property_slug is not null;

-- servicios_renovaciones.servicio_id -> servicios_publicacion ("on delete cascade").
create index if not exists servicios_renovaciones_servicio_idx on servicios_renovaciones (servicio_id);

-- actividades.property_id -> properties ("on delete set null").
create index if not exists actividades_property_idx on actividades (property_id) where property_id is not null;

-- appointments.property_id -> properties ("on delete cascade") y appointments.lead_id -> leads ("set null").
create index if not exists appointments_property_idx on appointments (property_id);
create index if not exists appointments_lead_idx on appointments (lead_id) where lead_id is not null;

-- leads.property_id -> properties ("on delete set null"). Mismo nombre y definicion que en
-- 0013 (CRM): si esa migracion ya lo creo, esta linea no hace nada, y al reves.
create index if not exists leads_property_idx on leads (property_id) where property_id is not null;

-- --- 5) Permisos -------------------------------------------------------------
-- La llave publica no escribe nada (0009) y tampoco ve lo nuevo. Se repite el
-- revoke de 0009 porque las tablas creadas despues heredan los permisos por
-- defecto de Supabase.
revoke insert, update, delete, truncate on all tables in schema public from anon, authenticated;

notify pgrst, 'reload schema';

-- Comprobacion (solo lectura):
-- select nombre, aplicada_at, nota from migraciones_aplicadas order by nombre;
-- select proname from pg_proc where proname in ('reemplazar_medios', 'fijar_disponibilidad');
-- select indexname from pg_indexes where schemaname = 'public' and indexname in (
--   'servicios_reference_idx', 'servicios_property_slug_idx', 'servicios_renovaciones_servicio_idx',
--   'actividades_property_idx', 'appointments_property_idx', 'appointments_lead_idx', 'leads_property_idx');
