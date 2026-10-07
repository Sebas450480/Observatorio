import { z } from 'zod';
import { crearRecurso } from './recurso.js';
import {
  ESTADOS, MODALIDADES, TIPOS_FARO, booleanoConsulta, dinero, enlace, fecha, listaIds,
  textoObligatorio, textoOpcional,
} from '../utilidades/esquemas.js';

/** Faro Empresarial: becas, convocatorias, cursos y talleres. */
const esquema = z.object({
  titulo: textoObligatorio(150),
  descripcion: textoOpcional(),
  tipo: z.enum(TIPOS_FARO),
  fecha_publicacion: fecha.optional(),
  fecha_inicio: fecha.nullish(),
  fecha_cierre: fecha.nullish(),
  entidad: textoOpcional(150),
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
  titulo: 'Faro Empresarial',
  tabla: 'faro_empresarial',
  id: 'id_fe',
  rolGestor: 'obs_gestor_faro',
  columnaEstado: 'estado_fe',
  esquema,
  tablaCategorias: 'faro_empresarial_categoria',
  esquemaFiltros,
  aplicarFiltros: (f, v) => {
    if (v.q) f.texto(['t.titulo', 't.descripcion', 't.entidad', 't.lugar'], v.q as string);
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
  columnasExportar: [
    { campo: 'id_fe', titulo: 'ID', ancho: 0.4 },
    { campo: 'titulo', titulo: 'Título', ancho: 2 },
    { campo: 'tipo', titulo: 'Tipo', ancho: 0.9 },
    { campo: 'entidad', titulo: 'Entidad', ancho: 1.5 },
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
