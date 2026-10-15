-- =============================================================================
-- Registro corto de empresas por invitación.
-- Observatorio Empresarial - Uniempresarial
--
--   * Con el enlace del correo la empresa solo crea su contraseña. La ficha de la
--     empresa nace pendiente: inactiva (no se publica) y con un NIT provisional
--     "PENDIENTE-<invitación>".
--   * La cuenta completa la ficha desde Mi perfil. Al guardar el NIT real la
--     empresa queda activa y se publica en el directorio.
-- =============================================================================

-- La empresa por invitación puede nacer activa (registro anterior) o pendiente.
drop policy autenticacion_registro on public.empresa_coformadora;
create policy autenticacion_registro on public.empresa_coformadora for insert
    to obs_autenticacion
    with check (id_usuario is not null and (estado_ec = 'Activo' or nit like 'PENDIENTE-%'));

-- Al reemplazar el NIT provisional por el real, la empresa se publica.
create or replace function public.fn_empresa_completar_registro()
returns trigger
language plpgsql
as $$
begin
    if old.nit like 'PENDIENTE-%' and new.nit not like 'PENDIENTE-%' then
        new.estado_ec := 'Activo';
    end if;
    return new;
end;
$$;
comment on function public.fn_empresa_completar_registro() is
    'Publica la empresa registrada por invitación cuando completa su ficha (cambia el NIT provisional).';

create trigger empresa_completar_registro before update of nit on public.empresa_coformadora
    for each row execute function public.fn_empresa_completar_registro();

-- Una empresa con NIT provisional no se puede publicar.
alter table public.empresa_coformadora
    add constraint empresa_nit_provisional_chk check (nit not like 'PENDIENTE-%' or estado_ec = 'Inactivo');
