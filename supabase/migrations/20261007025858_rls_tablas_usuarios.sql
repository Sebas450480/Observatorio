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
