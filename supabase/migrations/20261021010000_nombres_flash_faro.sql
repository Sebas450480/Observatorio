-- =============================================================================
-- Nombres de los módulos: "Flash Informativo" y "Faro".
-- Observatorio Empresarial - Uniempresarial
--
-- Renombra los roles gestores de esos módulos. El backend y el frontend
-- reconocen los nombres anteriores, así que se aplica después de publicar el código.
-- =============================================================================

update public.rol
   set nombre_rol      = 'Gestor Flash Informativo',
       descripcion_rol = 'Administra los eventos del Flash Informativo.',
       permisos        = 'CRUD Flash Informativo'
 where nombre_rol = 'Gestor Flash';

update public.rol
   set nombre_rol      = 'Gestor Faro',
       descripcion_rol = 'Administra becas, convocatorias, cursos y talleres del Faro.',
       permisos        = 'CRUD Faro'
 where nombre_rol = 'Gestor Faro Empresarial';
