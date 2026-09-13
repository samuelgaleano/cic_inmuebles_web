-- =============================================================================
-- 0003 — Registro de pagos de Wompi (referencias emitidas, eventos y avisos)
--
-- Da persistencia al webhook: la idempotencia y el anti-replay dejan de vivir
-- en memoria y pasan a la restriccion UNIQUE de `pagos_eventos`; el aviso al
-- negocio se reclama de forma atomica en `pagos_avisos` para que dos lambdas
-- simultaneas (webhook + retorno del widget) no manden dos correos. Tambien
-- permite reconciliar (cron) y responder "¿llego el pago X?" con una consulta.
-- Idempotente. Aplicar en el SQL Editor de Supabase.
-- =============================================================================

create table if not exists pagos_referencias (
  reference        text primary key,
  plan_id          text not null,
  amount_in_cents  bigint not null,
  created_at       timestamptz not null default now(),
  -- Cuando la reconciliacion ya la busco en Wompi sin encontrar transaccion
  -- (checkout abandonado); se reporta una sola vez.
  revisada_at      timestamptz
);

create table if not exists pagos_eventos (
  id               bigint generated always as identity primary key,
  tx_id            text not null,
  status           text not null,
  -- Tiempo UNIX del evento segun Wompi (constante entre reintentos). Para
  -- confirmaciones por retorno o por cron se usa 0.
  event_timestamp  bigint not null default 0,
  source           text not null check (source in ('webhook', 'redirect', 'cron')),
  reference        text,
  amount_in_cents  bigint,
  plan_id          text,
  amount_ok        boolean,
  estado           text not null check (estado in ('ok', 'revisar', 'sin_destino', 'sin_verificar')),
  notified_at      timestamptz,
  -- Payload crudo solo para eventos del webhook (auditoria). Contiene el
  -- correo del comprador: la reconciliacion diaria lo purga a las 72 h.
  raw              jsonb,
  received_at      timestamptz not null default now(),
  constraint pagos_eventos_unico unique (tx_id, status, event_timestamp)
);

create index if not exists pagos_eventos_tx_idx on pagos_eventos (tx_id);
create index if not exists pagos_eventos_received_idx on pagos_eventos (received_at desc);
create index if not exists pagos_eventos_reference_idx on pagos_eventos (reference);

-- Reclamo atomico del aviso al negocio: una fila por transaccion. Quien inserta
-- la fila envia el correo; `sent_at` se marca al confirmar Resend. Un reclamo
-- con `sent_at` nulo y `claimed_at` viejo es de una lambda que murio y se
-- puede volver a reclamar.
create table if not exists pagos_avisos (
  tx_id       text primary key,
  claimed_at  timestamptz not null default now(),
  sent_at     timestamptz
);

-- Solo el servidor (service role) toca estas tablas.
alter table pagos_referencias enable row level security;
alter table pagos_eventos enable row level security;
alter table pagos_avisos enable row level security;

-- Minimizacion de datos: el payload crudo se descarta pasadas 72 h. La llama
-- la reconciliacion diaria (rpc).
create or replace function pagos_purgar_raw() returns integer language sql as $$
  with u as (
    update pagos_eventos set raw = null
    where raw is not null and received_at < now() - interval '72 hours'
    returning 1
  ) select count(*)::integer from u;
$$;

notify pgrst, 'reload schema';
