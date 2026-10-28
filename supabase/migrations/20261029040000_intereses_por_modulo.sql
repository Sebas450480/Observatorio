-- Intereses por módulo (Mi perfil y registro), máximo 5 por módulo:
--   Faro:            categorías (tabla usuario_interes, como antes).
--   Flash:           tipos de evento.
--   Empresa:         sectores económicos ("Otro" = sectores fuera de la lista).
--   Tendencia:       megatendencias.
-- Los eventos institucionales no tienen intereses: se siguen con favoritos.

-- "Tecnologia" (sin tilde) es la misma categoría que "Tecnología": se unen.
do $$
declare
    buena integer := (select id_categoria from public.categoria where nombre_categoria = 'Tecnología');
    repetida integer := (select id_categoria from public.categoria where nombre_categoria = 'Tecnologia');
begin
    if buena is null or repetida is null then
        return;
    end if;
    insert into public.flash_informativo_categoria (id_fi, id_categoria)
        select id_fi, buena from public.flash_informativo_categoria where id_categoria = repetida on conflict do nothing;
    insert into public.faro_empresarial_categoria (id_fe, id_categoria)
        select id_fe, buena from public.faro_empresarial_categoria where id_categoria = repetida on conflict do nothing;
    insert into public.tendencia_categoria (id_te, id_categoria)
        select id_te, buena from public.tendencia_categoria where id_categoria = repetida on conflict do nothing;
    insert into public.usuario_interes (id_usuario, id_categoria)
        select id_usuario, buena from public.usuario_interes where id_categoria = repetida on conflict do nothing;
    delete from public.flash_informativo_categoria where id_categoria = repetida;
    delete from public.faro_empresarial_categoria where id_categoria = repetida;
    delete from public.tendencia_categoria where id_categoria = repetida;
    delete from public.usuario_interes where id_categoria = repetida;
    delete from public.categoria where id_categoria = repetida;
end;
$$;

-- Los intereses de categorías pasan a ser los de Faro: se conservan los 5 más usados en Faro.
delete from public.usuario_interes ui
 using (
   select ui2.id_usuario, ui2.id_categoria,
          row_number() over (partition by ui2.id_usuario
                             order by (select count(*) from public.faro_empresarial_categoria fc where fc.id_categoria = ui2.id_categoria) desc,
                                      ui2.id_categoria) as puesto
     from public.usuario_interes ui2
 ) x
 where x.id_usuario = ui.id_usuario and x.id_categoria = ui.id_categoria and x.puesto > 5;

create table public.usuario_preferencia (
    id_usuario integer      not null references public.usuario (id_usuario) on delete cascade,
    modulo     varchar(10)  not null check (modulo in ('Flash', 'Empresa', 'Tendencia')),
    valor      varchar(100) not null,
    primary key (id_usuario, modulo, valor)
);
comment on table public.usuario_preferencia is
  'Intereses por módulo (máx. 5 cada uno): tipos de evento del Flash, sectores de empresas y megatendencias. Los de Faro están en usuario_interes.';

alter table public.usuario_preferencia enable row level security;
grant select, insert on public.usuario_preferencia to obs_autenticacion;
grant select, insert, delete on public.usuario_preferencia
   to obs_usuario, obs_gestor_faro, obs_gestor_flash, obs_gestor_empresas,
      obs_gestor_tendencias, obs_gestor_calendario;
grant select, insert, update, delete on public.usuario_preferencia to obs_superadmin;
create policy propios on public.usuario_preferencia for all
    to obs_usuario, obs_gestor_faro, obs_gestor_flash, obs_gestor_empresas,
       obs_gestor_tendencias, obs_gestor_calendario
    using (id_usuario = public.fn_usuario_actual())
    with check (id_usuario = public.fn_usuario_actual());
create policy autenticacion on public.usuario_preferencia for all
    to obs_autenticacion using (true) with check (true);
create policy superadmin_total on public.usuario_preferencia for all to obs_superadmin using (true) with check (true);
