-- =============================================================================
-- Observatorio Empresarial - Estructura completa de la base de datos
--
-- ARCHIVO GENERADO: no editar a mano. Se crea con supabase/generar_schema.sh
-- uniendo los archivos de supabase/migrations en orden.
--
-- Uso en cualquier PostgreSQL 15 o superior (pgAdmin, psql, servidor propio):
--   psql "$DATABASE_URL" -v ON_ERROR_STOP=1 -f supabase/schema.sql
--   psql "$DATABASE_URL" -v ON_ERROR_STOP=1 -f supabase/seed.sql   # datos iniciales (opcional)
-- El usuario que lo ejecute necesita permiso para crear roles (CREATEROLE).
-- =============================================================================


-- >>> migrations/20261007025033_tipos_enum.sql
-- =============================================================================
-- Fase 1 - Paso 1: Tipos ENUM (listas cerradas de valores) y extensiones.
-- Observatorio Empresarial - Uniempresarial
--
-- Cada tipo restringe un campo a una lista fija de valores definida en el
-- documento "Observatorio Empresarial - Base de datos" (versión final).
-- =============================================================================

-- Extensión citext: texto que no distingue mayúsculas/minúsculas.
-- Se usará en los correos para que "Ana@correo.com" y "ana@correo.com" sean el mismo.
-- En Supabase las extensiones se instalan en el esquema "extensions".
create schema if not exists extensions;
create extension if not exists citext with schema extensions;

-- Estado de una cuenta de usuario.
create type public.estado_usuario as enum ('Activo', 'Inactivo');
comment on type public.estado_usuario is 'Estado de la cuenta del usuario.';

-- Estado de los contenidos (Flash, Faro, Empresas y Tendencias).
-- Solo lo ven y modifican el SuperAdmin y el gestor del módulo.
-- En Empresas, Inactivo significa bloqueado.
create type public.estado_registro as enum ('Activo', 'Inactivo');
comment on type public.estado_registro is 'Estado de un contenido. Usuario e Invitado solo ven los registros Activos.';

-- Modalidad de eventos, convocatorias y actividades.
create type public.modalidad as enum ('Virtual', 'Presencial', 'Hibrido');
comment on type public.modalidad is 'Modalidad de asistencia.';

-- Tipo de evento para Flash Informativo y Calendario de eventos.
create type public.tipo_evento as enum ('Congreso', 'Hackathon', 'Foro', 'Cumbre', 'Seminario', 'Taller', 'Otro');
comment on type public.tipo_evento is 'Tipo de evento (Flash Informativo y Calendario).';

-- Tipo de registro del Faro Empresarial.
-- Los temas o intereses del registro van aparte, en la tabla puente faro_empresarial_categoria.
create type public.tipo_faro as enum ('Becas', 'Convocatorias', 'Cursos', 'Talleres');
comment on type public.tipo_faro is 'Tipo de registro del Faro Empresarial.';

-- Tamaño de una empresa coformadora.
create type public.tamano_empresa as enum ('Micro', 'Pequeña', 'Mediana', 'Grande');
comment on type public.tamano_empresa is 'Tamaño de la empresa coformadora.';

-- Frecuencia con que el usuario recibe alertas por correo.
create type public.frecuencia_alertas as enum ('Inmediata', 'Semanal', 'Ninguna');
comment on type public.frecuencia_alertas is 'Frecuencia de envío de alertas por correo.';

-- Tipo de contenido sobre el que se registra una actividad (estadísticas).
create type public.tipo_contenido as enum ('Flash', 'Faro', 'Empresa', 'Tendencia', 'Evento');
comment on type public.tipo_contenido is 'Módulo del contenido al que se refiere una actividad.';

-- Acción realizada por el usuario sobre un contenido (estadísticas).
create type public.accion_actividad as enum ('Vista', 'Clic_acceder', 'Compartir');
comment on type public.accion_actividad is 'Acción registrada en la tabla actividad.';


-- >>> migrations/20261007025405_usuarios_y_acceso.sql
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


-- >>> migrations/20261007025858_rls_tablas_usuarios.sql
-- =============================================================================
-- Fase 1 - Seguridad inmediata: activa RLS en las tablas del paso 2.
-- Observatorio Empresarial - Uniempresarial
--
-- Supabase publica una API REST para cada tabla del esquema public. Con RLS
-- activado y sin políticas para los roles de Supabase (anon, authenticated),
-- esa API no puede leer ni escribir nada. Las políticas para los roles del
-- Observatorio se crean en el paso 6.
-- =============================================================================

alter table public.rol                     enable row level security;
alter table public.usuario                 enable row level security;
alter table public.categoria               enable row level security;
alter table public.usuario_interes         enable row level security;
alter table public.recuperacion_contrasena enable row level security;


-- >>> migrations/20261007030533_contenidos.sql
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


-- >>> migrations/20261007030634_estadisticas.sql
-- =============================================================================
-- Fase 1 - Paso 4: Tablas de estadísticas.
-- Observatorio Empresarial - Uniempresarial
--
-- actividad:    cada vista, clic en "Acceder" o compartir (visitas, clics, Top 5).
-- envio_alerta: cada correo de alerta enviado y si se abrió (suscriptores, apertura).
-- =============================================================================

create table public.actividad (
    id_actividad   integer generated always as identity primary key,
    id_usuario     integer      references public.usuario (id_usuario) on delete set null,
    tipo_contenido public.tipo_contenido   not null,
    id_contenido   integer      not null,
    accion         public.accion_actividad not null,
    fecha          timestamptz  not null default now()
);
comment on table public.actividad is 'Interacciones con los contenidos. Alimenta el panel de estadísticas.';
comment on column public.actividad.id_usuario is 'Vacío cuando la acción la hace un invitado.';
comment on column public.actividad.id_contenido is 'Id del registro en la tabla del módulo indicado por tipo_contenido.';

create table public.envio_alerta (
    id_envio       integer generated always as identity primary key,
    id_usuario     integer      not null references public.usuario (id_usuario) on delete cascade,
    fecha_envio    timestamptz  not null default now(),
    fecha_apertura timestamptz,

    constraint envio_alerta_apertura_chk check (fecha_apertura is null or fecha_apertura >= fecha_envio)
);
comment on table public.envio_alerta is 'Correos de alerta enviados a los usuarios.';
comment on column public.envio_alerta.fecha_apertura is 'Vacío si el correo no se ha abierto.';

alter table public.actividad    enable row level security;
alter table public.envio_alerta enable row level security;


-- >>> migrations/20261007030659_indices.sql
-- =============================================================================
-- Fase 1 - Paso 5: Índices.
-- Observatorio Empresarial - Uniempresarial
--
-- Las restricciones (únicos, CHECK, llaves foráneas) se definieron junto con
-- cada tabla. Aquí se crean los índices que aceleran:
--   1. las llaves foráneas (uniones y borrados en cascada), y
--   2. los filtros y ordenamientos que usa cada pantalla del Figma.
-- Meta del documento de requisitos: consultas en menos de 3 segundos.
-- =============================================================================

