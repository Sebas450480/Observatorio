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
