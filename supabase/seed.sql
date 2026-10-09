-- =============================================================================
-- Fase 1 - Paso 8: Datos iniciales (seed).
-- Observatorio Empresarial - Uniempresarial
--
-- Se carga automáticamente con `supabase db reset` (ver supabase/config.toml).
-- Contiene:
--   * Catálogos reales: los 7 roles y las categorías.
--   * Datos de EJEMPLO tomados del prototipo en Figma, para que backend y
--     frontend tengan con qué trabajar. Las empresas distintas de
--     TecnoSoluciones y los NIT son ficticios.
--
-- No crea usuarios: el SuperAdmin inicial se crea en la Fase 2 con un script
-- del backend, para que ninguna contraseña quede escrita en el repositorio.
-- =============================================================================

-- -----------------------------------------------------------------------------
-- Roles
-- -----------------------------------------------------------------------------
insert into public.rol (nombre_rol, descripcion_rol, permisos) values
    ('SuperAdmin',                   'Administrador del sistema. Control total de la plataforma, usuarios, roles, categorías y estadísticas.', 'Crear, modificar, eliminar y visualizar todas las tablas'),
    ('Usuario',                      'Usuario registrado. Consulta los registros activos de todos los módulos y administra su perfil e intereses.', 'Visualizar registros activos; editar su perfil'),
    ('Gestor Faro Empresarial',      'Administra becas, convocatorias, cursos y talleres del Faro Empresarial.', 'CRUD Faro Empresarial; visualizar los demás módulos'),
    ('Gestor Flash Informativo',     'Administra los eventos del Flash Informativo.', 'CRUD Flash Informativo; visualizar los demás módulos'),
    ('Gestor Empresas Coformadoras', 'Administra el catálogo de empresas coformadoras y sus contactos.', 'CRUD Empresas Coformadoras; visualizar los demás módulos'),
    ('Gestor Tendencias',            'Administra las tendencias, sus fuentes y menciones.', 'CRUD Tendencias; visualizar los demás módulos'),
    ('Gestor Calendario',            'Administra los eventos institucionales del calendario.', 'CRUD Calendario; visualizar los demás módulos'),
    ('SuperAdmin Superior',          'Administrador principal. Las mismas funciones del SuperAdmin; ningún otro SuperAdmin puede cambiarle el rol.', 'Crear, modificar, eliminar y visualizar todas las tablas');

-- -----------------------------------------------------------------------------
-- Categorías (intereses y etiquetas de contenidos)
-- -----------------------------------------------------------------------------
insert into public.categoria (nombre_categoria) values
    ('Tecnología'), ('Innovación'), ('Emprendimiento'), ('Comercio'), ('Finanzas'),
    ('Educación'), ('Empresarial'), ('Liderazgo'), ('Formación'), ('Apoyo económico'),
    ('Sostenibilidad'), ('Becas'), ('Convocatorias'), ('Cursos'), ('Talleres'),
    ('Eventos'), ('Transformación digital'), ('Talento humano');

-- -----------------------------------------------------------------------------
-- Flash Informativo (ejemplos del Figma)
-- -----------------------------------------------------------------------------
insert into public.flash_informativo
    (titulo, descripcion, fecha_inicio, fecha_fin, modalidad, costo, es_gratuito, lugar, link, info_adicional, tipo_evento, departamento)
