-- =============================================================================
-- 0004 — Servicios de publicación contratados (vigencia, vencimiento y avisos)
--
-- Cada pago aprobado de un plan de publicación crea UN servicio (tx_id único,
-- así que repetir el procesamiento no duplica). El reloj NO arranca al pagar:
-- arranca cuando CIC publica el inmueble y lo activa desde el panel
-- (/admin/vigencias), momento en que se fijan `inicio_at` y `vence_at`. Un cron
-- diario avisa 7 y 1 día antes, y al vencer marca el servicio como vencido y
-- despublica la ficha enlazada. Solo se guardan los datos necesarios para
-- avisar (correo, nombre, teléfono) con la finalidad declarada en /privacidad.
--
-- Idempotente. Aplicar en el SQL Editor de Supabase. Mientras no se aplique,
-- el sitio funciona igual: los pagos se procesan y el panel avisa que falta
-- esta migración.
-- =============================================================================

create table if not exists servicios_publicacion (
  id                 uuid primary key default gen_random_uuid(),
  tx_id              text not null unique,
  reference          text,
  plan_id            text not null,
  -- Duración del plan en días, copiada de plans.ts al momento del pago.
  dias               integer not null check (dias > 0),
  cliente_email      text,
  cliente_nombre     text,
  cliente_telefono   text,
  estado             text not null default 'pendiente_publicar'
                     check (estado in ('pendiente_publicar', 'activo', 'vencido')),
  -- Ficha enlazada (solo planes por inmueble); en paquetes se deja nula.
  property_slug      text,
  inicio_at          timestamptz,
  vence_at           timestamptz,
  aviso_7d_at        timestamptz,
  aviso_1d_at        timestamptz,
  aviso_vencido_at   timestamptz,
  created_at         timestamptz not null default now()
);

create index if not exists servicios_estado_vence_idx on servicios_publicacion (estado, vence_at);
create index if not exists servicios_email_idx on servicios_publicacion (cliente_email);

-- Solo el servidor (service role) toca esta tabla.
alter table servicios_publicacion enable row level security;

-- Renovación pagada desde el enlace del correo: la referencia emitida recuerda
-- qué servicio renueva, y cada transacción se aplica UNA sola vez (tx_id único)
-- aunque llegue por el retorno, el webhook y la conciliación.
alter table pagos_referencias add column if not exists renueva_servicio_id uuid;

create table if not exists servicios_renovaciones (
  tx_id        text primary key,
  servicio_id  uuid not null references servicios_publicacion (id) on delete cascade,
  created_at   timestamptz not null default now()
);

alter table servicios_renovaciones enable row level security;

notify pgrst, 'reload schema';
