-- =============================================================================
-- 0013 - CRM: resumen de contactos, llaves de idempotencia, visitas unificadas
--        y supresion de datos (Ley 1581)
--
-- 1) Vista contactos_resumen: cada contacto con cuantas captaciones y busquedas
--    no descartadas tiene y la fecha de su ultima actividad. El listado del CRM
--    la pagina de 50 en 50 en vez de leer las tablas completas y cruzarlas con
--    in() de cientos de ids. security_invoker: la vista respeta los permisos y
--    la RLS de quien consulta (la llave anonima no ve nada).
-- 2) Llaves de idempotencia: captaciones.lead_id, busquedas.lead_id,
--    actividades.lead_id, actividades.servicio_id y actividades.cita_id, cada
--    una con indice unico parcial. Pasar un lead, un plan pagado o una visita
--    realizada al CRM dos veces ya no depende de buscar una marca de texto
--    ("[lead:<id>]") entre las ultimas 500 actividades: lo garantiza la base.
--    Las marcas que ya existen se copian a las columnas nuevas (paso 2b).
-- 3) appointments.contacto_id: la visita de la agenda apunta a la persona del
--    CRM. Se rellena desde el lead de la cita (leads.contacto_id, de 0008).
-- 4) contactos.suprimido_at y leads.suprimido_at: cuando se suprimieron los
--    datos de esa persona a pedido suyo. La sincronizacion del CRM se salta lo
--    suprimido para no volver a crearlo. No hay borrado automatico por plazo:
--    el plazo de retencion lo decide CIC.
--
-- No crea leads.primer_contacto_at ni las columnas utm_* / referente /
-- pagina_entrada: esas llegan en 0012. El codigo funciona con o sin ellas.
--
-- Seguridad: igual que 0007 y 0010. Solo el servidor (service role) lee y
-- escribe; RLS activa SIN politicas en las tablas y permisos revocados a anon y
-- authenticated en lo nuevo.
--
-- Aditiva e idempotente: se puede correr dos veces. No borra filas ni cambia
-- datos existentes, salvo rellenar las columnas nuevas a partir de datos que ya
-- coinciden (marcas de texto y leads.contacto_id).
-- Requiere 0001 (leads, appointments), 0004 (servicios_publicacion),
-- 0007 (CRM), 0008 (leads.contacto_id) y 0010 (proximo contacto).
-- =============================================================================

-- 1) Resumen de contactos -----------------------------------------------------

-- Subconsultas por contacto: con los indices captaciones_contacto_idx,
-- busquedas_contacto_idx y actividades_contacto_idx cada una es una busqueda
-- por indice, y PostgREST pagina la vista con limit/offset.
create or replace view contactos_resumen
  with (security_invoker = true) as
select
  c.id,
  c.nombre,
  c.telefono,
  c.telefono_e164,
  c.email,
  c.ciudad,
  c.notas,
  c.origen,
  c.archivado,
  c.created_at,
  c.proximo_contacto_at,
  c.proximo_contacto_nota,
  (select count(*) from captaciones x where x.contacto_id = c.id and x.estado <> 'descartada')::int as captaciones,
  (select count(*) from busquedas b where b.contacto_id = c.id and b.estado <> 'descartada')::int as busquedas,
  (select max(a.ocurrio_en) from actividades a where a.contacto_id = c.id) as ultima_actividad
from contactos c;

revoke all on contactos_resumen from anon, authenticated;

-- Orden del listado (mas nuevos primero) y filtro por origen.
create index if not exists contactos_created_idx on contactos (created_at desc);
create index if not exists contactos_origen_idx on contactos (origen);

-- 2) Llaves de idempotencia ---------------------------------------------------

alter table captaciones add column if not exists lead_id uuid references leads (id) on delete set null;
alter table busquedas   add column if not exists lead_id uuid references leads (id) on delete set null;
alter table actividades add column if not exists lead_id uuid references leads (id) on delete set null;
alter table actividades add column if not exists servicio_id uuid references servicios_publicacion (id) on delete set null;
alter table actividades add column if not exists cita_id uuid references appointments (id) on delete set null;