values
    ('Congreso de Innovación y Transformación Organizacional',
     'Este congreso reúne a líderes académicos, directivos empresariales y emprendedores globales para explorar estrategias avanzadas de innovación tecnológica, automatización y transformación organizacional. Descubre metodologías comprobadas para acelerar el crecimiento institucional.',
     '2026-10-20 08:00-05', '2026-10-20 17:00-05', 'Virtual', 150000, false,
     'Plataforma Digital Uniempresarial — Aula Virtual de Eventos Especiales', null,
     E'• Certificación oficial de asistencia expedida por Uniempresarial.\n• Cupos limitados previa inscripción en el formulario oficial.\n• Dirigido a estudiantes, egresados y aliados del sector productivo.',
     'Congreso', 'Bogotá D.C.'),
    ('Hackathon de Soluciones Empresariales',
     'Competencia intensiva de 48 horas donde equipos multidisciplinarios diseñan y prototipan soluciones tecnológicas a retos reales del sector empresarial colombiano. Mentores expertos guiarán a los participantes en metodologías ágiles, design thinking y desarrollo rápido de productos digitales.',
     '2026-10-21 07:00-05', '2026-10-21 21:00-05', 'Presencial', null, true,
     'Sede Principal Uniempresarial — Laboratorio de Innovación, Bogotá', null,
     E'• Premiación a los tres mejores proyectos con capital semilla.\n• Equipos de 3 a 5 integrantes, inscripción previa obligatoria.\n• Incluye alimentación, acceso a herramientas tecnológicas y mentoría.',
     'Hackathon', 'Bogotá D.C.'),
    ('Foro de Finanzas Sostenibles',
     'Espacio de diálogo entre emprendedores, inversores y expertos en sostenibilidad para analizar instrumentos financieros verdes, criterios ESG y oportunidades de negocio con impacto ambiental positivo. Paneles con casos de éxito en economía circular y bonos verdes.',
     '2026-10-28 09:00-05', '2026-10-28 16:00-05', 'Hibrido', null, true,
     'Auditorio Uniempresarial & Streaming — Transmisión simultánea en vivo', null,
     E'• Ponentes internacionales especializados en finanzas sostenibles.\n• Certificado digital de participación para asistentes presenciales y virtuales.\n• Networking con fondos de inversión de impacto y aceleradoras verdes.',
     'Foro', 'Bogotá D.C.'),
    ('Cumbre de Comercio Digital y Logística de Envíos',
     'Cumbre virtual que reúne a líderes del comercio electrónico y la logística para explorar tendencias en fulfillment, última milla, marketplaces internacionales y estrategias de expansión digital.',
     '2026-11-04 10:00-05', '2026-11-04 15:00-05', 'Virtual', null, true,
     'Sala Virtual de Conferencias', null,
     E'• Acceso gratuito con registro anticipado en el portal.\n• Grabaciones disponibles por 30 días para inscritos.\n• Dirigido a empresarios, operadores logísticos y emprendedores.',
     'Cumbre', 'Bogotá D.C.'),
    ('Seminario de Finanzas para Startups',
     'Seminario práctico diseñado para fundadores y directores financieros de startups que buscan estructurar sus finanzas corporativas, preparar rondas de inversión y optimizar la gestión del capital. Casos reales de valoración y modelamiento financiero para empresas en etapa temprana.',
     '2026-11-08 08:30-05', '2026-11-08 13:00-05', 'Presencial', 150000, false,
     'Sede Uniempresarial — Auditorio Central, Bogotá, Colombia', null,
     E'• Material de estudio y plantillas financieras descargables incluidas.\n• Sesión práctica de modelamiento financiero con Excel avanzado.\n• Cupos limitados a 40 participantes para garantizar atención personalizada.',
     'Seminario', 'Bogotá D.C.'),
    ('Taller de Transformación Digital de Procesos',
     'Taller interactivo enfocado en metodologías de transformación digital para optimizar procesos organizacionales. Los participantes aprenderán a mapear flujos de trabajo, identificar cuellos de botella y diseñar soluciones digitales que aumenten la eficiencia operativa de sus empresas.',
     '2026-11-12 14:00-05', '2026-11-12 18:00-05', 'Virtual', null, true,
     'Aula Virtual Académica — Plataforma Interactiva Uniempresarial', null,
     E'• Ejercicios prácticos de mapeo y rediseño de procesos en tiempo real.\n• Herramientas digitales de diagnóstico organizacional incluidas.\n• Abierto a profesionales, estudiantes y emprendedores de cualquier sector.',
     'Taller', 'Bogotá D.C.');

