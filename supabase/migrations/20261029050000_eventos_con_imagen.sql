-- Foto de los eventos institucionales (calendario), igual que en Flash y Faro.
-- Sin foto, la plataforma muestra la foto de ejemplo de su tipo de evento.
alter table public.calendario_eventos add column imagen text;
comment on column public.calendario_eventos.imagen is 'Dirección pública de la imagen del evento (Supabase Storage).';
