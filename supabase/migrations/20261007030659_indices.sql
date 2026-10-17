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