insert into public.flash_informativo_categoria (id_fi, id_categoria)
select f.id_fi, c.id_categoria
from (values
    ('Congreso de Innovación y Transformación Organizacional', 'Tecnología'),
    ('Congreso de Innovación y Transformación Organizacional', 'Innovación'),
    ('Hackathon de Soluciones Empresariales',                  'Tecnología'),
    ('Hackathon de Soluciones Empresariales',                  'Emprendimiento'),
    ('Foro de Finanzas Sostenibles',                           'Finanzas'),
    ('Foro de Finanzas Sostenibles',                           'Sostenibilidad'),
    ('Cumbre de Comercio Digital y Logística de Envíos',       'Comercio'),
    ('Cumbre de Comercio Digital y Logística de Envíos',       'Tecnología'),
    ('Seminario de Finanzas para Startups',                    'Finanzas'),
    ('Seminario de Finanzas para Startups',                    'Emprendimiento'),
    ('Taller de Transformación Digital de Procesos',           'Transformación digital'),
    ('Taller de Transformación Digital de Procesos',           'Innovación')
) as v(titulo, categoria)
join public.flash_informativo f on f.titulo = v.titulo
join public.categoria c         on c.nombre_categoria = v.categoria;

-- -----------------------------------------------------------------------------
-- Faro Empresarial (ejemplos del Figma)
-- -----------------------------------------------------------------------------
insert into public.faro_empresarial
    (titulo, descripcion, tipo, fecha_publicacion, fecha_inicio, fecha_cierre, entidad, link, modalidad, lugar, costo, es_gratuito, duracion)
values
    ('Beca de posgrado Oxford–Pershing Square (MBA 1+1)',
     'Beca de posgrado para cursar el MBA 1+1 de Oxford con apoyo de la Fundación Pershing Square.',
     'Becas', '2026-09-15', null, null, 'Universidad de Oxford + Fundación Pershing Square',
     'https://www.ox.ac.uk/pershing-square', 'Presencial', 'Oxford, Reino Unido', null, true, '1 año (MBA 1+1)'),
    ('Convocatoria Fondo Emprender',
     'Convocatoria de capital semilla para emprendimientos con potencial de crecimiento.',
     'Convocatorias', '2026-09-20', null, '2026-11-02', 'SENA - Fondo Emprender',
     null, 'Virtual', 'Colombia', null, true, null),
    ('Curso de Liderazgo Empresarial',
     'Programa virtual para fortalecer habilidades de liderazgo y dirección de equipos.',
     'Cursos', '2026-09-25', '2027-02-03', null, 'Universidad Javeriana',
     null, 'Virtual', 'Bogotá, Colombia', null, false, '6 meses'),
    ('Convocatoria de Innovación Empresarial EAFIT',
     'Convocatoria para proyectos de innovación desarrollados en alianza universidad-empresa.',
     'Convocatorias', '2026-09-28', null, '2026-10-30', 'Universidad EAFIT',
     null, 'Presencial', 'Medellín, Colombia', null, true, null),
    ('Curso de Transformación Digital para Empresas',
     'Formación en herramientas tecnológicas para la transformación digital de empresas.',
     'Cursos', '2026-10-01', null, '2026-11-27', 'Cámara de Comercio de Bogotá',
     null, 'Hibrido', 'Bogotá, Colombia', null, true, null),
    ('Taller intensivo de Formación Empresarial',
     'Taller de formación intensiva en gestión y estrategia empresarial.',
     'Talleres', '2026-10-01', '2026-10-12', null, 'Centro de Extensión U. de los Andes',
     null, 'Presencial', 'Bogotá, Colombia', null, false, 'Formación intensiva');

insert into public.faro_empresarial_categoria (id_fe, id_categoria)
select f.id_fe, c.id_categoria
from (values
    ('Beca de posgrado Oxford–Pershing Square (MBA 1+1)', 'Educación'),
    ('Beca de posgrado Oxford–Pershing Square (MBA 1+1)', 'Innovación'),
    ('Convocatoria Fondo Emprender',                     'Apoyo económico'),
    ('Convocatoria Fondo Emprender',                     'Emprendimiento'),
    ('Curso de Liderazgo Empresarial',                   'Liderazgo'),
    ('Convocatoria de Innovación Empresarial EAFIT',     'Innovación'),
    ('Convocatoria de Innovación Empresarial EAFIT',     'Empresarial'),
    ('Curso de Transformación Digital para Empresas',    'Tecnología'),
    ('Taller intensivo de Formación Empresarial',        'Formación')
) as v(titulo, categoria)
join public.faro_empresarial f on f.titulo = v.titulo
join public.categoria c        on c.nombre_categoria = v.categoria;

