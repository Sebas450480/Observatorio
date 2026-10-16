import { z } from 'zod';
import { crearRecurso } from './recurso.js';
import { OPCIONES_MODALIDAD, cargaRecurso, gratuitoYCosto } from '../servicios/cargaMasiva.js';
import {
  ESTADOS, MODALIDADES, TIPOS_FARO, booleanoConsulta, dinero, enlace, fecha, listaIds,
  textoObligatorio, textoOpcional,
} from '../utilidades/esquemas.js';

/** Faro: becas, convocatorias, cursos y talleres. */
const esquema = z.object({
  titulo: textoObligatorio(150),
  descripcion: textoOpcional(),
  tipo: z.enum(TIPOS_FARO),
  fecha_publicacion: fecha.optional(),
  fecha_inicio: fecha.nullish(),
  fecha_cierre: fecha.nullish(),
  entidad: textoOpcional(150),
  /** A quién va dirigida (p. ej. "Profesionales con experiencia laboral"). */
  dirigida_a: textoOpcional(1000),
  link: enlace.nullish(),
  modalidad: z.enum(MODALIDADES).nullish(),
  lugar: textoOpcional(150),
  costo: dinero.nullish(),
  es_gratuito: z.boolean().optional(),
  duracion: textoOpcional(50),
  estado_fe: z.enum(ESTADOS).optional(),
  categorias: listaIds.optional(),
});

const esquemaFiltros = z.object({
  q: z.string().trim().min(1).max(100).optional(),
  tipo: z.enum(TIPOS_FARO).optional(),
  modalidad: z.enum(MODALIDADES).optional(),
  // RF-10: por defecto solo se muestran las convocatorias vigentes (cierre hoy o después, o sin fecha de cierre).
  vigentes: booleanoConsulta.default(true),
});

