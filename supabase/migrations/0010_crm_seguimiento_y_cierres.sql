-- =============================================================================
-- 0010 - CRM: proximo contacto con fecha y registro de ventas cerradas
--
-- 1) contactos.proximo_contacto_at / proximo_contacto_nota: cuando volver a
--    llamar a cada persona. El panel muestra "Para hoy y vencidos" y el cron
--    /api/cron/crm-diario manda el resumen por correo a las 7:00 de Bogota.
-- 2) cierres: cada venta cerrada con su precio, fecha, vendedor, comprador y la
--    comision pactada y cobrada. Alimenta el bloque "Ventas cerradas" de Reportes.
--
-- Seguridad: igual que 0007. Solo el servidor (service role) lee y escribe; RLS
-- activa SIN politicas y permisos revocados a anon/authenticated.
--
-- Aditiva e idempotente: se puede correr dos veces. No borra ni modifica datos.
-- Requiere 0007 (contactos, captaciones, busquedas) y 0001 (properties).
-- =============================================================================

-- 1) Proximo contacto ---------------------------------------------------------

alter table contactos add column if not exists proximo_contacto_at timestamptz;
alter table contactos add column if not exists proximo_contacto_nota text;

-- Solo las personas activas con fecha: es lo que se consulta cada dia.
create index if not exists contactos_proximo_contacto_idx on contactos (proximo_contacto_at)
  where not archivado and proximo_contacto_at is not null;

-- 2) Ventas cerradas ----------------------------------------------------------

create table if not exists cierres (
  id                    uuid primary key default gen_random_uuid(),
  -- Todo enlace es opcional y sobrevive al borrado del registro enlazado (queda la venta).
  captacion_id          uuid references captaciones (id) on delete set null,
  busqueda_id           uuid references busquedas (id) on delete set null,
  property_id           uuid references properties (id) on delete set null,
  vendedor_contacto_id  uuid references contactos (id) on delete set null,
  comprador_contacto_id uuid references contactos (id) on delete set null,
  precio_venta          bigint not null check (precio_venta > 0),
  -- Dia de la venta en calendario de Bogota.
  fecha_cierre          date not null,
  comision_pct          numeric(5, 2) check (comision_pct is null or (comision_pct >= 0 and comision_pct <= 100)),
  comision_pactada      bigint check (comision_pactada is null or comision_pactada >= 0),
  comision_cobrada      bigint check (comision_cobrada is null or comision_cobrada >= 0),
  cobrada_at            date,
  notas                 text,
  created_at            timestamptz not null default now()
);

-- Una captacion se vende una sola vez: lo garantiza la base, no solo la aplicacion
-- (dos pestanas o un reintento de red no crean dos ventas). Parcial: las ventas
-- sin captacion, o cuya captacion se borro (set null), no chocan entre si.
drop index if exists cierres_captacion_idx;
create unique index if not exists cierres_captacion_unica on cierres (captacion_id)
  where captacion_id is not null;
create index if not exists cierres_busqueda_idx on cierres (busqueda_id);
create index if not exists cierres_property_idx on cierres (property_id);
create index if not exists cierres_vendedor_idx on cierres (vendedor_contacto_id);
create index if not exists cierres_comprador_idx on cierres (comprador_contacto_id);
-- Reportes por mes.
create index if not exists cierres_fecha_idx on cierres (fecha_cierre desc);

alter table cierres enable row level security; -- sin politicas: solo el servidor (llave de servicio)
revoke all on cierres from anon, authenticated;

-- Comprobacion (solo lectura):
-- select column_name from information_schema.columns where table_name = 'contactos' and column_name like 'proximo%';
-- select count(*) from cierres;
