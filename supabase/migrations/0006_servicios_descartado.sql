-- =============================================================================
-- 0006 - Estado "descartado" en servicios_publicacion
--
-- Permite sacar de la lista de /admin/vigencias un pago reversado, reembolsado,
-- duplicado o de prueba SIN borrar el registro (queda como evidencia del pago).
-- Solo amplia la lista de valores permitidos de la columna estado; no cambia ni
-- borra ninguna fila. Es idempotente: se puede ejecutar mas de una vez.
-- =============================================================================

alter table servicios_publicacion drop constraint if exists servicios_publicacion_estado_check;
alter table servicios_publicacion
  add constraint servicios_publicacion_estado_check
  check (estado in ('pendiente_publicar', 'activo', 'vencido', 'descartado'));