export const rutasFaro = crearRecurso({
  nombre: 'faro',
  titulo: 'Faro',
  tabla: 'faro_empresarial',
  id: 'id_fe',
  rolGestor: 'obs_gestor_faro',
  columnaEstado: 'estado_fe',
  esquema,
  tablaCategorias: 'faro_empresarial_categoria',
  esquemaFiltros,
  aplicarFiltros: (f, v) => {
    if (v.q) f.texto(['t.titulo', 't.descripcion', 't.entidad', 't.lugar', 't.dirigida_a'], v.q as string);
    if (v.tipo) f.y(`t.tipo = ${f.param(v.tipo)}`);
    if (v.modalidad) f.y(`t.modalidad = ${f.param(v.modalidad)}`);
    if (v.vigentes) f.y('(t.fecha_cierre is null or t.fecha_cierre >= current_date)');
  },
  ordenes: {
    cierre: 't.fecha_cierre',
    publicacion: 't.fecha_publicacion',
    inicio: 't.fecha_inicio',
    titulo: 't.titulo',
  },
  ordenDefecto: 'publicacion',
  direccionDefecto: 'desc',
  camposImagen: ['imagen'],
  cargaMasiva: cargaRecurso({
    archivo: 'plantilla-faro',
    hoja: 'Faro',
    columnas: [
      { clave: 'titulo', titulo: 'Título', obligatoria: true, ayuda: 'Nombre de la beca, convocatoria, curso o taller (máx. 150 caracteres).', ejemplo: 'Swedish Institute Scholarship for Global Professionals', ancho: 36 },
      { clave: 'tipo', titulo: 'Tipo', tipo: 'lista', obligatoria: true, opciones: TIPOS_FARO, ayuda: 'Tipo de oportunidad.', ejemplo: 'Becas' },
      { clave: 'entidad', titulo: 'Entidad', ayuda: 'Institución que la ofrece (máx. 150 caracteres).', ejemplo: 'Swedish Institute – Gobierno de Suecia' },
      { clave: 'descripcion', titulo: 'Descripción', ayuda: 'Qué ofrece (cobertura, beneficios, requisitos).', ejemplo: 'Cobertura total de matrícula y estipendio mensual.', ancho: 50 },
      { clave: 'dirigida_a', titulo: 'Dirigida a', ayuda: 'A quién va dirigida.', ejemplo: 'Profesionales con experiencia laboral y liderazgo comprobado', ancho: 40 },
      { clave: 'fecha_cierre', titulo: 'Fecha de cierre', tipo: 'fecha', ayuda: 'Último día para postularse. Vacía = "Por definir".', ejemplo: '25/02/2026' },
      { clave: 'fecha_inicio', titulo: 'Fecha de inicio', tipo: 'fecha', ayuda: 'Para cursos y talleres: día en que empieza.', ejemplo: '02/03/2026' },
      { clave: 'fecha_publicacion', titulo: 'Fecha de publicación', tipo: 'fecha', ayuda: 'Vacía = hoy.', ejemplo: '15/01/2026' },
      { clave: 'modalidad', titulo: 'Modalidad', tipo: 'lista', opciones: OPCIONES_MODALIDAD, ayuda: 'Cómo se realiza.', ejemplo: 'Presencial' },
      { clave: 'lugar', titulo: 'Lugar', ayuda: 'Ciudad, país o institución.', ejemplo: 'Suecia' },
      { clave: 'duracion', titulo: 'Duración', ayuda: 'Texto libre (máx. 50 caracteres).', ejemplo: '1 a 2 años' },
      { clave: 'link', titulo: 'Enlace', tipo: 'enlace', ayuda: 'Página oficial o de postulación.', ejemplo: 'https://si.se/en/apply/scholarships/' },
      { clave: 'es_gratuito', titulo: 'Gratuito', tipo: 'sino', ayuda: 'Si no tiene costo para quien participa.', ejemplo: 'Sí' },
      { clave: 'costo', titulo: 'Costo (COP)', tipo: 'numero', ayuda: 'Valor en pesos, si no es gratuito.', ejemplo: '' },
      { clave: 'categorias', titulo: 'Categorías', tipo: 'categorias', ayuda: 'Temas o etiquetas del registro.', ejemplo: 'Educación, Internacional' },
      { clave: 'estado_fe', titulo: 'Estado', tipo: 'lista', opciones: ESTADOS, ayuda: 'Activo se publica de inmediato; Inactivo queda oculto. Por defecto, Activo.', ejemplo: 'Activo' },
    ],
    armar: (f) => ({ ...f, ...gratuitoYCosto(f) }),
    esquema,
    resumen: (d) => `${d.titulo} · ${d.tipo}`,
    clave: (d) => `${d.titulo.toLocaleLowerCase('es')}|${d.tipo}`,
    mensajeRepetido: 'Registro repetido en el archivo',
  }),
  columnasExportar: [
    { campo: 'id_fe', titulo: 'ID', ancho: 0.4 },
    { campo: 'titulo', titulo: 'Título', ancho: 2 },
    { campo: 'tipo', titulo: 'Tipo', ancho: 0.9 },
    { campo: 'entidad', titulo: 'Entidad', ancho: 1.5 },
    { campo: 'dirigida_a', titulo: 'Dirigida a', ancho: 1.5 },
    { campo: 'fecha_publicacion', titulo: 'Publicación', ancho: 0.8 },
    { campo: 'fecha_inicio', titulo: 'Inicio', ancho: 0.8 },
    { campo: 'fecha_cierre', titulo: 'Cierre', ancho: 0.8 },
    { campo: 'modalidad', titulo: 'Modalidad', ancho: 0.8 },
    { campo: 'lugar', titulo: 'Lugar', ancho: 1.2 },
    { campo: 'duracion', titulo: 'Duración', ancho: 0.8 },
    { campo: 'categorias', titulo: 'Etiquetas', ancho: 1.2 },
    { campo: 'link', titulo: 'Enlace', ancho: 1.2 },
    { campo: 'estado_fe', titulo: 'Estado', ancho: 0.6 },
  ],
});
