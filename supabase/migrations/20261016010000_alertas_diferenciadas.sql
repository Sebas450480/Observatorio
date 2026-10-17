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
