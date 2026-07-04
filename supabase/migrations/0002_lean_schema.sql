-- =============================================================================
-- 0002 — Alinear la tabla `properties` al modelo lean (catálogo 100% venta)
--
-- Necesario cuando el proyecto de Supabase YA tenía la tabla `properties` con
-- el esquema anterior: la migración 0001 usa `create table if not exists`, así
-- que si la tabla existía no se actualizó. Este script convierte el esquema
-- viejo al nuevo de forma IDEMPOTENTE (seguro de correr varias veces) y sin
-- borrar la tabla ni sus relaciones.
-- Aplicar en el SQL Editor de Supabase.
-- =============================================================================

-- 1) Quitar columnas que ya no se usan (si existen)
alter table properties drop column if exists operacion;
alter table properties drop column if exists moneda;
alter table properties drop column if exists departamento;
alter table properties drop column if exists barrio;
alter table properties drop column if exists lat;
alter table properties drop column if exists lng;
alter table properties drop column if exists area_construida;
alter table properties drop column if exists area_total;
alter table properties drop column if exists estrato;
alter table properties drop column if exists piso;
alter table properties drop column if exists antiguedad_anios;
alter table properties drop column if exists amenidades;
alter table properties drop column if exists descripcion_corta;

-- 2) Agregar columnas del modelo lean (si faltan)
alter table properties add column if not exists administracion  bigint;
alter table properties add column if not exists sector          text;
alter table properties add column if not exists conjunto        text;
alter table properties add column if not exists area            numeric;
alter table properties add column if not exists parqueaderos    int;
alter table properties add column if not exists notas_internas  text;
alter table properties add column if not exists drive_folder_id text;
alter table properties add column if not exists descripcion     text not null default '';

-- 3) El enum operation_type queda sin uso; eliminarlo si nada lo referencia
do $$ begin
  drop type if exists operation_type;
exception when others then null; end $$;

-- 4) Forzar a PostgREST (la API de Supabase) a releer el esquema
notify pgrst, 'reload schema';
