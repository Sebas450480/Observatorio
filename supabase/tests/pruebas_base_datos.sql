-- =============================================================================
-- Fase 1 - Paso 9: Pruebas de la base de datos.
-- Observatorio Empresarial - Uniempresarial
--
-- Cómo ejecutarlas (todo corre en una transacción que al final se deshace,
-- así que NO deja datos):
--   psql "$DATABASE_URL" -v ON_ERROR_STOP=1 -f supabase/tests/pruebas_base_datos.sql
-- o pegando el archivo en el editor SQL de Supabase.
--
-- Si alguna prueba falla, se detiene con un error que empieza por "FALLO".
-- Si todas pasan, el resultado final es "OK: todas las pruebas pasaron".
-- =============================================================================

begin;

-- Misma ruta de búsqueda que usa el backend (obs_backend).
set local search_path to public, extensions;

-- -----------------------------------------------------------------------------
-- Preparación: permitir que el usuario que ejecuta las pruebas tome cada rol,
-- y crear datos de prueba (se deshacen al final).
-- -----------------------------------------------------------------------------
grant obs_invitado, obs_usuario, obs_gestor_faro, obs_gestor_flash, obs_gestor_empresas,
      obs_gestor_tendencias, obs_gestor_calendario, obs_superadmin, obs_autenticacion
   to current_user;

insert into public.rol (nombre_rol) values
    ('SuperAdmin'), ('Usuario'), ('Gestor Flash Informativo')
on conflict (nombre_rol) do nothing;

insert into public.categoria (nombre_categoria) values ('PRUEBA categoría')
on conflict (nombre_categoria) do nothing;

with u as (
    insert into public.usuario (nombre_usuario, apellido_usuario, correo, contrasena_hash,
                                acepta_tratamiento_datos, fecha_aceptacion_datos, id_rol)
    select 'Prueba', 'Usuario', 'prueba.usuario@test.co', 'x', true, now(), id_rol
    from public.rol where nombre_rol = 'Usuario'
    returning id_usuario
) select set_config('prueba.usuario', id_usuario::text, true) from u;

with u as (
    insert into public.usuario (nombre_usuario, apellido_usuario, correo, contrasena_hash,
                                acepta_tratamiento_datos, fecha_aceptacion_datos, id_rol)
    select 'Prueba', 'Otro', 'prueba.otro@test.co', 'x', true, now(), id_rol
    from public.rol where nombre_rol = 'Usuario'
    returning id_usuario
) select set_config('prueba.otro', id_usuario::text, true) from u;

with u as (
    insert into public.usuario (nombre_usuario, apellido_usuario, correo, contrasena_hash,
                                acepta_tratamiento_datos, fecha_aceptacion_datos, id_rol)
    select 'Prueba', 'Gestor', 'prueba.gestor@test.co', 'x', true, now(), id_rol
    from public.rol where nombre_rol = 'Gestor Flash Informativo'
    returning id_usuario
) select set_config('prueba.gestor', id_usuario::text, true) from u;

with f as (
    insert into public.flash_informativo (titulo, fecha_inicio, modalidad, tipo_evento, estado_fi)
    values ('PRUEBA flash activo', now(), 'Virtual', 'Foro', 'Activo') returning id_fi
) select set_config('prueba.flash_activo', id_fi::text, true) from f;

with f as (
    insert into public.flash_informativo (titulo, fecha_inicio, modalidad, tipo_evento, estado_fi)
    values ('PRUEBA flash inactivo', now(), 'Virtual', 'Foro', 'Inactivo') returning id_fi
) select set_config('prueba.flash_inactivo', id_fi::text, true) from f;

insert into public.flash_informativo_categoria (id_fi, id_categoria)
select f.id_fi, c.id_categoria
from public.flash_informativo f, public.categoria c
where f.titulo like 'PRUEBA flash%' and c.nombre_categoria = 'PRUEBA categoría';

with f as (
    insert into public.faro_empresarial (titulo, tipo, estado_fe)
    values ('PRUEBA faro inactivo', 'Becas', 'Inactivo') returning id_fe
) select set_config('prueba.faro_inactivo', id_fe::text, true) from f;

