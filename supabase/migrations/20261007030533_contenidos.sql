-- =============================================================================
-- Fase 1 - Paso 3: Tablas de contenido de los módulos.
-- Observatorio Empresarial - Uniempresarial
--
-- Módulos: Flash Informativo, Faro Empresarial, Empresas Coformadoras,
-- Tendencias y Calendario de eventos, con sus tablas puente de categorías.
-- Todas las tablas nacen con RLS activado (las políticas se crean en el paso 6).
-- =============================================================================

-- -----------------------------------------------------------------------------
-- Funciones de apoyo
-- -----------------------------------------------------------------------------

-- Devuelve el id del usuario que hace la petición. El backend lo define al
-- inicio de cada transacción con: set local app.id_usuario = '<id>';
-- Para un invitado no se define y la función devuelve null.
create function public.fn_usuario_actual()
returns integer
language sql
stable
set search_path = ''
as $$
    select nullif(current_setting('app.id_usuario', true), '')::integer;
$$;
comment on function public.fn_usuario_actual() is 'Id del usuario de la petición actual (variable app.id_usuario), o null si es invitado.';

-- Llena los campos de auditoría de las tablas de contenido:
--   al crear:  creado_por (usuario actual), fecha_creacion y fecha_actualizacion.
--   al editar: fecha_actualizacion; creado_por y fecha_creacion no se pueden cambiar.
create function public.fn_auditoria()
returns trigger
language plpgsql
set search_path = ''
as $$
begin
    if tg_op = 'INSERT' then
        new.creado_por          := coalesce(new.creado_por, public.fn_usuario_actual());
        new.fecha_creacion      := now();
        new.fecha_actualizacion := now();
    else
        new.creado_por          := old.creado_por;
        new.fecha_creacion      := old.fecha_creacion;
        new.fecha_actualizacion := now();
    end if;
    return new;
end;
$$;
comment on function public.fn_auditoria() is 'Trigger de auditoría: quién creó el registro y cuándo se creó y actualizó.';

-- -----------------------------------------------------------------------------
-- flash_informativo: eventos externos (congresos, ferias, ruedas de negocio...).
-- -----------------------------------------------------------------------------
create table public.flash_informativo (
    id_fi               integer generated always as identity primary key,
    titulo              varchar(150) not null,
    descripcion         text,
    fecha_inicio        timestamptz  not null,
    fecha_fin           timestamptz,
    modalidad           public.modalidad   not null,
    costo               numeric(12,2),
    es_gratuito         boolean      not null default false,
    lugar               varchar(100),
    link                text,
    imagen              text,
    info_adicional      text,
    tipo_evento         public.tipo_evento not null,
    departamento        varchar(50),
    estado_fi           public.estado_registro not null default 'Activo',
    creado_por          integer      references public.usuario (id_usuario) on delete set null,
    fecha_creacion      timestamptz  not null default now(),
    fecha_actualizacion timestamptz  not null default now(),

    constraint flash_costo_chk    check (costo is null or costo >= 0),
    constraint flash_gratuito_chk check (not es_gratuito or coalesce(costo, 0) = 0),
    constraint flash_fechas_chk   check (fecha_fin is null or fecha_fin >= fecha_inicio)
);
comment on table public.flash_informativo is 'Flash Informativo: eventos y oportunidades del entorno empresarial.';
comment on column public.flash_informativo.imagen is 'Ruta del archivo de imagen guardado en el servidor.';
comment on column public.flash_informativo.info_adicional is 'Información clave en viñetas.';
comment on column public.flash_informativo.estado_fi is 'Solo lo ven y modifican el SuperAdmin y el Gestor Flash Informativo.';

create table public.flash_informativo_categoria (
    id_fi        integer not null references public.flash_informativo (id_fi) on delete cascade,
    id_categoria integer not null references public.categoria (id_categoria) on delete cascade,
    primary key (id_fi, id_categoria)
);
comment on table public.flash_informativo_categoria is 'Categorías (etiquetas) de cada Flash Informativo.';

