import { z } from 'zod';
import { crearRecurso } from './recurso.js';
import {
  ESTADOS, MODALIDADES, TIPOS_EVENTO, booleanoConsulta, dinero, enlace, fecha, fechaHora, listaIds,
  textoObligatorio, textoOpcional,
} from '../utilidades/esquemas.js';

/** Flash Informativo: eventos y oportunidades del entorno empresarial. */
const esquema = z.object({
  titulo: textoObligatorio(150),
  descripcion: textoOpcional(),
  fecha_inicio: fechaHora,
  fecha_fin: fechaHora.nullish(),
  modalidad: z.enum(MODALIDADES),
  costo: dinero.nullish(),
  es_gratuito: z.boolean().optional(),
  lugar: textoOpcional(100),
  link: enlace.nullish(),
  info_adicional: textoOpcional(),
  tipo_evento: z.enum(TIPOS_EVENTO),
  /** Nombre del tipo cuando tipo_evento es "Otro". */
  tipo_otro: textoOpcional(40),
  departamento: textoOpcional(50),
  estado_fi: z.enum(ESTADOS).optional(),
  categorias: listaIds.optional(),
});

const esquemaFiltros = z.object({
  q: z.string().trim().min(1).max(100).optional(),
  tipo_evento: z.enum(TIPOS_EVENTO).optional(),
  modalidad: z.enum(MODALIDADES).optional(),
  departamento: z.string().trim().max(50).optional(),
  gratuito: booleanoConsulta.optional(),
  desde: fecha.optional(),
  hasta: fecha.optional(),
});

export const rutasFlash = crearRecurso({
  nombre: 'flash',
  titulo: 'Flash Informativo',
  tabla: 'flash_informativo',
  id: 'id_fi',
  rolGestor: 'obs_gestor_flash',
  columnaEstado: 'estado_fi',
  esquema,
  tablaCategorias: 'flash_informativo_categoria',
  esquemaFiltros,
  aplicarFiltros: (f, v) => {
    if (v.q) f.texto(['t.titulo', 't.descripcion', 't.lugar'], v.q as string);
    if (v.tipo_evento) f.y(`t.tipo_evento = ${f.param(v.tipo_evento)}`);
    if (v.modalidad) f.y(`t.modalidad = ${f.param(v.modalidad)}`);
    if (v.departamento) f.y(`t.departamento ilike ${f.param(v.departamento)}`);
    if (v.gratuito !== undefined) f.y(`t.es_gratuito = ${f.param(v.gratuito)}`);
    if (v.desde) f.y(`t.fecha_inicio >= ${f.param(v.desde)}::date`);
    if (v.hasta) f.y(`t.fecha_inicio < ${f.param(v.hasta)}::date + 1`);
  },
  ordenes: { fecha: 't.fecha_inicio', titulo: 't.titulo', creacion: 't.fecha_creacion' },
  ordenDefecto: 'fecha',
  camposImagen: ['imagen'],
  columnasExportar: [
    { campo: 'id_fi', titulo: 'ID', ancho: 0.4 },
    { campo: 'titulo', titulo: 'Título', ancho: 2 },
    { campo: 'tipo_evento', titulo: 'Tipo', ancho: 0.8 },
    { campo: 'fecha_inicio', titulo: 'Inicio', ancho: 1.1 },
    { campo: 'fecha_fin', titulo: 'Fin', ancho: 1.1 },
    { campo: 'modalidad', titulo: 'Modalidad', ancho: 0.8 },
    { campo: 'costo', titulo: 'Costo', ancho: 0.7 },
    { campo: 'lugar', titulo: 'Lugar', ancho: 1.6 },
    { campo: 'departamento', titulo: 'Departamento', ancho: 1.1 },
    { campo: 'categorias', titulo: 'Categorías', ancho: 1.2 },
    { campo: 'link', titulo: 'Enlace', ancho: 1.2 },
    { campo: 'estado_fi', titulo: 'Estado', ancho: 0.6 },
  ],
});
