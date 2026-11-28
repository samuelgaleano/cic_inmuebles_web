-- =============================================================================
-- 0011 - Pagos y servicios: renovacion atomica, fichas de paquetes y datos
--        que el cliente deja despues de pagar
--
-- 1) aplicar_renovacion(...): una renovacion pagada se aplica en UNA sola
--    transaccion: reclamo en servicios_renovaciones (tx_id unico), extension
--    condicionada de vence_at (solo si sigue siendo el vencimiento leido) y el
--    tramo en servicios_periodos. Si la extension no aplica, el reclamo se
--    deshace dentro de la misma funcion: nunca queda una renovacion "reclamada"
--    sin dias sumados. Antes eran tres llamadas sueltas y una caida a mitad de
--    camino podia dejar el reclamo hecho y el servicio sin extender.
--    Mientras esta funcion no exista, el sitio sigue con el camino anterior
--    (src/lib/servicios/store.ts detecta PGRST202/42883).
-- 2) servicio_fichas: que fichas cubre cada paquete (planes con "espacios").
--    El limite de espacios lo controla el panel /admin/vigencias. Al vencer un
--    paquete NO se despublica nada automaticamente (decision pendiente de CIC):
--    el aviso de vencimiento solo lista sus fichas.
-- 3) servicio_datos: lo que el cliente deja en /publica/agente/datos (enlace
--    firmado del correo de confirmacion del pago) sobre el inmueble a publicar.
--    El contacto (nombre y WhatsApp) es el que ira en la ficha publica.
--
-- Seguridad: igual que 0007 y 0010. Solo el servidor (service role) lee y
-- escribe; RLS activa SIN politicas y permisos revocados a anon/authenticated.
-- La funcion solo la puede ejecutar el service role.
--
-- Aditiva e idempotente: se puede correr dos veces. No borra ni modifica datos.
-- Requiere 0004 (servicios_publicacion, servicios_renovaciones), 0006 (estado
-- descartado), 0008 (servicios_periodos, property_id) y 0001 (properties).
-- =============================================================================

-- 1) Renovacion pagada atomica ------------------------------------------------

-- Devuelve jsonb:
--   {"resultado": "aplicada", "servicio": {...fila actualizada...}}
--   {"resultado": "ya_aplicada"}   otra llamada ya aplico esta transaccion
--   {"resultado": "conflicto"}     el vencimiento cambio entre la lectura y la
--                                  escritura (o el servicio no existe): no se
--                                  reclama nada y el siguiente intento la retoma
create or replace function aplicar_renovacion(
  p_tx_id          text,
  p_servicio_id    uuid,
  p_vence_esperado timestamptz,
  p_inicio_at      timestamptz,
  p_vence_at       timestamptz
) returns jsonb
language plpgsql
set search_path = public
as $$
declare
  v_fila servicios_publicacion%rowtype;
begin
  -- Reclamo: una transaccion de Wompi renueva una sola vez, llegue por donde llegue.
  insert into servicios_renovaciones (tx_id, servicio_id)
  values (p_tx_id, p_servicio_id)
  on conflict (tx_id) do nothing;
  if not found then
    return jsonb_build_object('resultado', 'ya_aplicada');
  end if;

  -- Extension condicionada: si otro proceso movio vence_at, no se suman dos periodos.
  update servicios_publicacion
     set estado           = 'activo',
         vence_at         = p_vence_at,
         inicio_at        = coalesce(p_inicio_at, inicio_at),
         aviso_7d_at      = null,
         aviso_1d_at      = null,
         aviso_vencido_at = null
   where id = p_servicio_id
     and vence_at is not distinct from p_vence_esperado
  returning * into v_fila;

  if not found then
    delete from servicios_renovaciones where tx_id = p_tx_id;
    return jsonb_build_object('resultado', 'conflicto');
  end if;

  -- El tramo nuevo empieza donde terminaba el anterior (si seguia vigente) o al renovar (si ya habia vencido).
  insert into servicios_periodos (servicio_id, tipo, desde, hasta, tx_id)
  values (p_servicio_id, 'renovacion', coalesce(p_inicio_at, p_vence_esperado, now()), p_vence_at, p_tx_id);

  return jsonb_build_object('resultado', 'aplicada', 'servicio', to_jsonb(v_fila));
end
$$;

revoke all on function aplicar_renovacion(text, uuid, timestamptz, timestamptz, timestamptz) from public, anon, authenticated;
grant execute on function aplicar_renovacion(text, uuid, timestamptz, timestamptz, timestamptz) to service_role;

-- 2) Fichas de cada paquete ---------------------------------------------------

create table if not exists servicio_fichas (
  id          bigint generated always as identity primary key,
  servicio_id uuid not null references servicios_publicacion (id) on delete cascade,
  -- Si se borra el inmueble, deja de ocupar su espacio en el paquete.
  property_id uuid not null references properties (id) on delete cascade,
  created_at  timestamptz not null default now(),
  unique (servicio_id, property_id)
);
create index if not exists servicio_fichas_property_idx on servicio_fichas (property_id);

alter table servicio_fichas enable row level security; -- sin politicas: solo el servidor (llave de servicio)
revoke all on servicio_fichas from anon, authenticated;

-- 3) Datos del inmueble que deja el cliente despues de pagar -------------------

create table if not exists servicio_datos (
  id                bigint generated always as identity primary key,
  servicio_id       uuid not null references servicios_publicacion (id) on delete cascade,
  tipo              text not null check (char_length(tipo) between 2 and 60),
  ciudad            text not null check (char_length(ciudad) between 2 and 80),
  sector            text check (sector is null or char_length(sector) <= 80),
  -- Pesos colombianos.
  precio            bigint check (precio is null or precio > 0),
  descripcion       text check (descripcion is null or char_length(descripcion) <= 600),
  -- Contacto que ira en la ficha publica (no necesariamente quien pago).
  contacto_nombre   text not null check (char_length(contacto_nombre) between 2 and 120),
  contacto_whatsapp text not null check (char_length(contacto_whatsapp) between 7 and 24),
  created_at        timestamptz not null default now()
);
create index if not exists servicio_datos_servicio_idx on servicio_datos (servicio_id, created_at desc);

alter table servicio_datos enable row level security; -- sin politicas: solo el servidor (llave de servicio)
revoke all on servicio_datos from anon, authenticated;

notify pgrst, 'reload schema';

-- Comprobacion (solo lectura):
-- select proname from pg_proc where proname = 'aplicar_renovacion';
-- select count(*) from servicio_fichas;
-- select count(*) from servicio_datos;