with t as (
    insert into public.tendencia_empresarial (megatendencia, tendencia, estado_te)
    values ('PRUEBA mega', 'PRUEBA tendencia inactiva', 'Inactivo') returning id_te
) select set_config('prueba.tendencia_inactiva', id_te::text, true) from t;

insert into public.mencion_tendencia (id_te, fecha)
values (current_setting('prueba.tendencia_inactiva')::int, current_date);

with e as (
    insert into public.empresa_coformadora (nit, razon_social, sector_economico, departamento, municipio)
    values ('PRUEBA-NIT-1', 'PRUEBA Empresa', 'Pruebas', 'Bogotá D.C.', 'Bogotá') returning id_ec
) select set_config('prueba.empresa', id_ec::text, true) from e;

-- -----------------------------------------------------------------------------
-- 1. Invitado
-- -----------------------------------------------------------------------------
set local role obs_invitado;
select set_config('app.id_usuario', '', true);

do $$
begin
    if not exists (select 1 from public.flash_informativo where id_fi = current_setting('prueba.flash_activo')::int) then
        raise exception 'FALLO 1.1: el invitado no ve un flash activo';
    end if;
    if exists (select 1 from public.flash_informativo where id_fi = current_setting('prueba.flash_inactivo')::int) then
        raise exception 'FALLO 1.2: el invitado ve un flash inactivo';
    end if;
    if exists (select 1 from public.flash_informativo_categoria where id_fi = current_setting('prueba.flash_inactivo')::int) then
        raise exception 'FALLO 1.3: el invitado ve las categorías de un flash inactivo';
    end if;
    if exists (select 1 from public.v_tendencia_menciones where id_te = current_setting('prueba.tendencia_inactiva')::int) then
        raise exception 'FALLO 1.4: el invitado ve una tendencia inactiva en el mapa';
    end if;

    begin
        perform 1 from public.usuario limit 1;
        raise exception 'FALLO 1.5: el invitado puede consultar la tabla usuario';
    exception when insufficient_privilege then null;
    end;

    begin
        insert into public.flash_informativo (titulo, fecha_inicio, modalidad, tipo_evento)
        values ('x', now(), 'Virtual', 'Foro');
        raise exception 'FALLO 1.6: el invitado puede crear un flash';
    exception when insufficient_privilege then null;
    end;

    -- Registrar una vista sin usuario: permitido.
    insert into public.actividad (tipo_contenido, id_contenido, accion)
    values ('Flash', current_setting('prueba.flash_activo')::int, 'Vista');

    begin
        insert into public.actividad (id_usuario, tipo_contenido, id_contenido, accion)
        values (current_setting('prueba.usuario')::int, 'Flash', 1, 'Vista');
        raise exception 'FALLO 1.7: el invitado registra actividad a nombre de otro usuario';
    exception when insufficient_privilege then null;
    end;

    begin
        perform 1 from public.actividad limit 1;
        raise exception 'FALLO 1.8: el invitado puede consultar la actividad';
    exception when insufficient_privilege then null;
    end;
end;
$$;

reset role;

-- -----------------------------------------------------------------------------
-- 2. Gestor Flash Informativo
-- -----------------------------------------------------------------------------
set local role obs_gestor_flash;
select set_config('app.id_usuario', current_setting('prueba.gestor'), true);

do $$
declare
    v_id integer;
    v_creador integer;
begin
    if not exists (select 1 from public.flash_informativo where id_fi = current_setting('prueba.flash_inactivo')::int) then
        raise exception 'FALLO 2.1: el gestor no ve los flashes inactivos de su módulo';
    end if;

    insert into public.flash_informativo (titulo, fecha_inicio, modalidad, tipo_evento)
    values ('PRUEBA creado por gestor', now(), 'Presencial', 'Taller')
    returning id_fi, creado_por into v_id, v_creador;
    if v_creador is distinct from current_setting('prueba.gestor')::int then
        raise exception 'FALLO 2.2: creado_por no se llenó con el usuario actual';
    end if;

    update public.flash_informativo set creado_por = null, estado_fi = 'Inactivo' where id_fi = v_id;
    if (select creado_por from public.flash_informativo where id_fi = v_id) is distinct from v_creador then
        raise exception 'FALLO 2.3: se pudo cambiar creado_por';
    end if;

    if exists (select 1 from public.faro_empresarial where id_fe = current_setting('prueba.faro_inactivo')::int) then
        raise exception 'FALLO 2.4: el gestor de Flash ve un registro inactivo del Faro';
    end if;

    begin
        insert into public.faro_empresarial (titulo, tipo) values ('x', 'Becas');
        raise exception 'FALLO 2.5: el gestor de Flash puede crear en el Faro';
    exception when insufficient_privilege then null;
    end;

    if (select count(*) from public.usuario) <> 1 then
        raise exception 'FALLO 2.6: el gestor ve usuarios distintos a él';
    end if;

    begin
        perform 1 from public.v_estadisticas_resumen_mes;
        raise exception 'FALLO 2.7: el gestor puede ver el panel de estadísticas';
    exception when insufficient_privilege then null;
    end;