-- Usuarios (panel de estadísticas: nuevos del mes, usuarios por ciudad).
create index usuario_fecha_registro_idx on public.usuario (fecha_registro);
create index usuario_ciudad_idx         on public.usuario (ciudad);

-- Flash Informativo: listado por estado y fecha; filtros por tipo, departamento y modalidad.
create index flash_estado_fecha_idx  on public.flash_informativo (estado_fi, fecha_inicio);
create index flash_tipo_evento_idx   on public.flash_informativo (tipo_evento);
create index flash_departamento_idx  on public.flash_informativo (departamento);
create index flash_creado_por_idx    on public.flash_informativo (creado_por);
create index flash_categoria_cat_idx on public.flash_informativo_categoria (id_categoria);

-- Faro Empresarial: listado por estado y tipo; orden por fecha de cierre.
create index faro_estado_tipo_idx   on public.faro_empresarial (estado_fe, tipo);
create index faro_fecha_cierre_idx  on public.faro_empresarial (fecha_cierre);
create index faro_creado_por_idx    on public.faro_empresarial (creado_por);
create index faro_categoria_cat_idx on public.faro_empresarial_categoria (id_categoria);

-- Empresas Coformadoras: filtros por estado, sector, tamaño y ubicación.
create index empresa_estado_idx     on public.empresa_coformadora (estado_ec);
create index empresa_sector_idx     on public.empresa_coformadora (sector_economico);
create index empresa_tamano_idx     on public.empresa_coformadora (tamano_empresa);
create index empresa_ubicacion_idx  on public.empresa_coformadora (departamento, municipio);
create index empresa_creado_por_idx on public.empresa_coformadora (creado_por);
create index contacto_empresa_ec_idx on public.contacto_empresa (id_ec);

-- Tendencias: listado por estado y megatendencia; menciones por periodo.
create index tendencia_estado_mega_idx  on public.tendencia_empresarial (estado_te, megatendencia);
create index tendencia_creado_por_idx   on public.tendencia_empresarial (creado_por);
create index tendencia_categoria_cat_idx on public.tendencia_categoria (id_categoria);
create index fuente_tendencia_te_idx    on public.fuente_tendencia (id_te);
create index mencion_tendencia_te_fecha_idx on public.mencion_tendencia (id_te, fecha);
create index mencion_tendencia_fecha_idx    on public.mencion_tendencia (fecha);

-- Calendario: vistas semanal y mensual por rango de fechas.
create index calendario_fecha_inicio_idx on public.calendario_eventos (fecha_inicio);
create index calendario_creado_por_idx   on public.calendario_eventos (creado_por);

-- Estadísticas.
create index actividad_fecha_idx     on public.actividad (fecha);
create index actividad_contenido_idx on public.actividad (tipo_contenido, id_contenido);
create index actividad_usuario_idx   on public.actividad (id_usuario);
create index envio_alerta_usuario_idx on public.envio_alerta (id_usuario);
create index envio_alerta_fecha_idx   on public.envio_alerta (fecha_envio);


-- >>> migrations/20261007030916_seguridad_roles.sql
-- =============================================================================
-- Fase 1 - Paso 6: Seguridad a nivel del motor (capa 2).
-- Observatorio Empresarial - Uniempresarial
--
-- Cómo funciona:
--   * Hay un rol de PostgreSQL por perfil del Observatorio (obs_*). No inician
--     sesión; solo agrupan permisos.
--   * El backend se conecta con el usuario obs_backend y, en cada petición, toma
--     el rol del usuario autenticado:
--         begin;
--         set local role obs_gestor_flash;          -- según el rol del usuario
--         set local app.id_usuario = '15';          -- id del usuario (vacío si es invitado)
--         ... consultas ...
--         commit;
--     Así, aunque el backend tuviera un error, PostgreSQL no deja que un perfil
--     haga algo que no le corresponde.
--   * Permisos por tabla (GRANT) + políticas por fila (RLS) aplican la regla de
--     estado: Usuario, Invitado y los gestores de otros módulos solo ven
--     registros Activos.
--   * La API pública de Supabase (roles anon y authenticated) queda sin acceso.
--
-- La contraseña de obs_backend NO va en el repositorio. Se define una sola vez
-- desde el editor SQL de Supabase (ver supabase/README.md).
-- =============================================================================

-- -----------------------------------------------------------------------------
-- 1. Cerrar la API pública de Supabase
-- -----------------------------------------------------------------------------
do $$
declare
    r text;
begin
    foreach r in array array['anon', 'authenticated'] loop
        if exists (select 1 from pg_roles where rolname = r) then
            execute format('revoke all on all tables    in schema public from %I', r);
            execute format('revoke all on all sequences in schema public from %I', r);
            execute format('revoke all on all functions in schema public from %I', r);
            execute format('alter default privileges in schema public revoke all on tables    from %I', r);
            execute format('alter default privileges in schema public revoke all on sequences from %I', r);
            execute format('alter default privileges in schema public revoke all on functions from %I', r);
        end if;
    end loop;
end;
$$;

-- -----------------------------------------------------------------------------
-- 2. Roles del Observatorio
-- -----------------------------------------------------------------------------
--   obs_invitado           visitante sin cuenta
--   obs_usuario            usuario registrado
--   obs_gestor_faro        Gestor Faro Empresarial
--   obs_gestor_flash       Gestor Flash Informativo
--   obs_gestor_empresas    Gestor Empresas Coformadoras
--   obs_gestor_tendencias  Gestor Tendencias
--   obs_gestor_calendario  Gestor Calendario
--   obs_superadmin         SuperAdmin
--   obs_autenticacion      uso interno del backend: login, registro y recuperar contraseña
--   obs_backend            usuario con el que se conecta el backend (único con LOGIN)
do $$
declare
    r text;
begin
    foreach r in array array[
        'obs_invitado', 'obs_usuario',
        'obs_gestor_faro', 'obs_gestor_flash', 'obs_gestor_empresas',
        'obs_gestor_tendencias', 'obs_gestor_calendario',
        'obs_superadmin', 'obs_autenticacion'
    ] loop
        if not exists (select 1 from pg_roles where rolname = r) then
            execute format('create role %I nologin', r);
        end if;
    end loop;

    if not exists (select 1 from pg_roles where rolname = 'obs_backend') then
        create role obs_backend login noinherit;
    end if;
end;
$$;

comment on role obs_backend is 'Usuario de conexión del backend. Toma el rol del usuario autenticado con SET LOCAL ROLE.';

