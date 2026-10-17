-- =============================================================================
-- 0005 — RLS en las tablas que faltaban y cierre de la insercion publica de leads
--
-- Contexto (verificado en el codigo el 2026-10-17):
--  - La app solo habla con Supabase desde el servidor y con la service role key
--    (src/lib/data/supabase/client.ts -> getSupabaseAdmin). La service role
--    omite RLS, asi que nada de esto cambia lo que hace el sitio.
--  - Los leads entran por la server action createLeadAction
--    (src/lib/actions/leads.ts -> getRepository().leads.create), es decir, por
--    el servidor con service role. La politica "public insert leads" de 0001
--    solo servia para que cualquiera con la anon key (que es publica por diseno)
--    insertara filas directo por la API REST, saltandose validacion y honeypot.
--  - 0001 activo RLS solo en properties, property_media y leads. agents,
--    agent_availability, appointments y templates quedaron SIN RLS: con los
--    permisos por defecto de Supabase sobre el esquema public, la anon key
--    podria leerlas y escribirlas (citas con nombre y telefono de clientes,
--    correos de agentes, plantillas). No se verifico contra la base de
--    produccion. 0003 y 0004 ya activan RLS en sus tablas.
--
-- Con RLS activo y sin politicas, anon y authenticated no ven ni tocan nada;
-- la service role sigue igual.
--
-- Idempotente (seguro de correr varias veces). Se aplica A MANO en el SQL
-- Editor de Supabase; no hay pipeline de migraciones en este proyecto.
-- =============================================================================

alter table if exists agents             enable row level security;
alter table if exists agent_availability enable row level security;
alter table if exists appointments       enable row level security;
alter table if exists templates          enable row level security;

-- Los leads solo entran por el servidor (service role): fuera la insercion anonima.
drop policy if exists "public insert leads" on leads;

-- Forzar a PostgREST (la API de Supabase) a releer el esquema.
notify pgrst, 'reload schema';

-- Comprobacion despues de aplicar (debe devolver rowsecurity = true en las 7 tablas
-- y ninguna fila en la segunda consulta):
--   select tablename, rowsecurity from pg_tables
--    where schemaname = 'public'
--      and tablename in ('agents','agent_availability','appointments','templates',
--                        'properties','property_media','leads');
--   select policyname from pg_policies where tablename = 'leads';

-- La purga del payload de pagos la llama solo el servidor (service role) desde el cron.
revoke execute on function pagos_purgar_raw() from anon, authenticated, public;
