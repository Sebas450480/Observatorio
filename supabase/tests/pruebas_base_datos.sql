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

    update public.usuario set recordatorios_eventos = false, frecuencia_alertas = 'Diaria'
     where id_usuario = current_setting('prueba.usuario')::int;
    get diagnostics v_filas = row_count;
    if v_filas <> 1 then
        raise exception 'FALLO 3.11: el usuario no puede cambiar sus preferencias de correo';
    end if;

    insert into public.favorito (id_usuario, tipo_contenido, id_contenido)
    values (current_setting('prueba.usuario')::int, 'Flash', current_setting('prueba.flash_activo')::int);

    begin
        insert into public.favorito (id_usuario, tipo_contenido, id_contenido)
        values (current_setting('prueba.otro')::int, 'Flash', current_setting('prueba.flash_activo')::int);
        raise exception 'FALLO 3.7: el usuario puede agregar favoritos a otro usuario';
    exception when insufficient_privilege then null;
    end;

    begin
        insert into public.favorito (id_usuario, tipo_contenido, id_contenido)
        values (current_setting('prueba.usuario')::int, 'Flash', current_setting('prueba.flash_activo')::int);
        raise exception 'FALLO 3.8: se aceptó un favorito repetido';
    exception when unique_violation then null;
    end;
end;
$$;

-- Los favoritos de otro usuario no se ven.
reset role;
insert into public.favorito (id_usuario, tipo_contenido, id_contenido)
values (current_setting('prueba.otro')::int, 'Empresa', current_setting('prueba.empresa')::int);
set local role obs_usuario;
select set_config('app.id_usuario', current_setting('prueba.usuario'), true);

do $$
begin
    if exists (select 1 from public.favorito where id_usuario <> current_setting('prueba.usuario')::int) then
        raise exception 'FALLO 3.9: el usuario ve favoritos de otro usuario';
    end if;
end;
$$;

-- Al eliminar un contenido desaparecen sus favoritos (aunque los borre un gestor).
reset role;
set local role obs_gestor_flash;
select set_config('app.id_usuario', current_setting('prueba.gestor'), true);
delete from public.flash_informativo where id_fi = current_setting('prueba.flash_activo')::int;
reset role;

do $$
begin
    if exists (select 1 from public.favorito
                where tipo_contenido = 'Flash' and id_contenido = current_setting('prueba.flash_activo')::int) then
        raise exception 'FALLO 3.10: quedaron favoritos de un flash eliminado';
    end if;
end;
$$;


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

    -- Registro de una empresa por invitación: nace activa y ligada a la cuenta.
    begin
        insert into public.empresa_coformadora (nit, razon_social, sector_economico, departamento, municipio, estado_ec, id_usuario)
        select 'PRUEBA-NIT-INV', 'Invitada', 'x', 'x', 'x', 'Inactivo', id_usuario
          from public.usuario where correo = 'prueba.registro@test.co';
        raise exception 'FALLO 4.3: el registro por invitación puede crear una empresa inactiva';
    exception when insufficient_privilege then null;
    end;
    begin
        insert into public.empresa_coformadora (nit, razon_social, sector_economico, departamento, municipio)
        values ('PRUEBA-NIT-INV', 'Invitada', 'x', 'x', 'x');
        raise exception 'FALLO 4.4: el registro por invitación puede crear una empresa sin cuenta';
    exception when insufficient_privilege then null;
    end;
    insert into public.empresa_coformadora (nit, razon_social, sector_economico, departamento, municipio, id_usuario)
    select 'PRUEBA-NIT-INV', 'Invitada', 'x', 'x', 'x', id_usuario
      from public.usuario where correo = 'prueba.registro@test.co';
    begin
        delete from public.empresa_coformadora where nit = 'PRUEBA-NIT-INV';
        raise exception 'FALLO 4.5: autenticación puede eliminar empresas';
    exception when insufficient_privilege then null;
    end;
    begin
        insert into public.invitacion_empresa (nombre_contacto, apellido_contacto, correo, token_hash, fecha_vencimiento)
        values ('Falsa', 'Invitación', 'falsa@test.co', 'x', now() + interval '1 day');
        raise exception 'FALLO 4.6: autenticación puede crear invitaciones';
    exception when insufficient_privilege then null;
    end;
end;
$$;

reset role;

