-- =============================================================================
-- CIC Inmuebles — Esquema inicial (PostgreSQL / Supabase)
-- Fuente de verdad del catálogo. Diseñado para crecer sin romper compatibilidad.
-- Aplicar en el SQL Editor de Supabase o con la CLI: `supabase db push`.
-- =============================================================================

create extension if not exists "pgcrypto";

-- --- Tipos enumerados --------------------------------------------------------
do $$ begin
  create type property_type as enum
    ('apartamento','casa','apartaestudio','casa_campestre','oficina','local','bodega','lote','finca');
exception when duplicate_object then null; end $$;

do $$ begin
  create type operation_type as enum ('venta','arriendo');
exception when duplicate_object then null; end $$;

do $$ begin
  create type property_status as enum ('disponible','en_proceso','vendido');
exception when duplicate_object then null; end $$;

do $$ begin
  create type media_type as enum ('image','video');
exception when duplicate_object then null; end $$;

do $$ begin
  create type media_provider as enum ('cloudinary','youtube','drive','external');
exception when duplicate_object then null; end $$;

do $$ begin
  create type lead_type as enum ('comprador','vendedor');
exception when duplicate_object then null; end $$;

do $$ begin
  create type lead_status as enum ('nuevo','contactado','en_proceso','cerrado','descartado');
exception when duplicate_object then null; end $$;

do $$ begin
  create type agent_role as enum ('admin','agente_master','agente');
exception when duplicate_object then null; end $$;

do $$ begin
  create type appointment_status as enum
    ('solicitada','confirmada','realizada','cancelada','no_asistio');
exception when duplicate_object then null; end $$;

-- --- Utilidad: actualizar updated_at -----------------------------------------
create or replace function set_updated_at()
returns trigger language plpgsql as $$
begin
  new.updated_at = now();
  return new;
end $$;

-- --- Agentes (vinculados a auth.users de Supabase) ---------------------------
create table if not exists agents (
  id          uuid primary key default gen_random_uuid(),
  user_id     uuid references auth.users(id) on delete set null,
  nombre      text not null,
  email       text not null unique,
  telefono    text,
  foto_url    text,
  rol         agent_role not null default 'agente',
  activo      boolean not null default true,
  created_at  timestamptz not null default now()
);

-- --- Inmuebles ---------------------------------------------------------------
create table if not exists properties (
  id              uuid primary key default gen_random_uuid(),
  codigo          text not null unique,
  slug            text not null unique,
  titulo          text not null,
  tipo            property_type not null,
  operacion       operation_type not null,
  estado          property_status not null default 'disponible',

  precio          bigint not null,
  moneda          text not null default 'COP',

  -- Ubicación (la dirección exacta es privada)
  departamento    text not null,
  ciudad          text not null,
  barrio          text,
  direccion       text,
  lat             double precision,
  lng             double precision,

  -- Características (campos opcionales según el tipo de inmueble)
  habitaciones    int,
  banos           int,
  area_construida numeric,
  area_total      numeric,
  parqueaderos    int,
  estrato         int,
  piso            int,
  antiguedad_anios int,
  administracion  bigint,

  amenidades      text[] not null default '{}',
  descripcion     text not null default '',
  descripcion_corta text not null default '',

  -- Propietario (privado)
  propietario_nombre   text,
  propietario_telefono text,
  propietario_email    text,

  -- Integración híbrida con Google Drive
  drive_folder_id text,

  destacado       boolean not null default false,
  publicado       boolean not null default false,
  agente_id       uuid references agents(id) on delete set null,

  created_at      timestamptz not null default now(),
  updated_at      timestamptz not null default now()
);

create index if not exists idx_properties_estado on properties(estado);
create index if not exists idx_properties_ciudad on properties(ciudad);
create index if not exists idx_properties_tipo on properties(tipo);
create index if not exists idx_properties_operacion on properties(operacion);
create index if not exists idx_properties_publicado on properties(publicado);