-- -----------------------------------------------------------------------------
-- Empresas Coformadoras (TecnoSoluciones viene del Figma; las demás son ficticias)
-- -----------------------------------------------------------------------------
insert into public.empresa_coformadora
    (nit, razon_social, nombre_comercial, descripcion, sector_economico, tamano_empresa, tiempo_coformadora,
     link, estudiantes_recibidos, premios_recibidos, naturaleza_juridica, departamento, municipio,
     direccion, telefono, correo, anio_constitucion)
values
    ('900.123.456-7', 'TecnoSoluciones S.A.S.', 'TecnoSoluciones',
     'TecnoSoluciones S.A.S. es una empresa líder en el desarrollo de soluciones tecnológicas y software, con más de 10 años de experiencia en el mercado. Nos enfocamos en la innovación, la transformación digital y el acompañamiento a organizaciones en su crecimiento.',
     'Tecnológico', 'Mediana', '7 años', 'https://www.tecnosoluciones.com', 24, 3, 'Privada',
     'Antioquia', 'Medellín', 'Cra 43A # 5-10, Ed. Sede', '(604) 444 1234', 'info@tecnosoluciones.com', 2015),
    ('900.200.001-1', 'AgroAndes S.A.S.',            'AgroAndes',     'Empresa de ejemplo del sector agroindustrial.',      'Agroindustrial', 'Pequeña', '3 años', null, 8,  1, 'Privada', 'Cundinamarca', 'Chía',         null, null, null, 2012),
    ('900.200.002-2', 'Logística Express S.A.S.',    'LogiExpress',   'Empresa de ejemplo de transporte y logística.',     'Logística',      'Mediana', '5 años', null, 15, 0, 'Privada', 'Bogotá D.C.',  'Bogotá',       null, null, null, 2010),
    ('900.200.003-3', 'Finanzas Claras S.A.',        'Finanzas Claras','Empresa de ejemplo de servicios financieros.',     'Financiero',     'Grande',  '10 años',null, 40, 5, 'Privada', 'Bogotá D.C.',  'Bogotá',       null, null, null, 1998),
    ('900.200.004-4', 'Salud Integral IPS S.A.S.',   'Salud Integral','Empresa de ejemplo del sector salud.',              'Salud',          'Mediana', '4 años', null, 12, 1, 'Privada', 'Valle del Cauca','Cali',       null, null, null, 2008),
    ('900.200.005-5', 'Constructora Horizonte S.A.S.','Horizonte',    'Empresa de ejemplo del sector construcción.',       'Construcción',   'Grande',  '6 años', null, 20, 2, 'Privada', 'Atlántico',    'Barranquilla', null, null, null, 2001),
    ('900.200.006-6', 'Moda Viva S.A.S.',            'Moda Viva',     'Empresa de ejemplo del sector textil y confección.','Textil',         'Pequeña', '2 años', null, 5,  0, 'Privada', 'Antioquia',    'Medellín',     null, null, null, 2016),
    ('900.200.007-7', 'EnergíaVerde S.A.S. E.S.P.',  'EnergíaVerde',  'Empresa de ejemplo de energías renovables.',        'Energía',        'Mediana', '3 años', null, 10, 2, 'Privada', 'La Guajira',   'Riohacha',     null, null, null, 2014),
    ('900.200.008-8', 'Educa Digital S.A.S.',        'Educa Digital', 'Empresa de ejemplo de tecnología educativa.',       'Educación',      'Micro',   '1 año',  null, 3,  0, 'Privada', 'Bogotá D.C.',  'Bogotá',       null, null, null, 2020),
    ('900.200.009-9', 'Sabores de Colombia S.A.S.',  'Sabores',       'Empresa de ejemplo de alimentos y bebidas.',        'Alimentos',      'Mediana', '8 años', null, 18, 1, 'Privada', 'Santander',    'Bucaramanga',  null, null, null, 2005),
    ('900.200.010-0', 'Consultores Asociados Ltda.', 'Consultores',   'Empresa de ejemplo de consultoría empresarial.',    'Servicios',      'Pequeña', '5 años', null, 9,  1, 'Privada', 'Bogotá D.C.',  'Bogotá',       null, null, null, 2009),
    ('900.200.011-1', 'Turismo Caribe S.A.S.',       'Turismo Caribe','Empresa de ejemplo del sector turismo.',            'Turismo',        'Micro',   '2 años', null, 4,  0, 'Privada', 'Bolívar',      'Cartagena',    null, null, null, 2018);

