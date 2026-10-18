-- =============================================================================
-- Empresas Coformadoras: solo se publican cuando la empresa acepta la invitación.
-- Observatorio Empresarial - Uniempresarial
--
--   * Toda empresa que crea el gestor o la administración (formulario o carga
--     masiva) nace inactiva y con la ficha pendiente.
--   * Mientras la ficha esté pendiente no se puede activar a mano: la empresa se
--     publica sola cuando acepta la invitación (con la autorización de datos y de
--     uso de su marca) y completa su ficha desde Mi perfil.
-- =============================================================================

create or replace function public.fn_empresa_ficha_pendiente() returns trigger
language plpgsql
as $$
begin
    if new.nit like 'PENDIENTE-%' then
        new.ficha_pendiente := true;
    end if;
    if current_user in ('obs_gestor_empresas', 'obs_superadmin') then
        new.ficha_pendiente := true;
        new.estado_ec := 'Inactivo';
    end if;
    return new;
end;
$$;
comment on function public.fn_empresa_ficha_pendiente() is
    'Las empresas creadas por el gestor o la administración, y las de NIT provisional, nacen con la ficha pendiente (e inactivas).';

alter table public.empresa_coformadora
    add constraint empresa_ficha_pendiente_oculta_chk check (not ficha_pendiente or estado_ec = 'Inactivo');
comment on constraint empresa_ficha_pendiente_oculta_chk on public.empresa_coformadora is
    'Una empresa con la ficha pendiente no se publica: espera a que acepte la invitación y complete su ficha.';