drop trigger if exists trg_properties_updated_at on properties;
create trigger trg_properties_updated_at before update on properties
  for each row execute function set_updated_at();

-- --- Medios del inmueble -----------------------------------------------------
create table if not exists property_media (
  id            uuid primary key default gen_random_uuid(),
  property_id   uuid not null references properties(id) on delete cascade,
  tipo          media_type not null,
  provider      media_provider not null,
  url           text not null,
  thumbnail_url text,
  alt           text,
  orden         int not null default 0,
  is_cover      boolean not null default false,
  created_at    timestamptz not null default now()
);
create index if not exists idx_media_property on property_media(property_id);

-- --- Disponibilidad de agentes (agenda - Fase 2) -----------------------------
create table if not exists agent_availability (
  id          uuid primary key default gen_random_uuid(),
  agent_id    uuid not null references agents(id) on delete cascade,
  dia_semana  int not null check (dia_semana between 0 and 6),
  hora_inicio time not null,
  hora_fin    time not null
);
create index if not exists idx_availability_agent on agent_availability(agent_id);

-- --- Leads (clientes potenciales) --------------------------------------------
create table if not exists leads (
  id            uuid primary key default gen_random_uuid(),
  tipo          lead_type not null,
  nombre        text not null,
  telefono      text not null,
  email         text,
  mensaje       text,
  intencion     text,
  property_id   uuid references properties(id) on delete set null,
  property_slug text,
  preferencia   text,
  tipo_inmueble text,
  ciudad        text,
  fuente        text not null default 'web',
  estado        lead_status not null default 'nuevo',
  agente_id     uuid references agents(id) on delete set null,
  created_at    timestamptz not null default now()
);
create index if not exists idx_leads_estado on leads(estado);
create index if not exists idx_leads_created on leads(created_at desc);

-- --- Citas / visitas (agenda - Fase 2) ---------------------------------------
create table if not exists appointments (
  id               uuid primary key default gen_random_uuid(),
  property_id      uuid not null references properties(id) on delete cascade,
  agent_id         uuid references agents(id) on delete set null,
  lead_id          uuid references leads(id) on delete set null,
  cliente_nombre   text not null,
  cliente_telefono text not null,
  cliente_email    text,
  inicio_en        timestamptz not null,
  duracion_min     int not null default 60,
  estado           appointment_status not null default 'solicitada',
  notas            text,
  created_at       timestamptz not null default now()
);
create index if not exists idx_appointments_inicio on appointments(inicio_en);
create index if not exists idx_appointments_agent on appointments(agent_id);

-- --- Plantillas (promesa de venta, etc. - Fase 3) ----------------------------
create table if not exists templates (
  id          uuid primary key default gen_random_uuid(),
  nombre      text not null,
  tipo        text not null,
  contenido   text not null,
  created_at  timestamptz not null default now(),
  updated_at  timestamptz not null default now()
);
drop trigger if exists trg_templates_updated_at on templates;
create trigger trg_templates_updated_at before update on templates
  for each row execute function set_updated_at();

-- =============================================================================
-- Row Level Security (RLS)
-- El sitio público lee inmuebles publicados; la escritura es solo del panel
-- admin (a través de la service role key, que omite RLS). Ver ARQUITECTURA.md.
-- =============================================================================
alter table properties enable row level security;
alter table property_media enable row level security;
alter table leads enable row level security;

-- Lectura pública de inmuebles publicados
drop policy if exists "public read published properties" on properties;
create policy "public read published properties" on properties
  for select using (publicado = true);

-- Lectura pública de medios de inmuebles publicados
drop policy if exists "public read media of published" on property_media;
create policy "public read media of published" on property_media
  for select using (
    exists (select 1 from properties p where p.id = property_id and p.publicado = true)
  );

-- Inserción pública de leads (desde los formularios del sitio)
drop policy if exists "public insert leads" on leads;
create policy "public insert leads" on leads
  for insert with check (true);