insert into public.contacto_empresa (id_ec, nombre, cargo, correo, telefono, es_principal)
select e.id_ec, 'Carlos Restrepo', 'Gerente general', 'carlos.restrepo@tecnosoluciones.com', '+57 300 123 4567', true
from public.empresa_coformadora e
where e.nit = '900.123.456-7';

-- -----------------------------------------------------------------------------
-- Tendencias (ejemplos del Figma, agrupadas en 4 megatendencias)
-- -----------------------------------------------------------------------------
insert into public.tendencia_empresarial
    (megatendencia, tendencia, descripcion, comportamiento_mundo, comportamiento_colombia, fecha_publicacion)
values
    ('Tecnología y sociedad', 'IA generativa',
     'Herramientas que crean textos, imágenes y código y transforman la productividad de las empresas.',
     'La adopción de IA generativa en las empresas crece más del 30 % anual, impulsada por asistentes de productividad y atención al cliente.',
     'Las pymes colombianas la usan sobre todo en marketing digital, servicio al cliente y tareas administrativas, aunque la falta de formación sigue siendo un reto.',
     '2026-09-29'),
    ('Medio ambiente y sostenibilidad', 'Energías renovables',
     'Transición hacia fuentes limpias como la solar y la eólica en procesos productivos.',
     'La inversión en renovables supera a la de combustibles fósiles.',
     'Crecen los parques solares y eólicos en La Guajira y el Caribe.', '2026-09-15'),
    ('Economía y trabajo', 'Trabajo híbrido',
     'Modelos que combinan trabajo presencial y remoto para ganar flexibilidad.',
     'Se consolida como el esquema preferido por empresas de servicios.',
     'Las empresas de Bogotá y Medellín lideran su implementación.', '2026-09-26'),
    ('Tecnología y sociedad', 'Ciberseguridad',
     'Protección de datos y sistemas frente a ataques cada vez más frecuentes.',
     'Aumentan los ataques de ransomware a empresas de todos los tamaños.',
     'Crece la inversión en seguridad digital en sectores financiero y salud.', '2026-09-10'),
    ('Medio ambiente y sostenibilidad', 'Economía circular',
     'Modelos que reutilizan, reparan y reciclan para reducir residuos.',
     'La Unión Europea y Asia impulsan regulaciones de economía circular.',
     'Avanza la Estrategia Nacional de Economía Circular en la industria.', '2026-09-17'),
    ('Tecnología y sociedad', 'Automatización de tareas',
     'Uso de software y robots para automatizar procesos repetitivos.',
     'Las empresas automatizan áreas administrativas y de operaciones.',
     'Las pymes adoptan herramientas de automatización de bajo costo.', '2026-09-24'),
    ('Tecnología y sociedad', 'Agentes autónomos',
     'Sistemas de IA que ejecutan tareas completas con mínima supervisión.',
     'Grandes tecnológicas lanzan agentes para empresas y consumidores.',
     'Primeros pilotos en banca y comercio electrónico.', '2026-09-19'),
    ('Demografía y cultura', 'Envejecimiento poblacional',
     'Aumento de la población mayor y sus efectos en el mercado laboral y el consumo.',
     'La población mayor de 60 años crece más rápido que otros grupos.',
     'Colombia envejece más rápido que el promedio de la región.', '2026-09-12'),
    ('Medio ambiente y sostenibilidad', 'Captura de carbono',
     'Tecnologías que capturan y almacenan CO₂ para reducir emisiones.',
     'Aumentan los proyectos de captura en industria pesada.',
     'Proyectos de bonos de carbono en bosques y sector agrícola.', '2026-09-03'),
    ('Economía y trabajo', 'Economía de plataformas',
     'Modelos de negocio basados en plataformas digitales que conectan oferta y demanda.',
     'Plataformas de servicios y comercio dominan nuevos mercados.',
     'Crece el debate sobre la regulación del trabajo en plataformas.', '2026-09-05'),
    ('Demografía y cultura', 'Diversidad e inclusión',
     'Prácticas empresariales que promueven equipos diversos e incluyentes.',
     'Las empresas reportan metas de diversidad en sus informes.',
     'Aumentan los programas de equidad de género en grandes empresas.', '2026-09-08'),
    ('Medio ambiente y sostenibilidad', 'Movilidad sostenible',
     'Transporte con menores emisiones: eléctrico, compartido y activo.',
     'Las ventas de vehículos eléctricos siguen en aumento.',
     'Bogotá amplía su flota de buses eléctricos.', '2026-09-22'),
    ('Economía y trabajo', 'Formación y upskilling',
     'Actualización de habilidades de los trabajadores ante los cambios tecnológicos.',
     'Las empresas invierten en programas de formación continua.',
     'Crecen los programas de formación en habilidades digitales.', '2026-09-30'),
    ('Demografía y cultura', 'Economía plateada',
     'Productos y servicios pensados para las personas mayores.',
     'Se perfila como uno de los mercados de mayor crecimiento.',
     'Surgen emprendimientos de salud y bienestar para mayores.', '2026-10-01'),
    ('Tecnología y sociedad', 'Conectividad 5G/6G',
     'Redes móviles de alta velocidad que habilitan nuevos servicios digitales.',
     'El despliegue de 5G avanza y comienzan las pruebas de 6G.',
     'Despliegue de 5G en las principales ciudades del país.', '2026-10-02');

