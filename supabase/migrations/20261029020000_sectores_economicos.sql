-- Sectores económicos de las empresas coformadoras: las 21 secciones de la Clasificación
-- Industrial Internacional Uniforme (CIIU Rev. 4 adaptada para Colombia, DANE).
-- empresa_coformadora.sector_economico guarda el nombre del sector; si la empresa eligió
-- "Otro", guarda el texto que escribió, que es solo de esa empresa y no se agrega aquí.
create table public.sector_economico (
    id_sector smallint generated always as identity primary key,
    seccion   char(1)      not null unique,
    nombre    varchar(100) not null unique,
    -- Foto de ejemplo (imagenes/ejemplos/empresa-<foto>.jpg) para las empresas sin portada.
    foto      varchar(20)  not null default 'general'
);
comment on table public.sector_economico is 'Sectores económicos (secciones CIIU Rev. 4 A.C.) que se eligen en la ficha de la empresa.';

insert into public.sector_economico (seccion, nombre, foto) values
  ('A', 'Agricultura, ganadería, caza, silvicultura y pesca', 'agro'),
  ('B', 'Explotación de minas y canteras', 'industria'),
  ('C', 'Industrias manufactureras', 'industria'),
  ('D', 'Suministro de electricidad, gas, vapor y aire acondicionado', 'industria'),
  ('E', 'Distribución de agua, saneamiento ambiental y gestión de desechos', 'industria'),
  ('F', 'Construcción', 'construccion'),
  ('G', 'Comercio al por mayor y al por menor; reparación de vehículos', 'comercio'),
  ('H', 'Transporte y almacenamiento', 'transporte'),
  ('I', 'Alojamiento y servicios de comida', 'turismo'),
  ('J', 'Información y comunicaciones', 'tecnologia'),
  ('K', 'Actividades financieras y de seguros', 'finanzas'),
  ('L', 'Actividades inmobiliarias', 'finanzas'),
  ('M', 'Actividades profesionales, científicas y técnicas', 'servicios'),
  ('N', 'Actividades de servicios administrativos y de apoyo', 'servicios'),
  ('O', 'Administración pública y defensa; seguridad social obligatoria', 'servicios'),
  ('P', 'Educación', 'educacion'),
  ('Q', 'Atención de la salud humana y asistencia social', 'salud'),
  ('R', 'Actividades artísticas, de entretenimiento y recreación', 'general'),
  ('S', 'Otras actividades de servicios', 'servicios'),
  ('T', 'Actividades de los hogares como empleadores', 'servicios'),
  ('U', 'Organizaciones y entidades extraterritoriales', 'general');

-- Los nombres de la CIIU superan los 50 caracteres anteriores.
alter table public.empresa_coformadora alter column sector_economico type varchar(100);

alter table public.sector_economico enable row level security;
grant select on public.sector_economico
   to obs_invitado, obs_usuario,
      obs_gestor_faro, obs_gestor_flash, obs_gestor_empresas,
      obs_gestor_tendencias, obs_gestor_calendario, obs_autenticacion;
grant select, insert, update, delete on public.sector_economico to obs_superadmin;
create policy lectura on public.sector_economico for select
    to obs_invitado, obs_usuario, obs_gestor_faro, obs_gestor_flash, obs_gestor_empresas,
       obs_gestor_tendencias, obs_gestor_calendario, obs_autenticacion
    using (true);
create policy superadmin_total on public.sector_economico for all to obs_superadmin using (true) with check (true);
