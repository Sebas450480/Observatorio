-- =============================================================================
-- Mapa de tendencias: cada tendencia nueva cuenta como su primera mención.
-- Observatorio Empresarial - Uniempresarial
--
-- El mapa y el Top 5 se alimentan de mencion_tendencia, pero las tendencias
-- creadas desde el formulario o la carga masiva no registraban ninguna y el
-- mapa quedaba vacío. Ahora, al crear una tendencia, se registra una mención
-- con su fecha de publicación; las tendencias que no tienen ninguna reciben la suya.
-- =============================================================================

create function public.fn_tendencia_primera_mencion()
returns trigger
language plpgsql
security definer
set search_path = public
as $$
begin
    insert into public.mencion_tendencia (id_te, fuente, fecha)
    values (new.id_te, 'Publicación', new.fecha_publicacion);
    return new;
end;
$$;
comment on function public.fn_tendencia_primera_mencion() is
    'Registra la primera mención de una tendencia al crearla (fecha de publicación).';
revoke all on function public.fn_tendencia_primera_mencion() from public;

create trigger tendencia_empresarial_primera_mencion after insert on public.tendencia_empresarial
    for each row execute function public.fn_tendencia_primera_mencion();

insert into public.mencion_tendencia (id_te, fuente, fecha)
select t.id_te, 'Publicación', t.fecha_publicacion
from public.tendencia_empresarial t
where not exists (select 1 from public.mencion_tendencia m where m.id_te = t.id_te);