end;
$$;

reset role;

-- -----------------------------------------------------------------------------
-- 3. Usuario registrado
-- -----------------------------------------------------------------------------
set local role obs_usuario;
select set_config('app.id_usuario', current_setting('prueba.usuario'), true);

do $$
declare
    v_filas integer;
begin
    update public.usuario set ciudad = 'Bogotá' where id_usuario = current_setting('prueba.usuario')::int;
    get diagnostics v_filas = row_count;
    if v_filas <> 1 then
        raise exception 'FALLO 3.1: el usuario no puede editar su perfil';
    end if;

    update public.usuario set ciudad = 'Cali' where id_usuario = current_setting('prueba.otro')::int;
    get diagnostics v_filas = row_count;
    if v_filas <> 0 then
        raise exception 'FALLO 3.2: el usuario puede editar el perfil de otro';
    end if;

    begin
        update public.usuario set id_rol = id_rol where id_usuario = current_setting('prueba.usuario')::int;
        raise exception 'FALLO 3.3: el usuario puede cambiar su propio rol';
    exception when insufficient_privilege then null;
    end;

    if exists (select 1 from public.flash_informativo where id_fi = current_setting('prueba.flash_inactivo')::int) then
        raise exception 'FALLO 3.4: el usuario ve un flash inactivo';
    end if;

    insert into public.usuario_interes (id_usuario, id_categoria)
    select current_setting('prueba.usuario')::int, id_categoria
    from public.categoria where nombre_categoria = 'PRUEBA categoría';

    begin
        insert into public.usuario_interes (id_usuario, id_categoria)
        select current_setting('prueba.otro')::int, id_categoria
        from public.categoria where nombre_categoria = 'PRUEBA categoría';
        raise exception 'FALLO 3.5: el usuario puede agregar intereses a otro usuario';
    exception when insufficient_privilege then null;
    end;

    begin
        insert into public.categoria (nombre_categoria) values ('x');
        raise exception 'FALLO 3.6: el usuario puede crear categorías';
    exception when insufficient_privilege then null;
    end;
end;
$$;

reset role;

-- -----------------------------------------------------------------------------
-- 4. Autenticación (registro de cuentas)
-- -----------------------------------------------------------------------------
set local role obs_autenticacion;

do $$
begin
    insert into public.usuario (nombre_usuario, apellido_usuario, correo, contrasena_hash,
                                acepta_tratamiento_datos, fecha_aceptacion_datos, id_rol)
    select 'Nuevo', 'Registro', 'prueba.registro@test.co', 'x', true, now(), id_rol
    from public.rol where nombre_rol = 'Usuario';

    begin
        insert into public.usuario (nombre_usuario, apellido_usuario, correo, contrasena_hash,
                                    acepta_tratamiento_datos, fecha_aceptacion_datos, id_rol)
        select 'Intruso', 'Admin', 'prueba.intruso@test.co', 'x', true, now(), id_rol
        from public.rol where nombre_rol = 'SuperAdmin';
        raise exception 'FALLO 4.1: el registro público puede crear un SuperAdmin';
    exception when insufficient_privilege then null;
    end;

    if not exists (select 1 from public.usuario where correo = 'PRUEBA.USUARIO@TEST.CO') then
        raise exception 'FALLO 4.2: el login no encuentra el correo escrito en mayúsculas';
    end if;
end;
$$;

reset role;

