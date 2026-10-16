-- =============================================================================
-- Carga masiva desde Excel.
-- Observatorio Empresarial - Uniempresarial
--
--   * Nuevo tipo de evento "Feria" (Flash Informativo y Eventos institucionales).
--   * Faro: campo "Dirigida a" (a quién va dirigida la beca o convocatoria).
--   * Empresas precargadas: el gestor carga las empresas desde Excel y a la vez
--     invita a su contacto. La empresa nace inactiva y con la ficha pendiente;
--     al completar el registro la cuenta nueva queda ligada a esa empresa y,
--     cuando la empresa completa su ficha desde Mi perfil, se publica.
-- =============================================================================

alter type public.tipo_evento add value if not exists 'Feria' before 'Otro';

alter table public.faro_empresarial add column dirigida_a text;
comment on column public.faro_empresarial.dirigida_a is 'A quién va dirigida la oportunidad (p. ej. "Profesionales con experiencia laboral").';

-- -----------------------------------------------------------------------------
-- Ficha pendiente: reemplaza la regla del NIT provisional como señal de que la
-- empresa aún no completa su ficha (una empresa precargada puede traer su NIT real).
-- -----------------------------------------------------------------------------
alter table public.empresa_coformadora add column ficha_pendiente boolean not null default false;
comment on column public.empresa_coformadora.ficha_pendiente is
    'La empresa (registrada o precargada por invitación) aún no completa su ficha. Se publica al completarla desde Mi perfil.';
update public.empresa_coformadora set ficha_pendiente = true where nit like 'PENDIENTE-%';

-- Una empresa que nace con NIT provisional siempre tiene la ficha pendiente.
create or replace function public.fn_empresa_ficha_pendiente() returns trigger
language plpgsql
as $$
begin
    if new.nit like 'PENDIENTE-%' then
        new.ficha_pendiente := true;
    end if;
    return new;
end;
$$;
comment on function public.fn_empresa_ficha_pendiente() is 'Marca como pendiente la ficha de las empresas que nacen con NIT provisional.';
create trigger empresa_ficha_pendiente before insert on public.empresa_coformadora
    for each row execute function public.fn_empresa_ficha_pendiente();

-- La empresa se publica cuando ella misma (rol obs_empresa) deja su ficha con los
-- datos obligatorios reales. Los cambios del gestor no la publican: él decide el estado.
create or replace function public.fn_empresa_completar_registro()
returns trigger
language plpgsql
as $$
begin
    if old.ficha_pendiente
       and current_user = 'obs_empresa'
       and new.nit not like 'PENDIENTE-%'
       and new.sector_economico <> 'Por definir'
       and new.departamento <> 'Por definir'
       and new.municipio <> 'Por definir' then
        new.estado_ec := 'Activo';
        new.ficha_pendiente := false;
    end if;
    return new;
end;
$$;
comment on function public.fn_empresa_completar_registro() is
    'Publica la empresa registrada o precargada por invitación cuando completa su ficha desde Mi perfil.';
create or replace trigger empresa_completar_registro before update on public.empresa_coformadora
    for each row execute function public.fn_empresa_completar_registro();

-- -----------------------------------------------------------------------------
-- Completar el registro de una empresa precargada: el backend (obs_autenticacion)
-- liga la cuenta nueva a la empresa que el gestor creó junto con la invitación.
-- -----------------------------------------------------------------------------
grant update (id_usuario) on public.empresa_coformadora to obs_autenticacion;
create policy autenticacion_vincular on public.empresa_coformadora for update
    to obs_autenticacion
    using (
        id_usuario is null
        and ficha_pendiente
        and exists (select 1 from public.invitacion_empresa i
                     where i.id_ec = empresa_coformadora.id_ec
                       and i.estado = 'Pendiente'
                       and i.fecha_vencimiento > now())
    )
    with check (id_usuario is not null);

comment on column public.invitacion_empresa.id_ec is
    'Empresa de la invitación: la precargada por el gestor o la creada al completar el registro.';
