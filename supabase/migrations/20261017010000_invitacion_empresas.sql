-- =============================================================================
-- Empresas coformadoras por invitación.
-- Observatorio Empresarial - Uniempresarial
--
--   1. El SuperAdmin o el Gestor Empresas registra el contacto inicial
--      (nombre, apellido y correo). El sistema le envía un correo con un enlace.
--   2. Con ese enlace la empresa crea su contraseña y diligencia su información.
--   3. Al terminar, la empresa queda Activa en el directorio público y la cuenta
--      del contacto queda ligada a su empresa (empresa_coformadora.id_usuario).
-- =============================================================================

create type public.estado_invitacion as enum ('Pendiente', 'Completada', 'Anulada');
comment on type public.estado_invitacion is 'Estado de una invitación a una empresa coformadora.';

create table public.invitacion_empresa (
    id_invitacion     integer generated always as identity primary key,
    nombre_contacto   varchar(50)  not null,
    apellido_contacto varchar(50)  not null,
    correo            extensions.citext not null,
    nombre_empresa    varchar(150),
    token_hash        varchar(255) not null unique,
    fecha_vencimiento timestamptz  not null,
    estado            public.estado_invitacion not null default 'Pendiente',
    id_ec             integer      references public.empresa_coformadora (id_ec) on delete set null,
    id_usuario        integer      references public.usuario (id_usuario) on delete set null,
    creado_por        integer      references public.usuario (id_usuario) on delete set null,
    fecha_creacion    timestamptz  not null default now(),
    fecha_envio       timestamptz  not null default now(),
    fecha_completada  timestamptz,

    constraint invitacion_correo_chk check (correo ~ '^[^@[:space:]]+@[^@[:space:]]+\.[^@[:space:]]+$'),
    constraint invitacion_completada_chk check (estado <> 'Completada' or fecha_completada is not null)
);
comment on table public.invitacion_empresa is 'Invitaciones enviadas a empresas para que completen su registro en el Observatorio.';
comment on column public.invitacion_empresa.nombre_empresa is 'Nombre de la empresa, si se conoce (la empresa lo confirma en el formulario).';
comment on column public.invitacion_empresa.token_hash is 'Código del enlace del correo, cifrado. Nunca se guarda en texto plano.';
comment on column public.invitacion_empresa.fecha_envio is 'Último envío del correo (cambia al reenviar la invitación).';
comment on column public.invitacion_empresa.id_ec is 'Empresa creada al completar el registro.';
comment on column public.invitacion_empresa.id_usuario is 'Cuenta creada al completar el registro.';

-- Un correo solo puede tener una invitación pendiente a la vez.
create unique index invitacion_empresa_pendiente_uk
    on public.invitacion_empresa (correo) where estado = 'Pendiente';
create index invitacion_empresa_id_ec_idx on public.invitacion_empresa (id_ec);

-- Cuenta que representa a la empresa (la que completó el registro).
alter table public.empresa_coformadora
    add column id_usuario integer unique references public.usuario (id_usuario) on delete set null;
comment on column public.empresa_coformadora.id_usuario is 'Cuenta del contacto que registró la empresa por invitación.';

alter table public.invitacion_empresa enable row level security;

-- Gestión: SuperAdmin y Gestor Empresas Coformadoras.
grant select, insert, update on public.invitacion_empresa to obs_gestor_empresas, obs_superadmin;
create policy superadmin_total on public.invitacion_empresa for all
    to obs_superadmin using (true) with check (true);
create policy gestion_modulo on public.invitacion_empresa for all
    to obs_gestor_empresas using (true) with check (true);

-- Registro de la empresa con el enlace del correo (sin sesión): lo hace el
-- backend con el rol obs_autenticacion, que ya crea las cuentas nuevas.
grant select, update (estado, id_ec, id_usuario, fecha_completada) on public.invitacion_empresa to obs_autenticacion;
create policy autenticacion on public.invitacion_empresa for all
    to obs_autenticacion using (true) with check (true);

grant select, insert on public.empresa_coformadora, public.contacto_empresa to obs_autenticacion;
create policy autenticacion_lectura on public.empresa_coformadora for select
    to obs_autenticacion using (true);
-- La empresa nace activa (se publica de inmediato) y ligada a la cuenta nueva.
create policy autenticacion_registro on public.empresa_coformadora for insert
    to obs_autenticacion
    with check (estado_ec = 'Activo' and id_usuario is not null);
create policy autenticacion_lectura on public.contacto_empresa for select
    to obs_autenticacion using (true);
create policy autenticacion_registro on public.contacto_empresa for insert
    to obs_autenticacion with check (true);
