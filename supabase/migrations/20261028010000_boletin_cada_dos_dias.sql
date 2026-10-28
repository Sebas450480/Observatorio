-- Boletín cada 2 días: nueva frecuencia entre la diaria y la semanal.
alter type public.frecuencia_alertas add value if not exists 'Cada2Dias' after 'Diaria';
