-- Ya no se ofrece el boletín «Inmediata» (en el momento): las cuentas que lo tenían pasan
-- al boletín diario. El valor se conserva en el tipo frecuencia_alertas por compatibilidad,
-- pero la API ya no lo acepta.
update public.usuario set frecuencia_alertas = 'Diaria' where frecuencia_alertas = 'Inmediata';
