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