-- El esquema extensions debe estar en la ruta de búsqueda para que las
-- comparaciones de correos (citext) no distingan mayúsculas.
alter role obs_backend set search_path to public, extensions;

grant obs_invitado, obs_usuario,
      obs_gestor_faro, obs_gestor_flash, obs_gestor_empresas,
      obs_gestor_tendencias, obs_gestor_calendario,
      obs_superadmin, obs_autenticacion
   to obs_backend;

-- Acceso a los esquemas (public: tablas; extensions: tipo citext).
grant usage on schema public, extensions
   to obs_invitado, obs_usuario,
      obs_gestor_faro, obs_gestor_flash, obs_gestor_empresas,
      obs_gestor_tendencias, obs_gestor_calendario,
      obs_superadmin, obs_autenticacion;

-- -----------------------------------------------------------------------------
-- 3. Permisos por tabla (GRANT)
-- -----------------------------------------------------------------------------

-- SuperAdmin: todo sobre todas las tablas.
grant select, insert, update, delete on all tables in schema public to obs_superadmin;

-- Rol y Categoria: todos consultan; solo el SuperAdmin modifica.
grant select on public.rol, public.categoria
   to obs_invitado, obs_usuario,
      obs_gestor_faro, obs_gestor_flash, obs_gestor_empresas,
      obs_gestor_tendencias, obs_gestor_calendario, obs_autenticacion;

-- Usuario: cada registrado consulta y edita su propio perfil (sin cambiar rol ni estado).
grant select on public.usuario
   to obs_usuario, obs_gestor_faro, obs_gestor_flash, obs_gestor_empresas,
      obs_gestor_tendencias, obs_gestor_calendario, obs_autenticacion;
grant update (apodo_usuario, nombre_usuario, apellido_usuario, correo, contrasena_hash,
              ciudad, frecuencia_alertas, fecha_cambio_contrasena)
   on public.usuario
   to obs_usuario, obs_gestor_faro, obs_gestor_flash, obs_gestor_empresas,
      obs_gestor_tendencias, obs_gestor_calendario;

-- Autenticación: registrar cuentas nuevas y cambiar contraseña al recuperarla.
grant insert on public.usuario to obs_autenticacion;
grant update (contrasena_hash, fecha_cambio_contrasena) on public.usuario to obs_autenticacion;
grant select, insert on public.usuario_interes to obs_autenticacion;
grant select, insert, update (usado) on public.recuperacion_contrasena to obs_autenticacion;

-- Intereses propios (registro y Mi perfil).
grant select, insert, delete on public.usuario_interes
   to obs_usuario, obs_gestor_faro, obs_gestor_flash, obs_gestor_empresas,
      obs_gestor_tendencias, obs_gestor_calendario;

-- Contenidos: todos los perfiles consultan (las políticas filtran por estado).
grant select on
    public.flash_informativo, public.flash_informativo_categoria,
    public.faro_empresarial,  public.faro_empresarial_categoria,
    public.empresa_coformadora, public.contacto_empresa,
    public.tendencia_empresarial, public.tendencia_categoria,
    public.fuente_tendencia, public.mencion_tendencia,
    public.calendario_eventos
   to obs_invitado, obs_usuario,
      obs_gestor_faro, obs_gestor_flash, obs_gestor_empresas,
      obs_gestor_tendencias, obs_gestor_calendario;

-- Cada gestor crea, edita y elimina solo en su módulo.
grant insert, update, delete on public.flash_informativo, public.flash_informativo_categoria
   to obs_gestor_flash;
grant insert, update, delete on public.faro_empresarial, public.faro_empresarial_categoria
   to obs_gestor_faro;
grant insert, update, delete on public.empresa_coformadora, public.contacto_empresa
   to obs_gestor_empresas;
grant insert, update, delete on public.tendencia_empresarial, public.tendencia_categoria,
                                public.fuente_tendencia, public.mencion_tendencia
   to obs_gestor_tendencias;
grant insert, update, delete on public.calendario_eventos
   to obs_gestor_calendario;

-- Actividad: cualquier perfil registra vistas, clics y compartidos; solo el SuperAdmin las consulta.
grant insert on public.actividad
   to obs_invitado, obs_usuario,
      obs_gestor_faro, obs_gestor_flash, obs_gestor_empresas,
      obs_gestor_tendencias, obs_gestor_calendario;

-- envio_alerta: solo SuperAdmin (ya incluido arriba). El envío de alertas lo
-- ejecuta el backend con el rol obs_superadmin.

-- -----------------------------------------------------------------------------
-- 4. Políticas por fila (RLS)
-- -----------------------------------------------------------------------------

-- SuperAdmin: acceso total en todas las tablas.
do $$
declare
    t text;
begin
    foreach t in array array[
        'rol', 'usuario', 'categoria', 'usuario_interes', 'recuperacion_contrasena',
        'flash_informativo', 'flash_informativo_categoria',
        'faro_empresarial', 'faro_empresarial_categoria',
        'empresa_coformadora', 'contacto_empresa',
        'tendencia_empresarial', 'tendencia_categoria', 'fuente_tendencia', 'mencion_tendencia',
        'calendario_eventos', 'actividad', 'envio_alerta'
    ] loop
        execute format(
            'create policy superadmin_total on public.%I for all to obs_superadmin using (true) with check (true)', t);
    end loop;
end;
$$;

-- Rol y Categoria: lectura para todos.
create policy lectura on public.rol for select
    to obs_invitado, obs_usuario, obs_gestor_faro, obs_gestor_flash, obs_gestor_empresas,
       obs_gestor_tendencias, obs_gestor_calendario, obs_autenticacion
    using (true);
create policy lectura on public.categoria for select
    to obs_invitado, obs_usuario, obs_gestor_faro, obs_gestor_flash, obs_gestor_empresas,
       obs_gestor_tendencias, obs_gestor_calendario, obs_autenticacion
    using (true);

-- Usuario: cada registrado ve y edita solo su propio registro.
create policy propio_lectura on public.usuario for select
    to obs_usuario, obs_gestor_faro, obs_gestor_flash, obs_gestor_empresas,
       obs_gestor_tendencias, obs_gestor_calendario
    using (id_usuario = public.fn_usuario_actual());
create policy propio_edicion on public.usuario for update
    to obs_usuario, obs_gestor_faro, obs_gestor_flash, obs_gestor_empresas,
       obs_gestor_tendencias, obs_gestor_calendario
    using (id_usuario = public.fn_usuario_actual())
    with check (id_usuario = public.fn_usuario_actual());

-- Usuario: autenticación (login, registro y recuperación de contraseña).
create policy autenticacion_lectura on public.usuario for select
    to obs_autenticacion using (true);
