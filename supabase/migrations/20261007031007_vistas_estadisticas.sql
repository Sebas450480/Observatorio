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
