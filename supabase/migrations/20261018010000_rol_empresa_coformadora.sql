-- =============================================================================
-- Rol Empresa Coformadora.
-- Observatorio Empresarial - Uniempresarial
--
-- La cuenta que completa el registro por invitación representa a su empresa:
-- tiene todo lo de un Usuario (favoritos, alertas, intereses) y además edita
-- en cualquier momento la ficha de SU empresa desde Mi perfil.
-- =============================================================================

-- Rol de PostgreSQL. Hereda los permisos y las políticas de obs_usuario.
do $$
begin
    if not exists (select 1 from pg_roles where rolname = 'obs_empresa') then
        create role obs_empresa nologin;
    end if;
end;
$$;
comment on role obs_empresa is 'Empresa Coformadora: lo mismo que obs_usuario y además edita la ficha de su propia empresa.';
grant obs_usuario to obs_empresa;
grant obs_empresa to obs_backend;

insert into public.rol (nombre_rol, descripcion_rol, permisos)
values ('Empresa Coformadora',
        'Representante de una empresa coformadora registrada por invitación.',
        'Edita la información de su propia empresa; además, lo mismo que un Usuario.')
on conflict (nombre_rol) do nothing;

-- Su empresa: la ve aunque esté inactiva y edita los datos de la ficha.
-- El estado, la cuenta ligada, los premios y el tiempo como coformadora los
-- maneja el Observatorio.
grant update (razon_social, nombre_comercial, nit, sector_economico, descripcion, tamano_empresa,
              naturaleza_juridica, codigo_ciiu, link, estudiantes_recibidos, departamento, municipio,
              direccion, telefono, correo, anio_constitucion, logo_ec, imagen_portada)
   on public.empresa_coformadora to obs_empresa;

create policy propia_lectura on public.empresa_coformadora for select
    to obs_empresa
    using (id_usuario = public.fn_usuario_actual());
create policy propia_edicion on public.empresa_coformadora for update
    to obs_empresa
    using (id_usuario = public.fn_usuario_actual())
    with check (id_usuario = public.fn_usuario_actual());

-- El registro público solo crea Usuarios; la cuenta de una empresa solo se crea
-- con una invitación pendiente para ese mismo correo.
drop policy autenticacion_registro on public.usuario;
create policy autenticacion_registro on public.usuario for insert
    to obs_autenticacion
    with check (
        estado_usuario = 'Activo'
        and (
            id_rol = (select r.id_rol from public.rol r where r.nombre_rol = 'Usuario')
            or (
                id_rol = (select r.id_rol from public.rol r where r.nombre_rol = 'Empresa Coformadora')
                and exists (select 1 from public.invitacion_empresa i
                             where i.correo = usuario.correo
                               and i.estado = 'Pendiente'
                               and i.fecha_vencimiento > now())
            )
        )
    );

-- Las cuentas que ya completaron su registro por invitación pasan al rol nuevo.
update public.usuario u
   set id_rol = (select r.id_rol from public.rol r where r.nombre_rol = 'Empresa Coformadora')
 where u.id_rol = (select r.id_rol from public.rol r where r.nombre_rol = 'Usuario')
   and exists (select 1 from public.empresa_coformadora e where e.id_usuario = u.id_usuario);