create policy autenticacion_registro on public.usuario for insert
    to obs_autenticacion
    with check (
        estado_usuario = 'Activo'
        and id_rol = (select r.id_rol from public.rol r where r.nombre_rol = 'Usuario')
    );
create policy autenticacion_cambio_contrasena on public.usuario for update
    to obs_autenticacion using (true) with check (true);

-- Intereses: cada registrado maneja los suyos; autenticación los guarda al registrar.
create policy propios on public.usuario_interes for all
    to obs_usuario, obs_gestor_faro, obs_gestor_flash, obs_gestor_empresas,
       obs_gestor_tendencias, obs_gestor_calendario
    using (id_usuario = public.fn_usuario_actual())
    with check (id_usuario = public.fn_usuario_actual());
create policy autenticacion on public.usuario_interes for all
    to obs_autenticacion using (true) with check (true);

-- Recuperación de contraseña: solo autenticación (y SuperAdmin).
create policy autenticacion on public.recuperacion_contrasena for all
    to obs_autenticacion using (true) with check (true);

-- Flash Informativo
create policy lectura_activos on public.flash_informativo for select
    to obs_invitado, obs_usuario, obs_gestor_faro, obs_gestor_empresas,
       obs_gestor_tendencias, obs_gestor_calendario
    using (estado_fi = 'Activo');
create policy gestion_modulo on public.flash_informativo for all
    to obs_gestor_flash using (true) with check (true);

create policy lectura on public.flash_informativo_categoria for select
    to obs_invitado, obs_usuario, obs_gestor_faro, obs_gestor_empresas,
       obs_gestor_tendencias, obs_gestor_calendario
    using (exists (select 1 from public.flash_informativo p
                   where p.id_fi = flash_informativo_categoria.id_fi));
create policy gestion_modulo on public.flash_informativo_categoria for all
    to obs_gestor_flash using (true) with check (true);

-- Faro Empresarial
create policy lectura_activos on public.faro_empresarial for select
    to obs_invitado, obs_usuario, obs_gestor_flash, obs_gestor_empresas,
       obs_gestor_tendencias, obs_gestor_calendario
    using (estado_fe = 'Activo');
create policy gestion_modulo on public.faro_empresarial for all
    to obs_gestor_faro using (true) with check (true);

create policy lectura on public.faro_empresarial_categoria for select
    to obs_invitado, obs_usuario, obs_gestor_flash, obs_gestor_empresas,
       obs_gestor_tendencias, obs_gestor_calendario
    using (exists (select 1 from public.faro_empresarial p
                   where p.id_fe = faro_empresarial_categoria.id_fe));
create policy gestion_modulo on public.faro_empresarial_categoria for all
    to obs_gestor_faro using (true) with check (true);

-- Empresas Coformadoras
create policy lectura_activos on public.empresa_coformadora for select
    to obs_invitado, obs_usuario, obs_gestor_faro, obs_gestor_flash,
       obs_gestor_tendencias, obs_gestor_calendario
    using (estado_ec = 'Activo');
create policy gestion_modulo on public.empresa_coformadora for all
    to obs_gestor_empresas using (true) with check (true);

create policy lectura on public.contacto_empresa for select
    to obs_invitado, obs_usuario, obs_gestor_faro, obs_gestor_flash,
       obs_gestor_tendencias, obs_gestor_calendario
    using (exists (select 1 from public.empresa_coformadora p
                   where p.id_ec = contacto_empresa.id_ec));
create policy gestion_modulo on public.contacto_empresa for all
    to obs_gestor_empresas using (true) with check (true);

-- Tendencias
create policy lectura_activos on public.tendencia_empresarial for select
    to obs_invitado, obs_usuario, obs_gestor_faro, obs_gestor_flash,
       obs_gestor_empresas, obs_gestor_calendario
    using (estado_te = 'Activo');
create policy gestion_modulo on public.tendencia_empresarial for all
    to obs_gestor_tendencias using (true) with check (true);

create policy lectura on public.tendencia_categoria for select
    to obs_invitado, obs_usuario, obs_gestor_faro, obs_gestor_flash,
       obs_gestor_empresas, obs_gestor_calendario
    using (exists (select 1 from public.tendencia_empresarial p
                   where p.id_te = tendencia_categoria.id_te));
create policy gestion_modulo on public.tendencia_categoria for all
    to obs_gestor_tendencias using (true) with check (true);

create policy lectura on public.fuente_tendencia for select
    to obs_invitado, obs_usuario, obs_gestor_faro, obs_gestor_flash,
       obs_gestor_empresas, obs_gestor_calendario
    using (exists (select 1 from public.tendencia_empresarial p
                   where p.id_te = fuente_tendencia.id_te));
create policy gestion_modulo on public.fuente_tendencia for all
    to obs_gestor_tendencias using (true) with check (true);

create policy lectura on public.mencion_tendencia for select
    to obs_invitado, obs_usuario, obs_gestor_faro, obs_gestor_flash,
       obs_gestor_empresas, obs_gestor_calendario
    using (exists (select 1 from public.tendencia_empresarial p
                   where p.id_te = mencion_tendencia.id_te));
create policy gestion_modulo on public.mencion_tendencia for all
    to obs_gestor_tendencias using (true) with check (true);

-- Calendario (sin estado: todos ven todos los eventos).
create policy lectura on public.calendario_eventos for select
    to obs_invitado, obs_usuario, obs_gestor_faro, obs_gestor_flash,
       obs_gestor_empresas, obs_gestor_tendencias
    using (true);
create policy gestion_modulo on public.calendario_eventos for all
    to obs_gestor_calendario using (true) with check (true);

-- Actividad: se registra a nombre propio (o sin usuario si es invitado).
create policy registro_propio on public.actividad for insert
    to obs_invitado, obs_usuario,
       obs_gestor_faro, obs_gestor_flash, obs_gestor_empresas,
       obs_gestor_tendencias, obs_gestor_calendario
    with check (id_usuario is not distinct from public.fn_usuario_actual());


-- >>> migrations/20261007031007_vistas_estadisticas.sql
-- =============================================================================
-- Fase 1 - Paso 7: Vistas de estadísticas.
-- Observatorio Empresarial - Uniempresarial
--
-- Consultas guardadas que entregan los números listos para el mapa de
-- Tendencias y el Panel de estadísticas.
-- Todas usan security_invoker: se ejecutan con los permisos de quien consulta,
-- así que respetan las políticas por fila (un invitado solo cuenta tendencias activas).
-- =============================================================================

-- -----------------------------------------------------------------------------
-- Tendencias (públicas)
-- -----------------------------------------------------------------------------

-- Menciones de cada tendencia por periodo: tamaño de cada bloque del mapa.
create view public.v_tendencia_menciones
with (security_invoker = on) as
select
    t.id_te,
    t.megatendencia,
    t.tendencia,
    count(m.id_mencion) filter (where m.fecha > current_date - 7)   as menciones_semana,
    count(m.id_mencion) filter (where m.fecha > current_date - 30)  as menciones_mes,
    count(m.id_mencion) filter (where m.fecha > current_date - 365) as menciones_anio,
    count(m.id_mencion)                                             as menciones_total
