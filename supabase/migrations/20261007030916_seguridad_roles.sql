-- =============================================================================
-- Fase 1 - Paso 6: Seguridad a nivel del motor (capa 2).
-- Observatorio Empresarial - Uniempresarial
--
-- Cómo funciona:
--   * Hay un rol de PostgreSQL por perfil del Observatorio (obs_*). No inician
--     sesión; solo agrupan permisos.
--   * El backend se conecta con el usuario obs_backend y, en cada petición, toma
--     el rol del usuario autenticado:
--         begin;
--         set local role obs_gestor_flash;          -- según el rol del usuario
--         set local app.id_usuario = '15';          -- id del usuario (vacío si es invitado)
--         ... consultas ...
--         commit;
--     Así, aunque el backend tuviera un error, PostgreSQL no deja que un perfil
--     haga algo que no le corresponde.
--   * Permisos por tabla (GRANT) + políticas por fila (RLS) aplican la regla de
--     estado: Usuario, Invitado y los gestores de otros módulos solo ven
--     registros Activos.
--   * La API pública de Supabase (roles anon y authenticated) queda sin acceso.
--
-- La contraseña de obs_backend NO va en el repositorio. Se define una sola vez
-- desde el editor SQL de Supabase (ver supabase/README.md).
-- =============================================================================

-- -----------------------------------------------------------------------------
-- 1. Cerrar la API pública de Supabase
-- -----------------------------------------------------------------------------
do $$
declare
    r text;
begin
    foreach r in array array['anon', 'authenticated'] loop
        if exists (select 1 from pg_roles where rolname = r) then
            execute format('revoke all on all tables    in schema public from %I', r);
            execute format('revoke all on all sequences in schema public from %I', r);
            execute format('revoke all on all functions in schema public from %I', r);
            execute format('alter default privileges in schema public revoke all on tables    from %I', r);
            execute format('alter default privileges in schema public revoke all on sequences from %I', r);
            execute format('alter default privileges in schema public revoke all on functions from %I', r);
        end if;
    end loop;
end;
$$;

-- -----------------------------------------------------------------------------
-- 2. Roles del Observatorio
-- -----------------------------------------------------------------------------
--   obs_invitado           visitante sin cuenta
--   obs_usuario            usuario registrado
--   obs_gestor_faro        Gestor Faro Empresarial
--   obs_gestor_flash       Gestor Flash Informativo
--   obs_gestor_empresas    Gestor Empresas Coformadoras
--   obs_gestor_tendencias  Gestor Tendencias
--   obs_gestor_calendario  Gestor Calendario
--   obs_superadmin         SuperAdmin
--   obs_autenticacion      uso interno del backend: login, registro y recuperar contraseña
--   obs_backend            usuario con el que se conecta el backend (único con LOGIN)
do $$
declare
    r text;
begin
    foreach r in array array[
        'obs_invitado', 'obs_usuario',
        'obs_gestor_faro', 'obs_gestor_flash', 'obs_gestor_empresas',
        'obs_gestor_tendencias', 'obs_gestor_calendario',
        'obs_superadmin', 'obs_autenticacion'
    ] loop
        if not exists (select 1 from pg_roles where rolname = r) then
            execute format('create role %I nologin', r);
        end if;
    end loop;

    if not exists (select 1 from pg_roles where rolname = 'obs_backend') then
        create role obs_backend login noinherit;
    end if;
end;
$$;

comment on role obs_backend is 'Usuario de conexión del backend. Toma el rol del usuario autenticado con SET LOCAL ROLE.';

-- El esquema extensions debe estar en la ruta de búsqueda para que las
-- comparaciones de correos (citext) no distingan mayúsculas.
alter role obs_backend set search_path to public, extensions;

grant obs_invitado, obs_usuario,
      obs_gestor_faro, obs_gestor_flash, obs_gestor_empresas,
      obs_gestor_tendencias, obs_gestor_calendario,
      obs_superadmin, obs_autenticacion
   to obs_backend;

