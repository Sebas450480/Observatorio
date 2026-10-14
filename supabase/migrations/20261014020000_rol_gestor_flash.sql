-- =============================================================================
-- El módulo "Flash Informativo" pasa a llamarse "Flash" en toda la plataforma,
-- también el nombre de su rol gestor. El backend acepta los dos nombres, así que
-- esta migración se puede aplicar antes o después de publicar el código.
-- =============================================================================
update public.rol
   set nombre_rol      = 'Gestor Flash',
       descripcion_rol = 'Administra los eventos del Flash.',
       permisos        = 'CRUD Flash; visualizar los demás módulos'
 where nombre_rol = 'Gestor Flash Informativo';

comment on type public.tipo_evento is 'Tipo de evento (Flash y Calendario).';
comment on table public.flash_informativo_categoria is 'Categorías (etiquetas) de cada Flash.';
comment on table public.flash_informativo is 'Flash: eventos y oportunidades del entorno empresarial.';
