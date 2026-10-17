-- El rol "SuperAdmin Superior" quedó escrito "SuperAdmin superior" en la base de
-- producción. La aplicación ya lo reconoce sin importar mayúsculas, pero se deja el
-- nombre oficial para que coincida en todas partes.
update public.rol
   set nombre_rol = 'SuperAdmin Superior'
 where lower(regexp_replace(btrim(nombre_rol), '\s+', ' ', 'g')) = 'superadmin superior'
   and nombre_rol <> 'SuperAdmin Superior';