from public.tendencia_empresarial t
left join public.mencion_tendencia m on m.id_te = t.id_te
group by t.id_te;
comment on view public.v_tendencia_menciones is 'Menciones por tendencia en la última semana, mes, año y en total (mapa de tendencias).';

-- Menciones por megatendencia: agrupación del mapa de árbol.
create view public.v_megatendencia_menciones
with (security_invoker = on) as
select
    megatendencia,
    count(*)              as tendencias,
    sum(menciones_semana) as menciones_semana,
    sum(menciones_mes)    as menciones_mes,
    sum(menciones_anio)   as menciones_anio,
    sum(menciones_total)  as menciones_total
from public.v_tendencia_menciones
group by megatendencia;
comment on view public.v_megatendencia_menciones is 'Menciones agregadas por megatendencia (mapa de árbol).';

-- Top 5 tendencias en crecimiento: últimos 30 días frente a los 30 anteriores.
create view public.v_tendencia_top5_crecimiento
with (security_invoker = on) as
with conteo as (
    select
        t.id_te,
        t.megatendencia,
        t.tendencia,
        count(m.id_mencion) filter (where m.fecha >  current_date - 30)                              as menciones_actual,
        count(m.id_mencion) filter (where m.fecha <= current_date - 30 and m.fecha > current_date - 60) as menciones_anterior
    from public.tendencia_empresarial t
    join public.mencion_tendencia m on m.id_te = t.id_te
    group by t.id_te
)
select
    id_te,
    megatendencia,
    tendencia,
    menciones_actual,
    menciones_anterior,
    menciones_actual - menciones_anterior as crecimiento,
    case when menciones_anterior > 0
         then round(100.0 * (menciones_actual - menciones_anterior) / menciones_anterior, 1)
    end as crecimiento_pct
from conteo
where menciones_actual > 0
order by crecimiento desc, menciones_actual desc
limit 5;
comment on view public.v_tendencia_top5_crecimiento is 'Las 5 tendencias con mayor crecimiento de menciones (30 días vs. 30 días anteriores).';

-- -----------------------------------------------------------------------------
-- Panel de estadísticas (solo SuperAdmin)
-- -----------------------------------------------------------------------------

-- Resumen del mes en curso.
create view public.v_estadisticas_resumen_mes
with (security_invoker = on) as
select
    (select count(*) from public.usuario where estado_usuario = 'Activo')                         as usuarios_activos,
    (select count(*) from public.usuario where fecha_registro >= date_trunc('month', now()))       as usuarios_nuevos_mes,
    (select count(*) from public.actividad where accion = 'Vista'        and fecha >= date_trunc('month', now())) as visitas_mes,
    (select count(*) from public.actividad where accion = 'Clic_acceder' and fecha >= date_trunc('month', now())) as clics_acceder_mes,
    (select count(*) from public.actividad where accion = 'Compartir'    and fecha >= date_trunc('month', now())) as compartidos_mes,
    (select count(*) from public.usuario
      where estado_usuario = 'Activo' and frecuencia_alertas <> 'Ninguna')                        as suscriptores_alertas,
    (select count(*) from public.envio_alerta where fecha_envio >= date_trunc('month', now()))   as alertas_enviadas_mes,
    (select count(*) from public.envio_alerta
      where fecha_envio >= date_trunc('month', now()) and fecha_apertura is not null)             as alertas_abiertas_mes,
    (select round(100.0 * count(*) filter (where fecha_apertura is not null) / nullif(count(*), 0), 1)
       from public.envio_alerta where fecha_envio >= date_trunc('month', now()))                  as tasa_apertura_mes_pct;
comment on view public.v_estadisticas_resumen_mes is 'Resumen del mes: usuarios, visitas, clics, compartidos y alertas.';

-- Top 5 contenidos más vistos en los últimos 30 días.
create view public.v_estadisticas_top5_contenidos
with (security_invoker = on) as
with titulos as (
    select 'Flash'::public.tipo_contenido     as tipo, id_fi     as id, titulo from public.flash_informativo
    union all
    select 'Faro'::public.tipo_contenido,      id_fe,     titulo from public.faro_empresarial
    union all
    select 'Empresa'::public.tipo_contenido,   id_ec,     coalesce(nombre_comercial, razon_social) from public.empresa_coformadora
    union all
    select 'Tendencia'::public.tipo_contenido, id_te,     tendencia from public.tendencia_empresarial
    union all
    select 'Evento'::public.tipo_contenido,    id_evento, titulo from public.calendario_eventos
)
select
    a.tipo_contenido,
    a.id_contenido,
    ti.titulo,
    count(*) as vistas
from public.actividad a
left join titulos ti on ti.tipo = a.tipo_contenido and ti.id = a.id_contenido
where a.accion = 'Vista'
  and a.fecha >= now() - interval '30 days'
group by a.tipo_contenido, a.id_contenido, ti.titulo
order by vistas desc
limit 5;
comment on view public.v_estadisticas_top5_contenidos is 'Los 5 contenidos con más vistas en los últimos 30 días.';

-- Actividad por módulo en los últimos 30 días (módulo más consultado).
create view public.v_estadisticas_actividad_modulo
with (security_invoker = on) as
select
    tipo_contenido,
    count(*) filter (where accion = 'Vista')        as vistas,
    count(*) filter (where accion = 'Clic_acceder') as clics_acceder,
    count(*) filter (where accion = 'Compartir')    as compartidos
from public.actividad
where fecha >= now() - interval '30 days'
group by tipo_contenido;
comment on view public.v_estadisticas_actividad_modulo is 'Vistas, clics y compartidos por módulo en los últimos 30 días.';

-- Usuarios activos por ciudad.
create view public.v_estadisticas_usuarios_ciudad
with (security_invoker = on) as
select
    coalesce(ciudad, 'Sin ciudad') as ciudad,
    count(*)                       as usuarios
from public.usuario
where estado_usuario = 'Activo'
group by coalesce(ciudad, 'Sin ciudad');
comment on view public.v_estadisticas_usuarios_ciudad is 'Usuarios activos por ciudad.';

-- Distribución de intereses: porcentaje de usuarios activos que marcó cada categoría.
create view public.v_estadisticas_intereses
with (security_invoker = on) as
select
    c.id_categoria,
    c.nombre_categoria,
    count(u.id_usuario) as usuarios,
    round(100.0 * count(u.id_usuario)
          / nullif((select count(*) from public.usuario where estado_usuario = 'Activo'), 0), 1) as porcentaje