-- Las invitaciones son solo del SuperAdmin y del Gestor Empresas.
set local role obs_gestor_empresas;
insert into public.invitacion_empresa (nombre_contacto, apellido_contacto, correo, token_hash, fecha_vencimiento)
values ('Ana', 'Pérez', 'prueba.invitada@test.co', 'huella-1', now() + interval '7 days');
do $$
begin
    insert into public.invitacion_empresa (nombre_contacto, apellido_contacto, correo, token_hash, fecha_vencimiento)
    values ('Ana', 'Pérez', 'PRUEBA.INVITADA@test.co', 'huella-2', now() + interval '7 days');
    raise exception 'FALLO 4.7: se aceptaron dos invitaciones pendientes para el mismo correo';
exception when unique_violation then null;
end;
$$;
reset role;
set local role obs_usuario;
do $$
begin
    perform 1 from public.invitacion_empresa;
    raise exception 'FALLO 4.8: un usuario puede ver las invitaciones';
exception when insufficient_privilege then null;
end;
$$;

reset role;

-- -----------------------------------------------------------------------------
-- 4b. Empresa Coformadora: edita solo su empresa y conserva lo de un Usuario
-- -----------------------------------------------------------------------------
insert into public.usuario (nombre_usuario, apellido_usuario, correo, contrasena_hash,
                            acepta_tratamiento_datos, fecha_aceptacion_datos, id_rol)
select 'Empresa', 'Prueba', 'prueba.empresa.rol@test.co', 'x', true, now(), id_rol
  from public.rol where nombre_rol = 'Empresa Coformadora';
insert into public.empresa_coformadora (nit, razon_social, sector_economico, departamento, municipio, estado_ec, id_usuario)
select 'PRUEBA-NIT-PROPIA', 'Propia', 'x', 'x', 'x', 'Inactivo', id_usuario
  from public.usuario where correo = 'prueba.empresa.rol@test.co';
select set_config('app.id_usuario', id_usuario::text, true) from public.usuario where correo = 'prueba.empresa.rol@test.co';
set local role obs_empresa;
do $$
declare
    n integer;
begin
    if not exists (select 1 from public.empresa_coformadora where nit = 'PRUEBA-NIT-PROPIA') then
        raise exception 'FALLO 4b.1: la empresa no ve su propia ficha inactiva';
    end if;
    update public.empresa_coformadora set descripcion = 'Editada' where nit = 'PRUEBA-NIT-PROPIA';
    update public.empresa_coformadora set descripcion = 'Intrusa' where nit <> 'PRUEBA-NIT-PROPIA';
    get diagnostics n = row_count;
    if n > 0 then
        raise exception 'FALLO 4b.2: la empresa editó una empresa ajena';
    end if;
    begin
        update public.empresa_coformadora set estado_ec = 'Activo' where nit = 'PRUEBA-NIT-PROPIA';
        raise exception 'FALLO 4b.3: la empresa puede cambiar su estado';
    exception when insufficient_privilege then null;
    end;
    begin
        update public.empresa_coformadora set id_usuario = null where nit = 'PRUEBA-NIT-PROPIA';
        raise exception 'FALLO 4b.4: la empresa puede desligar su cuenta';
    exception when insufficient_privilege then null;
    end;
    -- Hereda lo del Usuario: su propio perfil.
    if (select count(*) from public.usuario) <> 1 then
        raise exception 'FALLO 4b.5: la empresa no ve (solo) su propio perfil';
    end if;
end;
$$;
reset role;
do $$
begin
    if (select descripcion from public.empresa_coformadora where nit = 'PRUEBA-NIT-PROPIA') <> 'Editada' then
        raise exception 'FALLO 4b.6: la empresa no pudo editar su ficha';
    end if;
end;
$$;

-- El registro público no puede crear cuentas de empresa sin invitación.
set local role obs_autenticacion;
do $$
begin
    insert into public.usuario (nombre_usuario, apellido_usuario, correo, contrasena_hash,
                                acepta_tratamiento_datos, fecha_aceptacion_datos, id_rol)
    select 'Sin', 'Invitación', 'prueba.sin.invitacion@test.co', 'x', true, now(), id_rol
      from public.rol where nombre_rol = 'Empresa Coformadora';
    raise exception 'FALLO 4b.7: se creó una cuenta de empresa sin invitación';
exception when insufficient_privilege then null;
end;
$$;
reset role;

