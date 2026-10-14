-- =============================================================================
-- Favoritos: cada usuario registrado guarda elementos de Flash, Faro,
-- Empresas, Tendencias y Calendario y los consulta en su perfil.
-- Observatorio Empresarial - Uniempresarial
-- =============================================================================

create table public.favorito (
    id_favorito    integer generated always as identity primary key,
    id_usuario     integer      not null references public.usuario (id_usuario) on delete cascade,
    tipo_contenido public.tipo_contenido not null,
    id_contenido   integer      not null,
    fecha_guardado timestamptz  not null default now(),
    constraint favorito_unico_uk unique (id_usuario, tipo_contenido, id_contenido)
);
comment on table public.favorito is 'Elementos que cada usuario guardó como favoritos (banderita).';
comment on column public.favorito.id_contenido is 'Id del registro en la tabla del módulo indicado por tipo_contenido.';

create index favorito_contenido_idx on public.favorito (tipo_contenido, id_contenido);

alter table public.favorito enable row level security;

-- Cada registrado (incluidos gestores y SuperAdmin) ve, agrega y quita solo los suyos.
grant select, insert, delete on public.favorito
   to obs_usuario, obs_gestor_faro, obs_gestor_flash, obs_gestor_empresas,
      obs_gestor_tendencias, obs_gestor_calendario, obs_superadmin;

create policy propios on public.favorito for all
    to obs_usuario, obs_gestor_faro, obs_gestor_flash, obs_gestor_empresas,
       obs_gestor_tendencias, obs_gestor_calendario, obs_superadmin
    using (id_usuario = public.fn_usuario_actual())
    with check (id_usuario = public.fn_usuario_actual());

-- Al eliminar un contenido se borran los favoritos que lo apuntan. La función
-- corre con los permisos de su dueño porque quien elimina (un gestor) no puede
-- tocar los favoritos de los demás.
create function public.fn_borrar_favoritos()
returns trigger
language plpgsql
security definer
set search_path = ''
as $$
begin
    delete from public.favorito
     where tipo_contenido = tg_argv[0]::public.tipo_contenido
       and id_contenido = (to_jsonb(old) ->> tg_argv[1])::integer;
    return old;
end;
$$;
comment on function public.fn_borrar_favoritos() is 'Borra los favoritos de un contenido eliminado (argumentos: tipo_contenido, columna id).';
revoke all on function public.fn_borrar_favoritos() from public;

create trigger flash_informativo_favoritos     after delete on public.flash_informativo     for each row execute function public.fn_borrar_favoritos('Flash', 'id_fi');
create trigger faro_empresarial_favoritos      after delete on public.faro_empresarial      for each row execute function public.fn_borrar_favoritos('Faro', 'id_fe');
create trigger empresa_coformadora_favoritos   after delete on public.empresa_coformadora   for each row execute function public.fn_borrar_favoritos('Empresa', 'id_ec');
create trigger tendencia_empresarial_favoritos after delete on public.tendencia_empresarial for each row execute function public.fn_borrar_favoritos('Tendencia', 'id_te');
create trigger calendario_eventos_favoritos    after delete on public.calendario_eventos    for each row execute function public.fn_borrar_favoritos('Evento', 'id_evento');