from public.categoria c
join public.usuario_interes ui on ui.id_categoria = c.id_categoria
join public.usuario u          on u.id_usuario = ui.id_usuario and u.estado_usuario = 'Activo'
group by c.id_categoria;
comment on view public.v_estadisticas_intereses is 'Usuarios y porcentaje por interés.';

-- -----------------------------------------------------------------------------
-- Permisos de las vistas
-- -----------------------------------------------------------------------------
do $$
declare
    r text;
begin
    foreach r in array array['anon', 'authenticated'] loop
        if exists (select 1 from pg_roles where rolname = r) then
            execute format('revoke all on public.v_tendencia_menciones, public.v_megatendencia_menciones, '
                        || 'public.v_tendencia_top5_crecimiento, public.v_estadisticas_resumen_mes, '
                        || 'public.v_estadisticas_top5_contenidos, public.v_estadisticas_actividad_modulo, '
                        || 'public.v_estadisticas_usuarios_ciudad, public.v_estadisticas_intereses from %I', r);
        end if;
    end loop;
end;
$$;

grant select on public.v_tendencia_menciones, public.v_megatendencia_menciones, public.v_tendencia_top5_crecimiento
   to obs_invitado, obs_usuario,
      obs_gestor_faro, obs_gestor_flash, obs_gestor_empresas,
      obs_gestor_tendencias, obs_gestor_calendario, obs_superadmin;

grant select on public.v_estadisticas_resumen_mes, public.v_estadisticas_top5_contenidos,
                public.v_estadisticas_actividad_modulo, public.v_estadisticas_usuarios_ciudad,
                public.v_estadisticas_intereses
   to obs_superadmin;


-- >>> migrations/20261009030014_tipo_otro_categorias_superior.sql
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


-- >>> migrations/20261014020000_rol_gestor_flash.sql
-- =============================================================================
-- El módulo "Flash Informativo" pasa a llamarse "Flash" en toda la plataforma,
-- también el nombre de su rol gestor. El backend acepta los dos nombres, así que
-- esta migración se puede aplicar antes o después de publicar el código.
-- =============================================================================
update public.rol
   set nombre_rol      = 'Gestor Flash',
       descripcion_rol = 'Administra los eventos del Flash.',
       permisos        = 'CRUD Flash; visualizar los demás módulos'
 where nombre_rol = 'Gestor Flash Informativo';

comment on type public.tipo_evento is 'Tipo de evento (Flash y Calendario).';
comment on table public.flash_informativo_categoria is 'Categorías (etiquetas) de cada Flash.';
comment on table public.flash_informativo is 'Flash: eventos y oportunidades del entorno empresarial.';


-- >>> migrations/20261014030000_nombre_superadmin_superior.sql
-- El rol "SuperAdmin Superior" quedó escrito "SuperAdmin superior" en la base de
-- producción. La aplicación ya lo reconoce sin importar mayúsculas, pero se deja el
-- nombre oficial para que coincida en todas partes.
update public.rol
   set nombre_rol = 'SuperAdmin Superior'
 where lower(regexp_replace(btrim(nombre_rol), '\s+', ' ', 'g')) = 'superadmin superior'
   and nombre_rol <> 'SuperAdmin Superior';


-- >>> migrations/20261015010000_favoritos.sql
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


-- >>> migrations/20261016010000_alertas_diferenciadas.sql
-- =============================================================================
-- Alertas por correo diferenciadas.
-- Observatorio Empresarial - Uniempresarial
--
--   * Boletín de novedades (tendencias, contenidos nuevos y empresas nuevas):
--     frecuencia Inmediata, Diaria (nueva), Semanal o Ninguna.
--   * Recordatorios de eventos favoritos: una semana antes y el mismo día del
--     evento; cada usuario los activa o desactiva por separado.
--   * envio_alerta distingue el tipo de correo y, en los recordatorios, a qué
--     evento y aviso corresponde (para no enviarlo dos veces).
-- =============================================================================

alter type public.frecuencia_alertas add value if not exists 'Diaria' before 'Semanal';
comment on type public.frecuencia_alertas is 'Frecuencia del boletín de novedades por correo.';

alter table public.usuario
    add column recordatorios_eventos boolean not null default true;
comment on column public.usuario.recordatorios_eventos is
    'Recibir recordatorios por correo de los eventos favoritos (una semana antes y el mismo día).';

grant update (recordatorios_eventos) on public.usuario
   to obs_usuario, obs_gestor_faro, obs_gestor_flash, obs_gestor_empresas,
      obs_gestor_tendencias, obs_gestor_calendario;

create type public.tipo_envio as enum ('Boletin', 'Recordatorio');
comment on type public.tipo_envio is 'Tipo de correo de alerta: boletín de novedades o recordatorio de un evento favorito.';

create type public.aviso_recordatorio as enum ('Semana', 'Dia');
comment on type public.aviso_recordatorio is 'Recordatorio una semana antes (Semana) o el mismo día (Dia) del evento.';

alter table public.envio_alerta
    add column tipo_envio     public.tipo_envio not null default 'Boletin',
    add column tipo_contenido public.tipo_contenido,
    add column id_contenido   integer,
    add column aviso          public.aviso_recordatorio,
    add constraint envio_alerta_recordatorio_chk check (
        (tipo_envio = 'Boletin' and tipo_contenido is null and id_contenido is null and aviso is null)
        or (tipo_envio = 'Recordatorio' and tipo_contenido is not null and id_contenido is not null and aviso is not null)
    );
comment on column public.envio_alerta.tipo_envio is 'Boletín de novedades o recordatorio de un evento favorito.';
comment on column public.envio_alerta.aviso is 'En los recordatorios: una semana antes o el mismo día.';

-- Un mismo recordatorio (usuario, evento, aviso) se envía una sola vez.
create unique index envio_alerta_recordatorio_uk
    on public.envio_alerta (id_usuario, tipo_contenido, id_contenido, aviso)
    where tipo_envio = 'Recordatorio';

-- Los recordatorios los envía una tarea del sistema (sin usuario en la petición):
-- necesita leer los favoritos de todos. En una petición web siempre hay usuario,
-- así que un SuperAdmin sigue viendo solo los suyos.
create policy sistema_lectura on public.favorito for select
    to obs_superadmin
    using (public.fn_usuario_actual() is null);


-- >>> migrations/20261017010000_invitacion_empresas.sql
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


-- >>> migrations/20261018010000_rol_empresa_coformadora.sql
-- =============================================================================
-- Rol Empresa Coformadora.
-- Observatorio Empresarial - Uniempresarial
--
-- La cuenta que completa el registro por invitación representa a su empresa:
-- tiene todo lo de un Usuario (favoritos, alertas, intereses) y además edita
-- en cualquier momento la ficha de SU empresa desde Mi perfil.
-- =============================================================================

