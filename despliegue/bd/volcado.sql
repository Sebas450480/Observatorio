-- =============================================================================
-- Genera un script SQL con TODOS los datos de la base actual (no la estructura).
-- Se ejecuta con psql (usa \gexec) y la salida se guarda como datos.sql:
--   psql "$URL_ORIGEN" -X -q -At -f despliegue/bd/volcado.sql -o datos.sql
-- Lo usa despliegue/exportar-datos.sh. Funciona con cualquier versión de psql,
-- a diferencia de pg_dump, que exige la misma versión del servidor.
--
-- datos.sql se carga sobre una base recién creada con supabase/schema.sql,
-- como superusuario (postgres). Los triggers se desactivan mientras se cargan
-- los datos para conservar fechas de creación, autores y llaves tal cual.
-- =============================================================================
\pset tuples_only on
\pset format unaligned

select '-- Datos del Observatorio Empresarial exportados el ' || to_char(now() at time zone 'America/Bogota', 'YYYY-MM-DD HH24:MI') || ' (hora de Colombia)';
select 'begin;';
select 'set session_replication_role = replica;';

-- Una instrucción por tabla con sus filas en JSON. Se omite recuperacion_contrasena:
-- son enlaces temporales de "olvidé mi contraseña" que no sirven en otro servidor.
select format(
         $f$select format('insert into public.%%I overriding system value select * from json_populate_recordset(null::public.%%I, %%L);', %L, %L, coalesce(json_agg(t), '[]')) from public.%I t$f$,
         c.relname, c.relname, c.relname)
  from pg_class c
  join pg_namespace n on n.oid = c.relnamespace
 where n.nspname = 'public' and c.relkind = 'r' and c.relname <> 'recuperacion_contrasena'
 order by c.relname
\gexec

-- Los contadores de las llaves (identity) siguen desde el valor más alto cargado.
select format(
         'select setval(pg_get_serial_sequence(%L, %L), coalesce((select max(%I) from public.%I), 0) + 1, false);',
         'public.' || table_name, column_name, column_name, table_name)
  from information_schema.columns
 where table_schema = 'public' and is_identity = 'YES'
 order by table_name;

-- Las imágenes de Vercel Blob pasan a la carpeta de imágenes del servidor (/uploads/...).
-- exportar-datos.sh las descarga con la misma ruta.
select $s$update public.flash_informativo   set imagen         = regexp_replace(imagen,         '^https://[^/]+\.blob\.vercel-storage\.com/', '/uploads/') where imagen         like 'https://%.blob.vercel-storage.com/%';$s$;
select $s$update public.faro_empresarial    set imagen         = regexp_replace(imagen,         '^https://[^/]+\.blob\.vercel-storage\.com/', '/uploads/') where imagen         like 'https://%.blob.vercel-storage.com/%';$s$;
select $s$update public.empresa_coformadora set logo_ec        = regexp_replace(logo_ec,        '^https://[^/]+\.blob\.vercel-storage\.com/', '/uploads/') where logo_ec        like 'https://%.blob.vercel-storage.com/%';$s$;
select $s$update public.empresa_coformadora set imagen_portada = regexp_replace(imagen_portada, '^https://[^/]+\.blob\.vercel-storage\.com/', '/uploads/') where imagen_portada like 'https://%.blob.vercel-storage.com/%';$s$;

select 'set session_replication_role = origin;';
select 'commit;';
