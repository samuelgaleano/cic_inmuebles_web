-- =============================================================================
-- 0007 - CRM interno (solo administracion)
--
-- Modelo relacional: una persona (contactos) puede ser vendedora (captaciones),
-- compradora (busquedas), o ambas, y tiene una linea de tiempo (actividades).
-- Las captaciones y las busquedas se enlazan con los inmuebles (properties) por
-- llave foranea; "los numerales de inmueble 1, 2 y 3" de la hoja pasan a la
-- tabla busqueda_inmuebles (relacion N a N con estado).
--
-- Seguridad: igual que 0003, 0004 y 0005. La app solo habla con Supabase desde
-- el servidor con la service role key (omite RLS). RLS queda activa SIN politicas:
-- la anon key, que es publica por diseno, no ve ni toca nada de esto.
--
-- Es idempotente (create ... if not exists) y no borra ni modifica nada existente.
-- =============================================================================

create table if not exists contactos (
  id            uuid primary key default gen_random_uuid(),
  nombre        text not null check (length(btrim(nombre)) >= 2),
  telefono      text,
  -- Telefono en formato internacional (+573001234567): evita duplicar la misma persona.
  telefono_e164 text,
  email         text,
  ciudad        text,
  notas         text,
  origen        text not null default 'manual'
                check (origen in ('manual', 'web', 'whatsapp', 'hoja', 'referido')),
  archivado     boolean not null default false,
  created_at    timestamptz not null default now(),
  updated_at    timestamptz not null default now()
);
create unique index if not exists contactos_telefono_e164_uk on contactos (telefono_e164) where telefono_e164 is not null;
create index if not exists contactos_nombre_idx on contactos (lower(nombre));
create index if not exists contactos_email_idx on contactos (lower(email)) where email is not null;

-- Vendedores: una persona que quiere vender (o ya vende) un inmueble con CIC.
create table if not exists captaciones (
  id              uuid primary key default gen_random_uuid(),
  contacto_id     uuid not null references contactos (id) on delete restrict,
  -- El inmueble del catalogo (nulo hasta que exista la ficha).
  property_id     uuid references properties (id) on delete set null,
  ubicacion       text,
  precio_esperado bigint check (precio_esperado is null or precio_esperado >= 0),
  comision_pct    numeric(5, 2) not null default 3 check (comision_pct >= 0 and comision_pct <= 100),
  -- Calculada en la base: evita el #VALUE! de la hoja y que se desincronice.
  comision_valor  bigint generated always as ((round(precio_esperado * comision_pct / 100))::bigint) stored,
  estatus_pago    text not null default 'pendiente'
                  check (estatus_pago in ('pendiente', 'paga_completo', 'paga_parcial', 'no_paga')),
  aprobada        boolean not null default false,
  multimedia      text not null default 'por_coordinar'
                  check (multimedia in ('por_coordinar', 'en_curso', 'listo')),
  estado          text not null default 'nueva'
                  check (estado in ('nueva', 'en_gestion', 'publicada', 'vendida', 'descartada')),
  notas           text,
  created_at      timestamptz not null default now(),
  updated_at      timestamptz not null default now()
);
create index if not exists captaciones_contacto_idx on captaciones (contacto_id);
create index if not exists captaciones_property_idx on captaciones (property_id);
-- Un inmueble tiene una sola captacion vigente.
create unique index if not exists captaciones_property_vigente_uk on captaciones (property_id)
  where property_id is not null and estado <> 'descartada';

-- Compradores: lo que busca una persona, inmobiliaria o asesor independiente.
create table if not exists busquedas (
  id             uuid primary key default gen_random_uuid(),
  contacto_id    uuid not null references contactos (id) on delete restrict,
  tipo           text not null default 'comprador'
                 check (tipo in ('comprador', 'inmobiliaria', 'independiente')),
  ubicacion      text,
  precio_max     bigint check (precio_max is null or precio_max >= 0),
  especificacion text,
  potencial      boolean not null default false,
  estado         text not null default 'activa'
                 check (estado in ('activa', 'en_visitas', 'cerrada', 'descartada')),
  notas          text,
  created_at     timestamptz not null default now(),
  updated_at     timestamptz not null default now()
);
create index if not exists busquedas_contacto_idx on busquedas (contacto_id);

-- Inmuebles que se le proponen a una busqueda (reemplaza "numeral inmueble 1, 2, 3").
create table if not exists busqueda_inmuebles (
  busqueda_id uuid not null references busquedas (id) on delete cascade,
  property_id uuid not null references properties (id) on delete cascade,
  estado      text not null default 'propuesto'
              check (estado in ('propuesto', 'visito', 'oferto', 'descartado')),
  created_at  timestamptz not null default now(),
  primary key (busqueda_id, property_id)
);
create index if not exists busqueda_inmuebles_property_idx on busqueda_inmuebles (property_id);

-- Linea de tiempo de cada contacto.
create table if not exists actividades (
  id          uuid primary key default gen_random_uuid(),
  contacto_id uuid not null references contactos (id) on delete cascade,
  property_id uuid references properties (id) on delete set null,
  tipo        text not null default 'nota'
              check (tipo in ('nota', 'llamada', 'whatsapp', 'visita', 'correo')),
  detalle     text not null check (length(btrim(detalle)) >= 1),
  ocurrio_en  timestamptz not null default now(),
  created_at  timestamptz not null default now()
);
create index if not exists actividades_contacto_idx on actividades (contacto_id, ocurrio_en desc);

-- updated_at automatico (la funcion viene de 0001)
drop trigger if exists trg_contactos_updated_at on contactos;
create trigger trg_contactos_updated_at before update on contactos for each row execute function set_updated_at();
drop trigger if exists trg_captaciones_updated_at on captaciones;
create trigger trg_captaciones_updated_at before update on captaciones for each row execute function set_updated_at();
drop trigger if exists trg_busquedas_updated_at on busquedas;
create trigger trg_busquedas_updated_at before update on busquedas for each row execute function set_updated_at();

alter table contactos enable row level security;
alter table captaciones enable row level security;
alter table busquedas enable row level security;
alter table busqueda_inmuebles enable row level security;
alter table actividades enable row level security;
