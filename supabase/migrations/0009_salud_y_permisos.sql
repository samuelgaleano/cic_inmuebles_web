-- 0009 · Salud de los procesos automaticos y permisos minimos de la llave publica.
-- Aditiva e idempotente: se puede correr dos veces. No borra datos.

-- 1) Latidos: cada cron deja aqui su ultima corrida buena o con fallos. /api/salud los lee y
--    el monitor externo (GitHub Actions) avisa si un cron dejo de correr.
create table if not exists latidos (
  nombre     text primary key,
  ok_at      timestamptz,
  fallo_at   timestamptz,
  detalle    text,
  updated_at timestamptz not null default now()
);
alter table latidos enable row level security; -- sin politicas: solo el servidor (llave de servicio)

-- 2) La llave publica (anon) solo lee columnas publicas de inmuebles publicados.
--    La politica de lectura de 0001 se mantiene (el chatbot lee el catalogo con esa llave), pero
--    antes dejaba ver tambien direccion, propietario, notas internas y carpeta de Drive.
revoke select on properties from anon, authenticated;
grant select (id, codigo, slug, titulo, tipo, estado, precio, administracion, ciudad, sector, conjunto,
              habitaciones, banos, area, parqueaderos, descripcion, destacado, publicado, created_at, updated_at)
  on properties to anon;

-- 3) Escritura revocada para anon/authenticated en todo el esquema: el sitio escribe siempre con la
--    llave de servicio. Las fotos de inmuebles publicados siguen legibles.
revoke insert, update, delete, truncate on all tables in schema public from anon, authenticated;
revoke all on latidos from anon, authenticated;

-- Comprobacion (solo lectura): debe listar solo las columnas publicas para anon.
-- select column_name from information_schema.column_privileges
--  where table_name = 'properties' and grantee = 'anon' and privilege_type = 'SELECT' order by 1;