insert into public.fuente_tendencia (id_te, nombre)
select t.id_te, v.nombre
from (values
    ('MinTIC — Informe de transformación digital 2026'),
    ('Observatorio Empresarial — Encuesta a pymes'),
    ('Foro Económico Mundial — Future of Jobs')
) as v(nombre)
join public.tendencia_empresarial t on t.tendencia = 'IA generativa';

insert into public.tendencia_categoria (id_te, id_categoria)
select t.id_te, c.id_categoria
from public.tendencia_empresarial t
join public.categoria c on c.nombre_categoria = case t.megatendencia
        when 'Tecnología y sociedad'           then 'Tecnología'
        when 'Medio ambiente y sostenibilidad' then 'Sostenibilidad'
        when 'Economía y trabajo'              then 'Empresarial'
        when 'Demografía y cultura'            then 'Talento humano'
    end;

-- Menciones de ejemplo en el último año, con cantidades distintas por tendencia
-- para que el mapa muestre bloques de diferente tamaño y haya crecimiento reciente.
insert into public.mencion_tendencia (id_te, fuente, fecha)
select
    t.id_te,
    'Ejemplo',
    current_date - ((g * 37 + t.id_te * 11) % case when g % 3 = 0 then 45 else 365 end)
from public.tendencia_empresarial t
cross join lateral generate_series(1, 60 - (t.id_te % 15) * 3) as g;

-- -----------------------------------------------------------------------------
-- Calendario de eventos institucionales (ejemplos del Figma)
-- -----------------------------------------------------------------------------
insert into public.calendario_eventos
    (titulo, descripcion, fecha_inicio, fecha_fin, modalidad, lugar, link_externo, tipo_evento, costo, es_gratuito)
values
    ('Talent for Business 2026',
     'Encuentro que conecta a empresas, talento y aliados del ecosistema empresarial para generar oportunidades de empleo, prácticas y alianzas estratégicas.',
     '2026-10-13 08:00-05', '2026-10-13 17:00-05', 'Presencial', 'Sede Principal Uniempresarial — Bogotá',
     null, 'Foro', null, true),
    ('Congreso de Innovación',
     'Congreso institucional sobre innovación y transferencia de conocimiento.',
     '2026-10-15 08:00-05', '2026-10-15 17:00-05', 'Presencial', 'Auditorio Uniempresarial — Bogotá',
     null, 'Congreso', null, true),
    ('Foro de Emprendimiento',
     'Espacio de diálogo sobre modelos de negocio sostenibles, economía circular e impacto social en el emprendimiento colombiano.',
     '2026-10-21 14:00-05', '2026-10-21 18:00-05', 'Hibrido', 'Auditorio Uniempresarial — Bogotá',
     null, 'Foro', null, true),
    ('Cumbre Comercio Digital',
     'Cumbre sobre comercio electrónico, logística y expansión digital.',
     '2026-11-04 10:00-05', '2026-11-04 15:00-05', 'Virtual', 'Sala Virtual de Conferencias',
     null, 'Cumbre', null, true);