-- -----------------------------------------------------------------------------
-- faro_empresarial: becas, convocatorias, cursos y talleres.
-- -----------------------------------------------------------------------------
create table public.faro_empresarial (
    id_fe               integer generated always as identity primary key,
    titulo              varchar(150) not null,
    descripcion         text,
    tipo                public.tipo_faro not null,
    fecha_publicacion   date         not null default current_date,
    fecha_inicio        date,
    fecha_cierre        date,
    entidad             varchar(150),
    imagen              text,
    link                text,
    modalidad           public.modalidad,
    lugar               varchar(150),
    costo               numeric(12,2),
    es_gratuito         boolean      not null default false,
    duracion            varchar(50),
    estado_fe           public.estado_registro not null default 'Activo',
    creado_por          integer      references public.usuario (id_usuario) on delete set null,
    fecha_creacion      timestamptz  not null default now(),
    fecha_actualizacion timestamptz  not null default now(),

    constraint faro_costo_chk    check (costo is null or costo >= 0),
    constraint faro_gratuito_chk check (not es_gratuito or coalesce(costo, 0) = 0)
);
comment on table public.faro_empresarial is 'Faro Empresarial: becas, convocatorias, cursos y talleres.';
comment on column public.faro_empresarial.tipo is 'Tipo de registro (campo Categoria del documento). Los temas van en faro_empresarial_categoria.';
comment on column public.faro_empresarial.fecha_inicio is 'Opcional; se usa en cursos y talleres.';
comment on column public.faro_empresarial.fecha_cierre is 'Opcional; se usa en becas y convocatorias. Null = "Por definir".';
comment on column public.faro_empresarial.entidad is 'Institución que ofrece la oportunidad.';
comment on column public.faro_empresarial.imagen is 'Ruta del archivo de imagen guardado en el servidor.';
comment on column public.faro_empresarial.estado_fe is 'Solo lo ven y modifican el SuperAdmin y el Gestor Faro Empresarial.';

create table public.faro_empresarial_categoria (
    id_fe        integer not null references public.faro_empresarial (id_fe) on delete cascade,
    id_categoria integer not null references public.categoria (id_categoria) on delete cascade,
    primary key (id_fe, id_categoria)
);
comment on table public.faro_empresarial_categoria is 'Temas (etiquetas) de cada registro del Faro Empresarial.';

-- -----------------------------------------------------------------------------
-- empresa_coformadora: catálogo de empresas aliadas.
-- -----------------------------------------------------------------------------
create table public.empresa_coformadora (
    id_ec                 integer generated always as identity primary key,
    nit                   varchar(20)  not null unique,
    razon_social          varchar(150) not null,
    nombre_comercial      varchar(100),
    descripcion           text,
    sector_economico      varchar(50)  not null,
    tamano_empresa        public.tamano_empresa,
    tiempo_coformadora    varchar(20),
    link                  text,
    estudiantes_recibidos integer      not null default 0,
    premios_recibidos     integer      not null default 0,
    codigo_ciiu           varchar(30),
    naturaleza_juridica   varchar(50),
    departamento          varchar(50)  not null,
    municipio             varchar(60)  not null,
    direccion             varchar(150),
    telefono              varchar(20),
    correo                extensions.citext,
    anio_constitucion     integer,
    logo_ec               text,
    imagen_portada        text,
    estado_ec             public.estado_registro not null default 'Activo',
    creado_por            integer      references public.usuario (id_usuario) on delete set null,
    fecha_creacion        timestamptz  not null default now(),
    fecha_actualizacion   timestamptz  not null default now(),

    constraint empresa_estudiantes_chk check (estudiantes_recibidos >= 0),
    constraint empresa_premios_chk     check (premios_recibidos >= 0),
    constraint empresa_anio_chk        check (anio_constitucion is null or anio_constitucion between 1800 and 2100),
    constraint empresa_correo_chk      check (correo is null or correo ~ '^[^@[:space:]]+@[^@[:space:]]+\.[^@[:space:]]+$')
);
comment on table public.empresa_coformadora is 'Empresas coformadoras (catálogo de aliados).';
comment on column public.empresa_coformadora.logo_ec is 'Ruta del archivo del logo guardado en el servidor.';
comment on column public.empresa_coformadora.imagen_portada is 'Ruta del archivo de la portada del perfil guardado en el servidor.';
comment on column public.empresa_coformadora.estado_ec is 'Inactivo significa bloqueado. Solo lo ven y modifican el SuperAdmin y el Gestor Empresas Coformadoras.';

create table public.contacto_empresa (
    id_contacto  integer generated always as identity primary key,
    id_ec        integer      not null references public.empresa_coformadora (id_ec) on delete cascade,
    nombre       varchar(100) not null,
    cargo        varchar(100),
    correo       extensions.citext,
    telefono     varchar(20),
    es_principal boolean      not null default false,

    constraint contacto_correo_chk check (correo is null or correo ~ '^[^@[:space:]]+@[^@[:space:]]+\.[^@[:space:]]+$')
);
comment on table public.contacto_empresa is 'Contactos de cada empresa; uno puede marcarse como principal.';
comment on column public.contacto_empresa.cargo is 'Cargo del contacto (aparece en la ficha de contacto principal del Figma).';

-- Una empresa solo puede tener un contacto principal.
create unique index contacto_empresa_un_principal_idx
    on public.contacto_empresa (id_ec) where es_principal;

