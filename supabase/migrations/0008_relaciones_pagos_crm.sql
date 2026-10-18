-- =============================================================================
-- 0008 - Relaciones que faltaban entre pagos, planes, CRM e inmuebles
--
-- Hasta 0007 el bloque de pagos y planes (pagos_referencias, pagos_eventos,
-- servicios_publicacion) no tenia ninguna llave foranea hacia el resto:
--   - un lead y un plan pagado no apuntaban a la persona del CRM (solo coincidian
--     por telefono o correo);
--   - un plan solo conocia su inmueble por el texto del slug;
--   - la referencia del plan no estaba atada a la referencia emitida del pago;
--   - no se guardaba cuando se pago de verdad ni los rangos de fechas que cubrio.
--
-- Agrega las llaves, el momento del pago y el libro de periodos de cada plan
-- (cada tramo de vigencia concedido o recortado, con su origen). Idempotente y
-- solo agrega: no borra ni cambia filas existentes salvo rellenar las columnas
-- nuevas a partir de datos que ya coinciden (telefono, correo, slug).
-- =============================================================================

-- Leads -> persona del CRM
alter table leads add column if not exists contacto_id uuid references contactos (id) on delete set null;
create index if not exists leads_contacto_idx on leads (contacto_id);

-- Planes de publicacion -> persona, inmueble y momento real del pago
alter table servicios_publicacion add column if not exists contacto_id uuid references contactos (id) on delete set null;
alter table servicios_publicacion add column if not exists property_id uuid references properties (id) on delete set null;
-- Cuando Wompi aprobo el pago (no cuando se registro en la plataforma).
alter table servicios_publicacion add column if not exists pagado_at timestamptz;
create index if not exists servicios_contacto_idx on servicios_publicacion (contacto_id);
create index if not exists servicios_property_idx on servicios_publicacion (property_id);

-- La referencia del plan es la misma que se emitio para cobrar.
do $$
begin
  if not exists (select 1 from pg_constraint where conname = 'servicios_reference_fk') then
    alter table servicios_publicacion
      add constraint servicios_reference_fk foreign key (reference) references pagos_referencias (reference) on delete set null;
  end if;
end $$;

-- Libro de periodos: cada tramo de vigencia de un plan y por que existe.
--   activacion   primer tramo, al publicar el inmueble
--   renovacion   tramo que suma un pago de renovacion
--   suma_manual  tramo sumado a mano desde el panel
--   recorte      tiempo restante que se quito (p. ej. "Vencer ahora"): desde = cuando se corto, hasta = lo que habia
create table if not exists servicios_periodos (
  id          bigint generated always as identity primary key,
  servicio_id uuid not null references servicios_publicacion (id) on delete cascade,
  tipo        text not null check (tipo in ('activacion', 'renovacion', 'suma_manual', 'recorte')),
  desde       timestamptz not null,
  hasta       timestamptz not null check (hasta >= desde),
  tx_id       text,
  created_at  timestamptz not null default now()
);
create index if not exists servicios_periodos_servicio_idx on servicios_periodos (servicio_id, desde);
alter table servicios_periodos enable row level security;

-- Relleno con lo que ya coincide (idempotente: solo toca filas todavia sin enlazar)
update leads l
   set contacto_id = c.id
  from contactos c
 where l.contacto_id is null
   and c.telefono_e164 is not null
   and c.telefono_e164 = '+' || regexp_replace(l.telefono, '\D', '', 'g');

update servicios_publicacion s
   set contacto_id = c.id
  from contactos c
 where s.contacto_id is null
   and ((c.telefono_e164 is not null and c.telefono_e164 = '+' || regexp_replace(coalesce(s.cliente_telefono, ''), '\D', '', 'g'))
        or (c.email is not null and s.cliente_email is not null and lower(c.email) = lower(s.cliente_email)));

update servicios_publicacion s
   set property_id = p.id
  from properties p
 where s.property_id is null
   and s.property_slug is not null
   and s.property_slug = p.slug;
