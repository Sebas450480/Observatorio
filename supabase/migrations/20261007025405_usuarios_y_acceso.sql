-- =============================================================================
-- Fase 1 - Paso 2: Tablas de usuarios y acceso.
-- Observatorio Empresarial - Uniempresarial
--
-- Tablas: rol, usuario, categoria, usuario_interes, recuperacion_contrasena.
-- Basado en "Observatorio Empresarial - Base de datos" (versión final), con
-- nombres en minúscula (convención de PostgreSQL).
-- =============================================================================

-- -----------------------------------------------------------------------------
-- rol: los 7 roles del sistema (SuperAdmin, Usuario y 5 gestores de módulo).
-- El Invitado no tiene rol porque no está registrado.
-- -----------------------------------------------------------------------------
create table public.rol (
    id_rol          integer generated always as identity primary key,
    nombre_rol      varchar(50)  not null unique,
    descripcion_rol text,
    permisos        varchar(100)
);
comment on table public.rol is 'Roles del sistema. Los permisos reales se aplican con roles de PostgreSQL (paso 6) y en el backend.';
comment on column public.rol.permisos is 'Resumen legible de los permisos del rol.';

-- -----------------------------------------------------------------------------
-- usuario: cuentas registradas.
-- -----------------------------------------------------------------------------
create table public.usuario (
    id_usuario                integer generated always as identity primary key,
    apodo_usuario             varchar(20),
    nombre_usuario            varchar(50)  not null,
    apellido_usuario          varchar(50)  not null,
    correo                    extensions.citext not null unique,
    contrasena_hash           varchar(255) not null,
    ciudad                    varchar(60),
    frecuencia_alertas        public.frecuencia_alertas not null default 'Semanal',
    acepta_tratamiento_datos  boolean      not null,
    fecha_aceptacion_datos    timestamptz  not null,
    fecha_registro            timestamptz  not null default now(),
    fecha_cambio_contrasena   timestamptz,
    estado_usuario            public.estado_usuario not null default 'Activo',
    id_rol                    integer      not null references public.rol (id_rol) on delete restrict,

    -- Ley 1581 de 2012: no se registra a nadie sin autorización de tratamiento de datos.
    constraint usuario_acepta_datos_chk check (acepta_tratamiento_datos),
    constraint usuario_correo_formato_chk check (correo ~ '^[^@[:space:]]+@[^@[:space:]]+\.[^@[:space:]]+$')
);
comment on table public.usuario is 'Cuentas registradas. El correo no distingue mayúsculas.';
comment on column public.usuario.apodo_usuario is 'Reemplaza los antiguos campos Ocupación, Institución, Organización, Cargo y Dependencia.';
comment on column public.usuario.contrasena_hash is 'Contraseña cifrada. Nunca se guarda en texto plano.';
comment on column public.usuario.acepta_tratamiento_datos is 'Autorización de tratamiento de datos (Ley 1581 de 2012). Debe ser verdadero.';

create index usuario_id_rol_idx on public.usuario (id_rol);

-- -----------------------------------------------------------------------------
-- categoria: temas y sectores para etiquetar contenidos e intereses.
-- -----------------------------------------------------------------------------
create table public.categoria (
    id_categoria     integer generated always as identity primary key,
    nombre_categoria varchar(50) not null unique
);
comment on table public.categoria is 'Temas y sectores para etiquetar contenidos y para los intereses de los usuarios.';

-- -----------------------------------------------------------------------------
-- usuario_interes: temas que cada usuario marca en el registro o en Mi perfil.
-- Personaliza las alertas por correo.
-- -----------------------------------------------------------------------------
create table public.usuario_interes (
    id_usuario   integer not null references public.usuario (id_usuario) on delete cascade,
    id_categoria integer not null references public.categoria (id_categoria) on delete cascade,
    primary key (id_usuario, id_categoria)
);
comment on table public.usuario_interes is 'Intereses de cada usuario (tabla puente usuario - categoria).';

create index usuario_interes_id_categoria_idx on public.usuario_interes (id_categoria);

-- -----------------------------------------------------------------------------
-- recuperacion_contrasena: códigos temporales para "¿Olvidaste tu contraseña?".
-- -----------------------------------------------------------------------------
create table public.recuperacion_contrasena (
    id_recuperacion   integer generated always as identity primary key,
    id_usuario        integer      not null references public.usuario (id_usuario) on delete cascade,
    token_hash        varchar(255) not null unique,
    fecha_vencimiento timestamptz  not null,
    usado             boolean      not null default false
);
comment on table public.recuperacion_contrasena is 'Códigos temporales cifrados para recuperar la contraseña.';
comment on column public.recuperacion_contrasena.token_hash is 'Código cifrado. Nunca se guarda en texto plano.';

create index recuperacion_contrasena_id_usuario_idx on public.recuperacion_contrasena (id_usuario);