-- Acceso a los esquemas (public: tablas; extensions: tipo citext).
grant usage on schema public, extensions
   to obs_invitado, obs_usuario,
      obs_gestor_faro, obs_gestor_flash, obs_gestor_empresas,
      obs_gestor_tendencias, obs_gestor_calendario,
      obs_superadmin, obs_autenticacion;

-- -----------------------------------------------------------------------------
-- 3. Permisos por tabla (GRANT)
-- -----------------------------------------------------------------------------

-- SuperAdmin: todo sobre todas las tablas.
grant select, insert, update, delete on all tables in schema public to obs_superadmin;

-- Rol y Categoria: todos consultan; solo el SuperAdmin modifica.
grant select on public.rol, public.categoria
   to obs_invitado, obs_usuario,
      obs_gestor_faro, obs_gestor_flash, obs_gestor_empresas,
      obs_gestor_tendencias, obs_gestor_calendario, obs_autenticacion;

-- Usuario: cada registrado consulta y edita su propio perfil (sin cambiar rol ni estado).
grant select on public.usuario
   to obs_usuario, obs_gestor_faro, obs_gestor_flash, obs_gestor_empresas,
      obs_gestor_tendencias, obs_gestor_calendario, obs_autenticacion;
grant update (apodo_usuario, nombre_usuario, apellido_usuario, correo, contrasena_hash,
              ciudad, frecuencia_alertas, fecha_cambio_contrasena)
   on public.usuario
   to obs_usuario, obs_gestor_faro, obs_gestor_flash, obs_gestor_empresas,
      obs_gestor_tendencias, obs_gestor_calendario;

-- Autenticación: registrar cuentas nuevas y cambiar contraseña al recuperarla.
grant insert on public.usuario to obs_autenticacion;
grant update (contrasena_hash, fecha_cambio_contrasena) on public.usuario to obs_autenticacion;
grant select, insert on public.usuario_interes to obs_autenticacion;
grant select, insert, update (usado) on public.recuperacion_contrasena to obs_autenticacion;

-- Intereses propios (registro y Mi perfil).
grant select, insert, delete on public.usuario_interes
   to obs_usuario, obs_gestor_faro, obs_gestor_flash, obs_gestor_empresas,
      obs_gestor_tendencias, obs_gestor_calendario;

-- Contenidos: todos los perfiles consultan (las políticas filtran por estado).
grant select on
    public.flash_informativo, public.flash_informativo_categoria,
    public.faro_empresarial,  public.faro_empresarial_categoria,
    public.empresa_coformadora, public.contacto_empresa,
    public.tendencia_empresarial, public.tendencia_categoria,
    public.fuente_tendencia, public.mencion_tendencia,
    public.calendario_eventos
   to obs_invitado, obs_usuario,
      obs_gestor_faro, obs_gestor_flash, obs_gestor_empresas,
      obs_gestor_tendencias, obs_gestor_calendario;

-- Cada gestor crea, edita y elimina solo en su módulo.
grant insert, update, delete on public.flash_informativo, public.flash_informativo_categoria
   to obs_gestor_flash;
grant insert, update, delete on public.faro_empresarial, public.faro_empresarial_categoria
   to obs_gestor_faro;
grant insert, update, delete on public.empresa_coformadora, public.contacto_empresa
   to obs_gestor_empresas;
grant insert, update, delete on public.tendencia_empresarial, public.tendencia_categoria,
                                public.fuente_tendencia, public.mencion_tendencia
   to obs_gestor_tendencias;
grant insert, update, delete on public.calendario_eventos
   to obs_gestor_calendario;

-- Actividad: cualquier perfil registra vistas, clics y compartidos; solo el SuperAdmin las consulta.
grant insert on public.actividad
   to obs_invitado, obs_usuario,
      obs_gestor_faro, obs_gestor_flash, obs_gestor_empresas,
      obs_gestor_tendencias, obs_gestor_calendario;

-- envio_alerta: solo SuperAdmin (ya incluido arriba). El envío de alertas lo
-- ejecuta el backend con el rol obs_superadmin.

-- -----------------------------------------------------------------------------
-- 4. Políticas por fila (RLS)
-- -----------------------------------------------------------------------------

