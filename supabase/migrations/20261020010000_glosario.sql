-- =============================================================================
-- Glosario: términos y conceptos clave del Observatorio.
-- Observatorio Empresarial - Uniempresarial
--
--   * Todos consultan los términos activos.
--   * Los administran el Super Admin, el Gestor Observatorio y, si el Super Admin
--     delega esa tarea, las cuentas con el rol "Gestor Glosario".
--   * Los conceptos iniciales los entrega la institución.
-- =============================================================================

create table public.glosario_termino (
    id_termino          integer generated always as identity primary key,
    termino             varchar(120) not null,
    definicion          text         not null,
    fuente              varchar(300),
    estado_gt           public.estado_registro not null default 'Activo',
    creado_por          integer      references public.usuario (id_usuario) on delete set null,
    fecha_creacion      timestamptz  not null default now(),
    fecha_actualizacion timestamptz  not null default now(),

    constraint glosario_termino_chk check (length(trim(termino)) > 0),
    constraint glosario_definicion_chk check (length(trim(definicion)) > 0)
);
comment on table public.glosario_termino is 'Glosario: términos y conceptos clave del Observatorio.';
comment on column public.glosario_termino.fuente is 'Referencia o autor de la definición (opcional).';
comment on column public.glosario_termino.estado_gt is 'Inactivo: oculto al público; lo ven quienes administran el glosario.';

-- Un término no se repite (sin importar mayúsculas ni espacios de más).
create unique index glosario_termino_uk
    on public.glosario_termino (lower(regexp_replace(trim(termino), '\s+', ' ', 'g')));

create trigger glosario_termino_auditoria before insert or update on public.glosario_termino
    for each row execute function public.fn_auditoria();

alter table public.glosario_termino enable row level security;

-- Rol que se puede delegar: lo mismo que un Usuario y además administra el glosario.
do $$
begin
    if not exists (select 1 from pg_roles where rolname = 'obs_gestor_glosario') then
        create role obs_gestor_glosario nologin;
    end if;
end;
$$;
comment on role obs_gestor_glosario is 'Gestor Glosario: lo mismo que obs_usuario y además administra el glosario.';
grant obs_usuario to obs_gestor_glosario;
grant obs_gestor_glosario to obs_backend;

insert into public.rol (nombre_rol, descripcion_rol, permisos)
values ('Gestor Glosario',
        'Administra los términos y conceptos del glosario (rol delegado por el Super Admin).',
        'CRUD Glosario; visualizar los demás módulos')
on conflict (nombre_rol) do nothing;

-- Permisos. obs_empresa y obs_gestor_glosario heredan los de obs_usuario.
grant select on public.glosario_termino
   to obs_invitado, obs_usuario, obs_gestor_faro, obs_gestor_flash, obs_gestor_empresas,
      obs_gestor_tendencias, obs_gestor_calendario;
grant select, insert, update, delete on public.glosario_termino to obs_gestor_glosario, obs_superadmin;

create policy superadmin_total on public.glosario_termino for all
    to obs_superadmin using (true) with check (true);
create policy gestion_modulo on public.glosario_termino for all
    to obs_gestor_glosario using (true) with check (true);
create policy lectura_activos on public.glosario_termino for select
    to obs_invitado, obs_usuario, obs_gestor_faro, obs_gestor_flash, obs_gestor_empresas,
       obs_gestor_tendencias, obs_gestor_calendario
    using (estado_gt = 'Activo');
