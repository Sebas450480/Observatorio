-- =============================================================================
-- Tipo de evento personalizado, categorías creadas por los gestores y el rol
-- "SuperAdmin Superior".
-- =============================================================================

-- -----------------------------------------------------------------------------
-- 1. Tipo de evento "Otro": nombre escrito por quien registra el evento.
-- -----------------------------------------------------------------------------
alter table public.flash_informativo  add column tipo_otro varchar(40);
alter table public.calendario_eventos add column tipo_otro varchar(40);

alter table public.flash_informativo
    add constraint flash_informativo_tipo_otro_chk check (tipo_otro is null or tipo_evento = 'Otro');
alter table public.calendario_eventos
    add constraint calendario_eventos_tipo_otro_chk check (tipo_otro is null or tipo_evento = 'Otro');

-- Si el tipo deja de ser "Otro", el nombre personalizado se borra solo.
create function public.limpiar_tipo_otro() returns trigger
    language plpgsql set search_path = '' as $$
begin
    if new.tipo_evento is distinct from 'Otro' then
        new.tipo_otro := null;
    end if;
    return new;
end;
$$;
create trigger limpiar_tipo_otro before insert or update on public.flash_informativo
    for each row execute function public.limpiar_tipo_otro();
create trigger limpiar_tipo_otro before insert or update on public.calendario_eventos
    for each row execute function public.limpiar_tipo_otro();

comment on column public.flash_informativo.tipo_otro  is 'Nombre del tipo de evento cuando tipo_evento = Otro.';
comment on column public.calendario_eventos.tipo_otro is 'Nombre del tipo de evento cuando tipo_evento = Otro.';

-- -----------------------------------------------------------------------------
-- 2. Categorías: los gestores de contenido también pueden crear categorías nuevas
--    desde los formularios (modificarlas y eliminarlas sigue siendo del SuperAdmin).
-- -----------------------------------------------------------------------------
grant insert on public.categoria
   to obs_gestor_faro, obs_gestor_flash, obs_gestor_empresas,
      obs_gestor_tendencias, obs_gestor_calendario;

create policy creacion_gestores on public.categoria for insert
    to obs_gestor_faro, obs_gestor_flash, obs_gestor_empresas,
       obs_gestor_tendencias, obs_gestor_calendario
    with check (true);

-- -----------------------------------------------------------------------------
-- 3. SuperAdmin Superior: mismas funciones que el SuperAdmin (usa el rol de
--    PostgreSQL obs_superadmin); el backend impide que un SuperAdmin le cambie el
--    rol o el estado, lo elimine o asigne este rol.
-- -----------------------------------------------------------------------------
--    En una base nueva el rol lo crea seed.sql junto con los demás; aquí solo se
--    agrega a las bases que ya tienen sus roles cargados.
insert into public.rol (nombre_rol, descripcion_rol, permisos)
select 'SuperAdmin Superior',
       'Administrador principal. Las mismas funciones del SuperAdmin; ningún otro SuperAdmin puede cambiarle el rol.',
       'Crear, modificar, eliminar y visualizar todas las tablas'
 where exists (select 1 from public.rol)
on conflict (nombre_rol) do nothing;