-- -----------------------------------------------------------------------------
-- tendencia_empresarial: radar de tendencias agrupadas por megatendencia.
-- -----------------------------------------------------------------------------
create table public.tendencia_empresarial (
    id_te                   integer generated always as identity primary key,
    megatendencia           varchar(60)  not null,
    tendencia               varchar(80)  not null,
    descripcion             text,
    comportamiento_mundo    text,
    comportamiento_colombia text,
    fecha_publicacion       date         not null default current_date,
    estado_te               public.estado_registro not null default 'Activo',
    creado_por              integer      references public.usuario (id_usuario) on delete set null,
    fecha_creacion          timestamptz  not null default now(),
    fecha_actualizacion     timestamptz  not null default now(),

    -- Evita tendencias duplicadas dentro de la misma megatendencia (RF-15).
    constraint tendencia_unica_uk unique (megatendencia, tendencia)
);
comment on table public.tendencia_empresarial is 'Tendencias empresariales. La megatendencia agrupa las tendencias en el mapa.';
comment on column public.tendencia_empresarial.estado_te is 'Solo lo ven y modifican el SuperAdmin y el Gestor Tendencias.';

create table public.tendencia_categoria (
    id_te        integer not null references public.tendencia_empresarial (id_te) on delete cascade,
    id_categoria integer not null references public.categoria (id_categoria) on delete cascade,
    primary key (id_te, id_categoria)
);
comment on table public.tendencia_categoria is 'Categorías de cada tendencia.';

create table public.fuente_tendencia (
    id_fuente integer generated always as identity primary key,
    id_te     integer      not null references public.tendencia_empresarial (id_te) on delete cascade,
    nombre    varchar(150) not null,
    link      text
);
comment on table public.fuente_tendencia is 'Fuentes y enlaces de cada tendencia, mostrados en el detalle.';

create table public.mencion_tendencia (
    id_mencion integer generated always as identity primary key,
    id_te      integer      not null references public.tendencia_empresarial (id_te) on delete cascade,
    fuente     varchar(150),
    fecha      date         not null default current_date
);
comment on table public.mencion_tendencia is 'Cada mención de una tendencia con su fecha; alimenta el tamaño en el mapa y el Top 5 en crecimiento.';

-- -----------------------------------------------------------------------------
-- calendario_eventos: eventos institucionales de Uniempresarial. Sin estado.
-- -----------------------------------------------------------------------------
create table public.calendario_eventos (
    id_evento           integer generated always as identity primary key,
    titulo              varchar(150) not null,
    descripcion         text,
    fecha_inicio        timestamptz  not null,
    fecha_fin           timestamptz,
    modalidad           public.modalidad   not null,
    lugar               varchar(150),
    link_externo        text,
    tipo_evento         public.tipo_evento not null,
    costo               numeric(12,2),
    es_gratuito         boolean      not null default false,
    creado_por          integer      references public.usuario (id_usuario) on delete set null,
    fecha_creacion      timestamptz  not null default now(),
    fecha_actualizacion timestamptz  not null default now(),

    constraint calendario_costo_chk    check (costo is null or costo >= 0),
    constraint calendario_gratuito_chk check (not es_gratuito or coalesce(costo, 0) = 0),
    constraint calendario_fechas_chk   check (fecha_fin is null or fecha_fin >= fecha_inicio)
);
comment on table public.calendario_eventos is 'Eventos institucionales. No tiene campo de estado.';
comment on column public.calendario_eventos.link_externo is 'Enlace del botón de redirección en el modal.';

-- -----------------------------------------------------------------------------
-- Triggers de auditoría
-- -----------------------------------------------------------------------------
create trigger flash_informativo_auditoria     before insert or update on public.flash_informativo     for each row execute function public.fn_auditoria();
create trigger faro_empresarial_auditoria      before insert or update on public.faro_empresarial      for each row execute function public.fn_auditoria();
create trigger empresa_coformadora_auditoria   before insert or update on public.empresa_coformadora   for each row execute function public.fn_auditoria();
create trigger tendencia_empresarial_auditoria before insert or update on public.tendencia_empresarial for each row execute function public.fn_auditoria();
create trigger calendario_eventos_auditoria    before insert or update on public.calendario_eventos    for each row execute function public.fn_auditoria();

-- -----------------------------------------------------------------------------
-- RLS activado desde el inicio (políticas en el paso 6)
-- -----------------------------------------------------------------------------
alter table public.flash_informativo           enable row level security;
alter table public.flash_informativo_categoria enable row level security;
alter table public.faro_empresarial            enable row level security;
alter table public.faro_empresarial_categoria  enable row level security;
alter table public.empresa_coformadora         enable row level security;
alter table public.contacto_empresa            enable row level security;
alter table public.tendencia_empresarial       enable row level security;
alter table public.tendencia_categoria         enable row level security;
alter table public.fuente_tendencia            enable row level security;
alter table public.mencion_tendencia           enable row level security;
alter table public.calendario_eventos          enable row level security;