-- Parciales: lo creado a mano (sin lead, plan ni cita) no choca entre si.
create unique index if not exists captaciones_lead_uk on captaciones (lead_id) where lead_id is not null;
create unique index if not exists busquedas_lead_uk   on busquedas (lead_id) where lead_id is not null;
create unique index if not exists actividades_lead_uk on actividades (lead_id) where lead_id is not null;
create unique index if not exists actividades_servicio_uk on actividades (servicio_id) where servicio_id is not null;
create unique index if not exists actividades_cita_uk on actividades (cita_id) where cita_id is not null;

-- 2b) Las marcas de texto que ya existen pasan a las columnas. Solo la primera
-- actividad de cada lead o plan (la nota original) y solo si el registro sigue
-- existiendo; lo que ya tiene llave no se toca.
update actividades a
   set lead_id = m.lead_id
  from (
    select distinct on (s.lead_id) s.id, s.lead_id
      from (
        select x.id, x.ocurrio_en,
               (substring(x.detalle from '\[lead:([0-9a-fA-F]{8}-[0-9a-fA-F]{4}-[0-9a-fA-F]{4}-[0-9a-fA-F]{4}-[0-9a-fA-F]{12})\]'))::uuid as lead_id
          from actividades x
         where x.lead_id is null
           and x.detalle ~ '\[lead:[0-9a-fA-F]{8}-[0-9a-fA-F]{4}-[0-9a-fA-F]{4}-[0-9a-fA-F]{4}-[0-9a-fA-F]{12}\]'
      ) s
     where exists (select 1 from leads l where l.id = s.lead_id)
     order by s.lead_id, s.ocurrio_en
  ) m
 where a.id = m.id
   and not exists (select 1 from actividades y where y.lead_id = m.lead_id);

update actividades a
   set servicio_id = m.servicio_id
  from (
    select distinct on (s.servicio_id) s.id, s.servicio_id
      from (
        select x.id, x.ocurrio_en,
               (substring(x.detalle from '\[servicio:([0-9a-fA-F]{8}-[0-9a-fA-F]{4}-[0-9a-fA-F]{4}-[0-9a-fA-F]{4}-[0-9a-fA-F]{12})\]'))::uuid as servicio_id
          from actividades x
         where x.servicio_id is null
           and x.detalle ~ '\[servicio:[0-9a-fA-F]{8}-[0-9a-fA-F]{4}-[0-9a-fA-F]{4}-[0-9a-fA-F]{4}-[0-9a-fA-F]{12}\]'
      ) s
     where exists (select 1 from servicios_publicacion sp where sp.id = s.servicio_id)
     order by s.servicio_id, s.ocurrio_en
  ) m
 where a.id = m.id
   and not exists (select 1 from actividades y where y.servicio_id = m.servicio_id);

-- 3) Visitas unificadas -------------------------------------------------------

alter table appointments add column if not exists contacto_id uuid references contactos (id) on delete set null;
create index if not exists appointments_contacto_idx on appointments (contacto_id);

update appointments ap
   set contacto_id = l.contacto_id
  from leads l
 where ap.contacto_id is null
   and ap.lead_id = l.id
   and l.contacto_id is not null;

-- Consultas filtradas que reemplazan las lecturas de tablas completas:
-- leads de un inmueble (ficha del inmueble) y leads por mes (reportes).
create index if not exists leads_property_idx on leads (property_id) where property_id is not null;

-- 4) Supresion de datos (Ley 1581) -------------------------------------------

alter table contactos add column if not exists suprimido_at timestamptz;
alter table leads     add column if not exists suprimido_at timestamptz;

-- RLS: las tablas tocadas ya la tienen activa sin politicas (0001, 0005, 0007).
-- Se repite por si alguna se creo a mano sin ella; no cambia nada si ya estaba.
alter table contactos enable row level security;
alter table captaciones enable row level security;
alter table busquedas enable row level security;
alter table actividades enable row level security;
alter table appointments enable row level security;
alter table leads enable row level security;

-- Comprobacion (solo lectura):
-- select count(*) from contactos_resumen;
-- select column_name, table_name from information_schema.columns
--  where column_name in ('lead_id', 'servicio_id', 'cita_id', 'contacto_id', 'suprimido_at')
--    and table_name in ('captaciones', 'busquedas', 'actividades', 'appointments', 'contactos', 'leads');
-- select grantee, privilege_type from information_schema.role_table_grants where table_name = 'contactos_resumen';
