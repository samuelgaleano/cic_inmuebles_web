-- =============================================================================
-- 0012 - Origen y autorizacion de los leads, y contacto del anunciante
--
-- 1) leads: de donde llego la visita (utm_source, utm_medium, utm_campaign,
--    dominio del referente y pagina de entrada), medido por el propio sitio sin
--    terceros (src/lib/cliente/origen.ts). El servidor ya los valida y recorta
--    (src/lib/leads/origen.ts); los CHECK de largo son la ultima red.
--    primer_contacto_at: primera vez que el equipo contacto a la persona. La
--    escribe la gestion del lead (otro frente); aqui solo se crea la columna.
-- 2) leads y pagos_referencias: autorizacion expresa de tratamiento de datos
--    (Ley 1581 de 2012). La casilla sin marcar es obligatoria en los formularios
--    y en el paso de pago; se guarda cuando se dio y la version de la politica
--    (POLITICA_VERSION en src/lib/config/legal.ts). pagos_referencias guarda
--    tambien el origen de quien compra un plan.
-- 3) properties.anunciante_nombre / anunciante_whatsapp: contacto directo del
--    agente o inmobiliaria en los planes de publicacion independiente (la ficha
--    muestra "Escribir al anunciante"). Son publicos a proposito, pero el sitio
--    los lee con la llave de servicio: NO se agregan al grant de columnas de
--    anon de 0009. Si el chatbot (llave publica) llegara a necesitarlos:
--      grant select (anunciante_nombre, anunciante_whatsapp) on properties to anon;
-- 4) leads.intencion es TEXT (0001), sin CHECK: el valor nuevo "alerta"
--    ("Avisenme cuando llegue uno" del catalogo) no necesita cambio de tipo.
--
-- El codigo funciona antes de aplicar esta migracion: si una columna nueva no
-- existe, el repositorio repite la escritura sin ella (se pierde el dato nuevo,
-- no el lead ni el cobro). Aplicarla cuanto antes: sin ella no queda prueba de
-- la autorizacion.
--
-- Aditiva e idempotente: se puede correr dos veces. No borra ni modifica datos.
-- Requiere 0001 (leads, properties) y 0003 (pagos_referencias).
-- Aplicar en el SQL Editor de Supabase.
-- =============================================================================

-- 1) y 2) Leads ---------------------------------------------------------------

alter table leads add column if not exists utm_source             text;
alter table leads add column if not exists utm_medium             text;
alter table leads add column if not exists utm_campaign           text;
alter table leads add column if not exists referente              text;
alter table leads add column if not exists pagina_entrada         text;
alter table leads add column if not exists primer_contacto_at     timestamptz;
alter table leads add column if not exists consentimiento_at      timestamptz;
alter table leads add column if not exists consentimiento_version text;

-- Textos cortos: los mismos topes del servidor (100 / 120 / 200 / 20 caracteres).
do $$
begin
  if not exists (select 1 from pg_constraint where conname = 'leads_origen_largo') then
    alter table leads add constraint leads_origen_largo check (
      coalesce(char_length(utm_source), 0) <= 100
      and coalesce(char_length(utm_medium), 0) <= 100
      and coalesce(char_length(utm_campaign), 0) <= 100
      and coalesce(char_length(referente), 0) <= 120
      and coalesce(char_length(pagina_entrada), 0) <= 200
      and coalesce(char_length(consentimiento_version), 0) <= 20
    );
  end if;
end $$;

-- Reportes por campana y por referente (solo filas que los tienen).
create index if not exists leads_utm_source_idx on leads (utm_source) where utm_source is not null;
create index if not exists leads_referente_idx on leads (referente) where referente is not null;

-- 2) Cobros de planes ----------------------------------------------------------

alter table pagos_referencias add column if not exists consentimiento_at      timestamptz;
alter table pagos_referencias add column if not exists consentimiento_version text;
alter table pagos_referencias add column if not exists utm_source             text;
alter table pagos_referencias add column if not exists utm_medium             text;
alter table pagos_referencias add column if not exists utm_campaign           text;
alter table pagos_referencias add column if not exists referente              text;
alter table pagos_referencias add column if not exists pagina_entrada         text;

do $$
begin
  if not exists (select 1 from pg_constraint where conname = 'pagos_referencias_origen_largo') then
    alter table pagos_referencias add constraint pagos_referencias_origen_largo check (
      coalesce(char_length(utm_source), 0) <= 100
      and coalesce(char_length(utm_medium), 0) <= 100
      and coalesce(char_length(utm_campaign), 0) <= 100
      and coalesce(char_length(referente), 0) <= 120
      and coalesce(char_length(pagina_entrada), 0) <= 200
      and coalesce(char_length(consentimiento_version), 0) <= 20
    );
  end if;
end $$;

-- 3) Anunciante de la ficha -----------------------------------------------------

alter table properties add column if not exists anunciante_nombre   text;
alter table properties add column if not exists anunciante_whatsapp text;

do $$
begin
  if not exists (select 1 from pg_constraint where conname = 'properties_anunciante_largo') then
    alter table properties add constraint properties_anunciante_largo check (
      coalesce(char_length(anunciante_nombre), 0) <= 120
      and coalesce(char_length(anunciante_whatsapp), 0) <= 24
    );
  end if;
end $$;

-- Recarga el esquema de PostgREST para que la API vea las columnas nuevas sin esperar.
notify pgrst, 'reload schema';

-- Comprobaciones (solo lectura):
-- select column_name from information_schema.columns
--  where table_name in ('leads', 'pagos_referencias', 'properties')
--    and column_name in ('utm_source', 'referente', 'pagina_entrada', 'primer_contacto_at',
--                        'consentimiento_at', 'consentimiento_version', 'anunciante_nombre', 'anunciante_whatsapp')
--  order by table_name, column_name;
-- Debe seguir SIN las columnas del anunciante para anon:
-- select column_name from information_schema.column_privileges
--  where table_name = 'properties' and grantee = 'anon' and column_name like 'anunciante%';