-- -----------------------------------------------------------------------------
-- 4c. Varios roles por cuenta (usuario_rol)
-- -----------------------------------------------------------------------------
do $$
declare
    id_empresa integer := (select id_usuario from public.usuario where correo = 'prueba.empresa.rol@test.co');
begin
    if not exists (select 1 from public.usuario_rol ur join public.rol r using (id_rol)
                    where ur.id_usuario = id_empresa and r.nombre_rol = 'Empresa Coformadora') then
        raise exception 'FALLO 4c.1: el rol principal no quedó en usuario_rol';
    end if;
    -- La misma cuenta también es Gestor Faro.
    insert into public.usuario_rol (id_usuario, id_rol)
    select id_empresa, id_rol from public.rol where nombre_rol = 'Gestor Faro';
    if (select count(*) from public.usuario_rol where id_usuario = id_empresa) <> 2 then
        raise exception 'FALLO 4c.2: la cuenta no quedó con dos roles';
    end if;
    begin
        insert into public.usuario_rol (id_usuario, id_rol) values (id_empresa, 999999);
        raise exception 'FALLO 4c.3: se aceptó un rol que no existe';
    exception when foreign_key_violation then null;
    end;
end;
$$;
select set_config('app.id_usuario', id_usuario::text, true) from public.usuario where correo = 'prueba.empresa.rol@test.co';
set local role obs_empresa;
do $$
begin
    if (select count(*) from public.usuario_rol) <> 2 then
        raise exception 'FALLO 4c.4: la cuenta no ve (solo) sus propios roles';
    end if;
    begin
        insert into public.usuario_rol (id_usuario, id_rol)
        select public.fn_usuario_actual(), id_rol from public.rol where nombre_rol = 'Super Admin';
        raise exception 'FALLO 4c.5: una cuenta se asignó un rol a sí misma';
    exception when insufficient_privilege then null;
    end;
end;
$$;
reset role;

-- -----------------------------------------------------------------------------
-- 4d. Glosario
-- -----------------------------------------------------------------------------
insert into public.glosario_termino (termino, definicion) values ('PRUEBA Coformación', 'Definición activa');
insert into public.glosario_termino (termino, definicion, estado_gt) values ('PRUEBA Borrador', 'Definición oculta', 'Inactivo');
do $$
begin
    insert into public.glosario_termino (termino, definicion) values ('  prueba   coformación ', 'Repetido');
    raise exception 'FALLO 4d.1: se aceptó un término repetido';
exception when unique_violation then null;
end;
$$;
set local role obs_invitado;
do $$
begin
    if exists (select 1 from public.glosario_termino where termino = 'PRUEBA Borrador') then
        raise exception 'FALLO 4d.2: el invitado ve un término inactivo';
    end if;
    if not exists (select 1 from public.glosario_termino where termino = 'PRUEBA Coformación') then
        raise exception 'FALLO 4d.3: el invitado no ve un término activo';
    end if;
end;
$$;
reset role;
set local role obs_usuario;
do $$
begin
    insert into public.glosario_termino (termino, definicion) values ('PRUEBA Intruso', 'x');
    raise exception 'FALLO 4d.4: un usuario creó un término';
exception when insufficient_privilege then null;
end;
$$;
reset role;
set local role obs_gestor_glosario;
do $$
begin
    update public.glosario_termino set estado_gt = 'Activo' where termino = 'PRUEBA Borrador';
    if not found then
        raise exception 'FALLO 4d.5: el Gestor Glosario no puede editar términos';
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
        insert into public.envio_alerta (id_usuario, tipo_envio)
        values (current_setting('prueba.usuario')::int, 'Recordatorio');
        raise exception 'FALLO 6.10: se aceptó un recordatorio sin evento';
    exception when check_violation then null;
    end;

    insert into public.envio_alerta (id_usuario, tipo_envio, tipo_contenido, id_contenido, aviso)
    values (current_setting('prueba.usuario')::int, 'Recordatorio', 'Evento', 1, 'Semana');
    begin
        insert into public.envio_alerta (id_usuario, tipo_envio, tipo_contenido, id_contenido, aviso)
        values (current_setting('prueba.usuario')::int, 'Recordatorio', 'Evento', 1, 'Semana');
        raise exception 'FALLO 6.11: se repitió un recordatorio';
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