-- SuperAdmin: acceso total en todas las tablas.
do $$
declare
    t text;
begin
    foreach t in array array[
        'rol', 'usuario', 'categoria', 'usuario_interes', 'recuperacion_contrasena',
        'flash_informativo', 'flash_informativo_categoria',
        'faro_empresarial', 'faro_empresarial_categoria',
        'empresa_coformadora', 'contacto_empresa',
        'tendencia_empresarial', 'tendencia_categoria', 'fuente_tendencia', 'mencion_tendencia',
        'calendario_eventos', 'actividad', 'envio_alerta'
    ] loop
        execute format(
            'create policy superadmin_total on public.%I for all to obs_superadmin using (true) with check (true)', t);
    end loop;
end;
$$;

-- Rol y Categoria: lectura para todos.
create policy lectura on public.rol for select
    to obs_invitado, obs_usuario, obs_gestor_faro, obs_gestor_flash, obs_gestor_empresas,
       obs_gestor_tendencias, obs_gestor_calendario, obs_autenticacion
    using (true);
create policy lectura on public.categoria for select
    to obs_invitado, obs_usuario, obs_gestor_faro, obs_gestor_flash, obs_gestor_empresas,
       obs_gestor_tendencias, obs_gestor_calendario, obs_autenticacion
    using (true);

-- Usuario: cada registrado ve y edita solo su propio registro.
create policy propio_lectura on public.usuario for select
    to obs_usuario, obs_gestor_faro, obs_gestor_flash, obs_gestor_empresas,
       obs_gestor_tendencias, obs_gestor_calendario
    using (id_usuario = public.fn_usuario_actual());
create policy propio_edicion on public.usuario for update
    to obs_usuario, obs_gestor_faro, obs_gestor_flash, obs_gestor_empresas,
       obs_gestor_tendencias, obs_gestor_calendario
    using (id_usuario = public.fn_usuario_actual())
    with check (id_usuario = public.fn_usuario_actual());

-- Usuario: autenticación (login, registro y recuperación de contraseña).
create policy autenticacion_lectura on public.usuario for select
    to obs_autenticacion using (true);
create policy autenticacion_registro on public.usuario for insert
    to obs_autenticacion
    with check (
        estado_usuario = 'Activo'
        and id_rol = (select r.id_rol from public.rol r where r.nombre_rol = 'Usuario')
    );
create policy autenticacion_cambio_contrasena on public.usuario for update
    to obs_autenticacion using (true) with check (true);

-- Intereses: cada registrado maneja los suyos; autenticación los guarda al registrar.
create policy propios on public.usuario_interes for all
    to obs_usuario, obs_gestor_faro, obs_gestor_flash, obs_gestor_empresas,
       obs_gestor_tendencias, obs_gestor_calendario
    using (id_usuario = public.fn_usuario_actual())
    with check (id_usuario = public.fn_usuario_actual());
create policy autenticacion on public.usuario_interes for all
    to obs_autenticacion using (true) with check (true);

-- Recuperación de contraseña: solo autenticación (y SuperAdmin).
create policy autenticacion on public.recuperacion_contrasena for all
    to obs_autenticacion using (true) with check (true);

-- Flash Informativo
create policy lectura_activos on public.flash_informativo for select
    to obs_invitado, obs_usuario, obs_gestor_faro, obs_gestor_empresas,
       obs_gestor_tendencias, obs_gestor_calendario
    using (estado_fi = 'Activo');
create policy gestion_modulo on public.flash_informativo for all
    to obs_gestor_flash using (true) with check (true);

create policy lectura on public.flash_informativo_categoria for select
    to obs_invitado, obs_usuario, obs_gestor_faro, obs_gestor_empresas,
       obs_gestor_tendencias, obs_gestor_calendario
    using (exists (select 1 from public.flash_informativo p
                   where p.id_fi = flash_informativo_categoria.id_fi));
create policy gestion_modulo on public.flash_informativo_categoria for all
    to obs_gestor_flash using (true) with check (true);