-- Rol de PostgreSQL. Hereda los permisos y las políticas de obs_usuario.
do $$
begin
    if not exists (select 1 from pg_roles where rolname = 'obs_empresa') then
        create role obs_empresa nologin;
    end if;
end;
$$;
comment on role obs_empresa is 'Empresa Coformadora: lo mismo que obs_usuario y además edita la ficha de su propia empresa.';
grant obs_usuario to obs_empresa;
grant obs_empresa to obs_backend;

insert into public.rol (nombre_rol, descripcion_rol, permisos)
values ('Empresa Coformadora',
        'Representante de una empresa coformadora registrada por invitación.',
        'Edita la información de su propia empresa; además, lo mismo que un Usuario.')
on conflict (nombre_rol) do nothing;

-- Su empresa: la ve aunque esté inactiva y edita los datos de la ficha.
-- El estado, la cuenta ligada, los premios y el tiempo como coformadora los
-- maneja el Observatorio.
grant update (razon_social, nombre_comercial, nit, sector_economico, descripcion, tamano_empresa,
              naturaleza_juridica, codigo_ciiu, link, estudiantes_recibidos, departamento, municipio,
              direccion, telefono, correo, anio_constitucion, logo_ec, imagen_portada)
   on public.empresa_coformadora to obs_empresa;

create policy propia_lectura on public.empresa_coformadora for select
    to obs_empresa
    using (id_usuario = public.fn_usuario_actual());
create policy propia_edicion on public.empresa_coformadora for update
    to obs_empresa
    using (id_usuario = public.fn_usuario_actual())
    with check (id_usuario = public.fn_usuario_actual());

-- El registro público solo crea Usuarios; la cuenta de una empresa solo se crea
-- con una invitación pendiente para ese mismo correo.
drop policy autenticacion_registro on public.usuario;
create policy autenticacion_registro on public.usuario for insert
    to obs_autenticacion
    with check (
        estado_usuario = 'Activo'
        and (
            id_rol = (select r.id_rol from public.rol r where r.nombre_rol = 'Usuario')
            or (
                id_rol = (select r.id_rol from public.rol r where r.nombre_rol = 'Empresa Coformadora')
                and exists (select 1 from public.invitacion_empresa i
                             where i.correo = usuario.correo
                               and i.estado = 'Pendiente'
                               and i.fecha_vencimiento > now())
            )
        )
    );

-- Las cuentas que ya completaron su registro por invitación pasan al rol nuevo.
update public.usuario u
   set id_rol = (select r.id_rol from public.rol r where r.nombre_rol = 'Empresa Coformadora')
 where u.id_rol = (select r.id_rol from public.rol r where r.nombre_rol = 'Usuario')
   and exists (select 1 from public.empresa_coformadora e where e.id_usuario = u.id_usuario);


-- >>> migrations/20261019010000_roles_multiusuario.sql
-- =============================================================================
-- Roles y multiusuario (1 de 2): varios roles por cuenta.
-- Observatorio Empresarial - Uniempresarial
--
--   Una misma cuenta (un solo correo) puede tener varios roles, por ejemplo
--      Gestor Faro Empresarial y Empresa Coformadora. Los roles de cada cuenta
--      quedan en usuario_rol; usuario.id_rol es el rol principal (el de más
--      alcance) y siempre está también en usuario_rol.
-- =============================================================================

-- -----------------------------------------------------------------------------
-- Varios roles por cuenta.
-- -----------------------------------------------------------------------------
create table public.usuario_rol (
    id_usuario integer not null references public.usuario (id_usuario) on delete cascade,
    id_rol     integer not null references public.rol (id_rol) on delete restrict,
    primary key (id_usuario, id_rol)
);
comment on table public.usuario_rol is 'Roles de cada cuenta. Una cuenta puede tener varios; usuario.id_rol es el principal.';

create index usuario_rol_id_rol_idx on public.usuario_rol (id_rol);

insert into public.usuario_rol (id_usuario, id_rol)
select id_usuario, id_rol from public.usuario
on conflict do nothing;

-- El rol principal siempre está entre los roles de la cuenta. La función corre
-- con los permisos de su dueño porque quien registra la cuenta (autenticación)
-- no escribe en usuario_rol.
create function public.fn_rol_principal_en_roles()
returns trigger
language plpgsql
security definer
set search_path = ''
as $$
begin
    insert into public.usuario_rol (id_usuario, id_rol)
    values (new.id_usuario, new.id_rol)
    on conflict do nothing;
    return new;
end;
$$;
comment on function public.fn_rol_principal_en_roles() is 'Agrega el rol principal (usuario.id_rol) a los roles de la cuenta.';
revoke all on function public.fn_rol_principal_en_roles() from public;

create trigger usuario_rol_principal
    after insert or update of id_rol on public.usuario
    for each row execute function public.fn_rol_principal_en_roles();

alter table public.usuario_rol enable row level security;

-- SuperAdmin (Super Admin y Gestor Observatorio): asigna y quita roles.
grant select, insert, update, delete on public.usuario_rol to obs_superadmin;
create policy superadmin_total on public.usuario_rol for all
    to obs_superadmin using (true) with check (true);

-- Cada cuenta ve sus propios roles (obs_empresa los hereda de obs_usuario).
grant select on public.usuario_rol
   to obs_usuario, obs_gestor_faro, obs_gestor_flash, obs_gestor_empresas,
      obs_gestor_tendencias, obs_gestor_calendario;
create policy propios on public.usuario_rol for select
    to obs_usuario, obs_gestor_faro, obs_gestor_flash, obs_gestor_empresas,
       obs_gestor_tendencias, obs_gestor_calendario
    using (id_usuario = public.fn_usuario_actual());

-- Autenticación: el backend lee los roles de la cuenta en cada petición.
grant select on public.usuario_rol to obs_autenticacion;
create policy autenticacion_lectura on public.usuario_rol for select
    to obs_autenticacion using (true);


-- >>> migrations/20261019020000_nombres_roles.sql
-- =============================================================================
-- Roles y multiusuario (2 de 2): nombres de los roles.
-- Observatorio Empresarial - Uniempresarial
--
--   "SuperAdmin Superior" -> "Super Admin"         (control total)
--   "SuperAdmin"          -> "Gestor Observatorio" (rol transversal)
--
-- Se aplica DESPUÉS de publicar el backend que reconoce los nombres nuevos.
-- En una base nueva los roles los crea seed.sql ya con el nombre nuevo.
-- =============================================================================

update public.rol
   set nombre_rol = 'Super Admin',
       descripcion_rol = 'Control total del sistema. Solo otro Super Admin puede asignar este rol o cambiarle los roles y el estado.',
       permisos = 'Crear, modificar, eliminar y visualizar todas las tablas'
 where lower(regexp_replace(trim(nombre_rol), '\s+', ' ', 'g')) = 'superadmin superior';