-- -----------------------------------------------------------------------------
-- 5. SuperAdmin
-- -----------------------------------------------------------------------------
set local role obs_superadmin;

do $$
begin
    if not exists (select 1 from public.flash_informativo where id_fi = current_setting('prueba.flash_inactivo')::int) then
        raise exception 'FALLO 5.1: el SuperAdmin no ve los registros inactivos';
    end if;
    perform 1 from public.v_estadisticas_resumen_mes;
    perform 1 from public.v_estadisticas_top5_contenidos;
    perform 1 from public.v_estadisticas_intereses;
    if (select count(*) from public.actividad) < 1 then
        raise exception 'FALLO 5.2: el SuperAdmin no ve la actividad registrada';
    end if;
end;
$$;

reset role;

-- -----------------------------------------------------------------------------
-- 6. Integridad de los datos
-- -----------------------------------------------------------------------------
do $$
begin
    begin
        insert into public.usuario (nombre_usuario, apellido_usuario, correo, contrasena_hash,
                                    acepta_tratamiento_datos, fecha_aceptacion_datos, id_rol)
        select 'Dup', 'Dup', 'Prueba.Usuario@Test.co', 'x', true, now(), id_rol
        from public.rol where nombre_rol = 'Usuario';
        raise exception 'FALLO 6.1: se aceptó un correo repetido con otras mayúsculas';
    exception when unique_violation then null;
    end;

    begin
        insert into public.flash_informativo (titulo, fecha_inicio, modalidad, tipo_evento, costo)
        values ('x', now(), 'Virtual', 'Foro', -1);
        raise exception 'FALLO 6.2: se aceptó un costo negativo';
    exception when check_violation then null;
    end;

    begin
        insert into public.flash_informativo (titulo, fecha_inicio, fecha_fin, modalidad, tipo_evento)
        values ('x', now(), now() - interval '1 day', 'Virtual', 'Foro');
        raise exception 'FALLO 6.3: se aceptó una fecha de fin anterior a la de inicio';
    exception when check_violation then null;
    end;

    begin
        insert into public.calendario_eventos (titulo, fecha_inicio, modalidad, tipo_evento, costo, es_gratuito)
        values ('x', now(), 'Virtual', 'Foro', 5000, true);
        raise exception 'FALLO 6.4: se aceptó un evento gratuito con costo';
    exception when check_violation then null;
    end;

    insert into public.contacto_empresa (id_ec, nombre, es_principal)
    values (current_setting('prueba.empresa')::int, 'Contacto 1', true);
    begin
        insert into public.contacto_empresa (id_ec, nombre, es_principal)
        values (current_setting('prueba.empresa')::int, 'Contacto 2', true);
        raise exception 'FALLO 6.5: se aceptaron dos contactos principales para una empresa';
    exception when unique_violation then null;
    end;

    begin
        insert into public.empresa_coformadora (nit, razon_social, sector_economico, departamento, municipio)
        values ('PRUEBA-NIT-1', 'Otra', 'x', 'x', 'x');
        raise exception 'FALLO 6.6: se aceptó un NIT repetido';
    exception when unique_violation then null;
    end;

    begin
        perform 'Mediano'::public.tamano_empresa;
        raise exception 'FALLO 6.7: se aceptó un tamaño de empresa fuera de la lista';
    exception when invalid_text_representation then null;
    end;

    begin
        insert into public.tendencia_empresarial (megatendencia, tendencia)
        values ('PRUEBA mega', 'PRUEBA tendencia inactiva');
        raise exception 'FALLO 6.8: se aceptó una tendencia duplicada';
    exception when unique_violation then null;
    end;

    begin
        insert into public.usuario (nombre_usuario, apellido_usuario, correo, contrasena_hash,
                                    acepta_tratamiento_datos, fecha_aceptacion_datos, id_rol)
        select 'Sin', 'Permiso', 'prueba.sinpermiso@test.co', 'x', false, now(), id_rol
        from public.rol where nombre_rol = 'Usuario';
        raise exception 'FALLO 6.9: se registró un usuario sin aceptar el tratamiento de datos';
    exception when check_violation then null;
    end;
end;
$$;

select 'OK: todas las pruebas pasaron' as resultado;

rollback;
