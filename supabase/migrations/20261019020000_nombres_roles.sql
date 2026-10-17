-- =============================================================================
-- Roles y multiusuario (2 de 2): nombres de los roles.
-- Observatorio Empresarial - Uniempresarial
--
--   "SuperAdmin Superior" -> "Super Admin"         (control total)
--   "SuperAdmin"          -> "Gestor Observatorio" (rol transversal)
--
-- Se aplica DESPUÉS de publicar el backend que reconoce los nombres nuevos.
-- En una base nueva los roles los crea seed.sql ya con el nombre nuevo.
-- =============================================================================

update public.rol
   set nombre_rol = 'Super Admin',
       descripcion_rol = 'Control total del sistema. Solo otro Super Admin puede asignar este rol o cambiarle los roles y el estado.',
       permisos = 'Crear, modificar, eliminar y visualizar todas las tablas'
 where lower(regexp_replace(trim(nombre_rol), '\s+', ' ', 'g')) = 'superadmin superior';

update public.rol
   set nombre_rol = 'Gestor Observatorio',
       descripcion_rol = 'Rol transversal: administra todos los módulos, los usuarios, las categorías y las estadísticas.',
       permisos = 'Crear, modificar, eliminar y visualizar todas las tablas'
 where nombre_rol = 'SuperAdmin';

