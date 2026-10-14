-- =============================================================================
-- Roles y multiusuario (1 de 2): varios roles por cuenta.
-- Observatorio Empresarial - Uniempresarial
--
--   Una misma cuenta (un solo correo) puede tener varios roles, por ejemplo
--      Gestor Faro Empresarial y Empresa Coformadora. Los roles de cada cuenta
--      quedan en usuario_rol; usuario.id_rol es el rol principal (el de más
--      alcance) y siempre está también en usuario_rol.
-- =============================================================================

-- -----------------------------------------------------------------------------
-- Varios roles por cuenta.
-- -----------------------------------------------------------------------------
create table public.usuario_rol (
    id_usuario integer not null references public.usuario (id_usuario) on delete cascade,
    id_rol     integer not null references public.rol (id_rol) on delete restrict,
    primary key (id_usuario, id_rol)
);
comment on table public.usuario_rol is 'Roles de cada cuenta. Una cuenta puede tener varios; usuario.id_rol es el principal.';

create index usuario_rol_id_rol_idx on public.usuario_rol (id_rol);

insert into public.usuario_rol (id_usuario, id_rol)
select id_usuario, id_rol from public.usuario
on conflict do nothing;

-- El rol principal siempre está entre los roles de la cuenta. La función corre
-- con los permisos de su dueño porque quien registra la cuenta (autenticación)
-- no escribe en usuario_rol.
create function public.fn_rol_principal_en_roles()
returns trigger
language plpgsql
security definer
set search_path = ''
as $$
begin
    insert into public.usuario_rol (id_usuario, id_rol)
    values (new.id_usuario, new.id_rol)
    on conflict do nothing;
    return new;
end;
$$;
comment on function public.fn_rol_principal_en_roles() is 'Agrega el rol principal (usuario.id_rol) a los roles de la cuenta.';
revoke all on function public.fn_rol_principal_en_roles() from public;

create trigger usuario_rol_principal
    after insert or update of id_rol on public.usuario
    for each row execute function public.fn_rol_principal_en_roles();

alter table public.usuario_rol enable row level security;

-- SuperAdmin (Super Admin y Gestor Observatorio): asigna y quita roles.
grant select, insert, update, delete on public.usuario_rol to obs_superadmin;
create policy superadmin_total on public.usuario_rol for all
    to obs_superadmin using (true) with check (true);

-- Cada cuenta ve sus propios roles (obs_empresa los hereda de obs_usuario).
grant select on public.usuario_rol
   to obs_usuario, obs_gestor_faro, obs_gestor_flash, obs_gestor_empresas,
      obs_gestor_tendencias, obs_gestor_calendario;
create policy propios on public.usuario_rol for select
    to obs_usuario, obs_gestor_faro, obs_gestor_flash, obs_gestor_empresas,
       obs_gestor_tendencias, obs_gestor_calendario
    using (id_usuario = public.fn_usuario_actual());

-- Autenticación: el backend lee los roles de la cuenta en cada petición.
grant select on public.usuario_rol to obs_autenticacion;
create policy autenticacion_lectura on public.usuario_rol for select
    to obs_autenticacion using (true);