update public.rol
   set nombre_rol = 'Gestor Observatorio',
       descripcion_rol = 'Rol transversal: administra todos los módulos, los usuarios, las categorías y las estadísticas.',
       permisos = 'Crear, modificar, eliminar y visualizar todas las tablas'
 where nombre_rol = 'SuperAdmin';



-- >>> migrations/20261020010000_glosario.sql
-- =============================================================================
-- Glosario: términos y conceptos clave del Observatorio.
-- Observatorio Empresarial - Uniempresarial
--
--   * Todos consultan los términos activos.
--   * Los administran el Super Admin, el Gestor Observatorio y, si el Super Admin
--     delega esa tarea, las cuentas con el rol "Gestor Glosario".
--   * Los conceptos iniciales los entrega la institución.
-- =============================================================================

create table public.glosario_termino (
    id_termino          integer generated always as identity primary key,
    termino             varchar(120) not null,
    definicion          text         not null,
    fuente              varchar(300),
    estado_gt           public.estado_registro not null default 'Activo',
    creado_por          integer      references public.usuario (id_usuario) on delete set null,
    fecha_creacion      timestamptz  not null default now(),
    fecha_actualizacion timestamptz  not null default now(),

    constraint glosario_termino_chk check (length(trim(termino)) > 0),
    constraint glosario_definicion_chk check (length(trim(definicion)) > 0)
);
comment on table public.glosario_termino is 'Glosario: términos y conceptos clave del Observatorio.';
comment on column public.glosario_termino.fuente is 'Referencia o autor de la definición (opcional).';
comment on column public.glosario_termino.estado_gt is 'Inactivo: oculto al público; lo ven quienes administran el glosario.';

-- Un término no se repite (sin importar mayúsculas ni espacios de más).
create unique index glosario_termino_uk
    on public.glosario_termino (lower(regexp_replace(trim(termino), '\s+', ' ', 'g')));

create trigger glosario_termino_auditoria before insert or update on public.glosario_termino
    for each row execute function public.fn_auditoria();

alter table public.glosario_termino enable row level security;

-- Rol que se puede delegar: lo mismo que un Usuario y además administra el glosario.
do $$
begin
    if not exists (select 1 from pg_roles where rolname = 'obs_gestor_glosario') then
        create role obs_gestor_glosario nologin;
    end if;
end;
$$;
comment on role obs_gestor_glosario is 'Gestor Glosario: lo mismo que obs_usuario y además administra el glosario.';
grant obs_usuario to obs_gestor_glosario;
grant obs_gestor_glosario to obs_backend;

insert into public.rol (nombre_rol, descripcion_rol, permisos)
values ('Gestor Glosario',
        'Administra los términos y conceptos del glosario (rol delegado por el Super Admin).',
        'CRUD Glosario; visualizar los demás módulos')
on conflict (nombre_rol) do nothing;

-- Permisos. obs_empresa y obs_gestor_glosario heredan los de obs_usuario.
grant select on public.glosario_termino
   to obs_invitado, obs_usuario, obs_gestor_faro, obs_gestor_flash, obs_gestor_empresas,
      obs_gestor_tendencias, obs_gestor_calendario;
grant select, insert, update, delete on public.glosario_termino to obs_gestor_glosario, obs_superadmin;

create policy superadmin_total on public.glosario_termino for all
    to obs_superadmin using (true) with check (true);
create policy gestion_modulo on public.glosario_termino for all
    to obs_gestor_glosario using (true) with check (true);
create policy lectura_activos on public.glosario_termino for select
    to obs_invitado, obs_usuario, obs_gestor_faro, obs_gestor_flash, obs_gestor_empresas,
       obs_gestor_tendencias, obs_gestor_calendario
    using (estado_gt = 'Activo');


-- >>> migrations/20261021010000_nombres_flash_faro.sql
-- =============================================================================
-- Nombres de los módulos: "Flash Informativo" y "Faro".
-- Observatorio Empresarial - Uniempresarial
--
-- Renombra los roles gestores de esos módulos. El backend y el frontend
-- reconocen los nombres anteriores, así que se aplica después de publicar el código.
-- =============================================================================

update public.rol
   set nombre_rol      = 'Gestor Flash Informativo',
       descripcion_rol = 'Administra los eventos del Flash Informativo.',
       permisos        = 'CRUD Flash Informativo'
 where nombre_rol = 'Gestor Flash';

update public.rol
   set nombre_rol      = 'Gestor Faro',
       descripcion_rol = 'Administra becas, convocatorias, cursos y talleres del Faro.',
       permisos        = 'CRUD Faro'
 where nombre_rol = 'Gestor Faro Empresarial';


-- >>> migrations/20261022010000_registro_empresa_corto.sql
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
alter policy autenticacion_registro on public.empresa_coformadora
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


-- >>> migrations/20261023010000_carga_masiva.sql
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


-- >>> migrations/20261024010000_mencion_al_publicar.sql
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


-- >>> migrations/20261025010000_empresa_visible_al_aceptar.sql
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


-- >>> migrations/20261026010000_glosario_sin_repetidos.sql
-- =============================================================================
-- Glosario: no se repiten términos, sin importar tildes, mayúsculas, espacios
-- ni los dos puntos o el punto final.
-- Observatorio Empresarial - Uniempresarial
--
-- El índice anterior solo comparaba en minúsculas, así que «Ética» y «Etica:»
-- se podían crear por separado desde el formulario. Este índice aplica la misma
-- regla que ya usa la carga masiva, para la carga individual y la masiva.
-- =============================================================================

create unique index glosario_termino_normalizado_uk
    on public.glosario_termino (
        lower(translate(
            regexp_replace(regexp_replace(trim(termino), '[\s:.]+$', ''), '\s+', ' ', 'g'),
            'áéíóúüñÁÉÍÓÚÜÑ', 'aeiouunaeiouun'))
    );
comment on index public.glosario_termino_normalizado_uk is
    'Un término no se repite aunque cambien tildes, mayúsculas, espacios o los dos puntos finales.';


-- >>> migrations/20261027010000_bucket_imagenes.sql
-- Bucket público de Supabase Storage para las imágenes subidas (Faro, Flash y empresas).
-- Solo el backend sube y borra (con la llave secreta); cualquiera puede ver las imágenes.
-- Fuera de Supabase (pruebas, servidor propio) no existe el esquema storage y no hace nada.
do $$
begin
  if exists (select 1 from pg_namespace where nspname = 'storage') then
    insert into storage.buckets (id, name, public, file_size_limit, allowed_mime_types)
    values ('imagenes', 'imagenes', true, 5242880, array['image/jpeg', 'image/png'])
    on conflict (id) do nothing;
  end if;
end
$$;
