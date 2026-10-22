-- Bucket público de Supabase Storage para las imágenes subidas (Faro, Flash y empresas).
-- Solo el backend sube y borra (con la llave secreta); cualquiera puede ver las imágenes.
-- Fuera de Supabase (pruebas, servidor propio) no existe el esquema storage y no hace nada.
do $$
begin
  if exists (select 1 from pg_namespace where nspname = 'storage') then
    insert into storage.buckets (id, name, public, file_size_limit, allowed_mime_types)
    values ('imagenes', 'imagenes', true, 5242880, array['image/jpeg', 'image/png'])
    on conflict (id) do nothing;
  end if;
end
$$;