-- Faro Empresarial
create policy lectura_activos on public.faro_empresarial for select
    to obs_invitado, obs_usuario, obs_gestor_flash, obs_gestor_empresas,
       obs_gestor_tendencias, obs_gestor_calendario
    using (estado_fe = 'Activo');
create policy gestion_modulo on public.faro_empresarial for all
    to obs_gestor_faro using (true) with check (true);

create policy lectura on public.faro_empresarial_categoria for select
    to obs_invitado, obs_usuario, obs_gestor_flash, obs_gestor_empresas,
       obs_gestor_tendencias, obs_gestor_calendario
    using (exists (select 1 from public.faro_empresarial p
                   where p.id_fe = faro_empresarial_categoria.id_fe));
create policy gestion_modulo on public.faro_empresarial_categoria for all
    to obs_gestor_faro using (true) with check (true);

-- Empresas Coformadoras
create policy lectura_activos on public.empresa_coformadora for select
    to obs_invitado, obs_usuario, obs_gestor_faro, obs_gestor_flash,
       obs_gestor_tendencias, obs_gestor_calendario
    using (estado_ec = 'Activo');
create policy gestion_modulo on public.empresa_coformadora for all
    to obs_gestor_empresas using (true) with check (true);

create policy lectura on public.contacto_empresa for select
    to obs_invitado, obs_usuario, obs_gestor_faro, obs_gestor_flash,
       obs_gestor_tendencias, obs_gestor_calendario
    using (exists (select 1 from public.empresa_coformadora p
                   where p.id_ec = contacto_empresa.id_ec));
create policy gestion_modulo on public.contacto_empresa for all
    to obs_gestor_empresas using (true) with check (true);

-- Tendencias
create policy lectura_activos on public.tendencia_empresarial for select
    to obs_invitado, obs_usuario, obs_gestor_faro, obs_gestor_flash,
       obs_gestor_empresas, obs_gestor_calendario
    using (estado_te = 'Activo');
create policy gestion_modulo on public.tendencia_empresarial for all
    to obs_gestor_tendencias using (true) with check (true);

create policy lectura on public.tendencia_categoria for select
    to obs_invitado, obs_usuario, obs_gestor_faro, obs_gestor_flash,
       obs_gestor_empresas, obs_gestor_calendario
    using (exists (select 1 from public.tendencia_empresarial p
                   where p.id_te = tendencia_categoria.id_te));
create policy gestion_modulo on public.tendencia_categoria for all
    to obs_gestor_tendencias using (true) with check (true);

create policy lectura on public.fuente_tendencia for select
    to obs_invitado, obs_usuario, obs_gestor_faro, obs_gestor_flash,
       obs_gestor_empresas, obs_gestor_calendario
    using (exists (select 1 from public.tendencia_empresarial p
                   where p.id_te = fuente_tendencia.id_te));
create policy gestion_modulo on public.fuente_tendencia for all
    to obs_gestor_tendencias using (true) with check (true);

create policy lectura on public.mencion_tendencia for select
    to obs_invitado, obs_usuario, obs_gestor_faro, obs_gestor_flash,
       obs_gestor_empresas, obs_gestor_calendario
    using (exists (select 1 from public.tendencia_empresarial p
                   where p.id_te = mencion_tendencia.id_te));
create policy gestion_modulo on public.mencion_tendencia for all
    to obs_gestor_tendencias using (true) with check (true);

-- Calendario (sin estado: todos ven todos los eventos).
create policy lectura on public.calendario_eventos for select
    to obs_invitado, obs_usuario, obs_gestor_faro, obs_gestor_flash,
       obs_gestor_empresas, obs_gestor_tendencias
    using (true);
create policy gestion_modulo on public.calendario_eventos for all
    to obs_gestor_calendario using (true) with check (true);

-- Actividad: se registra a nombre propio (o sin usuario si es invitado).
create policy registro_propio on public.actividad for insert
    to obs_invitado, obs_usuario,
       obs_gestor_faro, obs_gestor_flash, obs_gestor_empresas,
       obs_gestor_tendencias, obs_gestor_calendario
    with check (id_usuario is not distinct from public.fn_usuario_actual());
