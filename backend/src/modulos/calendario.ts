import { z } from 'zod';
import { crearRecurso } from './recurso.js';
import {
  MODALIDADES, TIPOS_EVENTO, dinero, enlace, fecha, fechaHora, textoObligatorio, textoOpcional,
} from '../utilidades/esquemas.js';

/** Calendario de eventos institucionales. No tiene estado ni categorías. */
const esquema = z.object({
  titulo: textoObligatorio(150),
  descripcion: textoOpcional(),
  fecha_inicio: fechaHora,
  fecha_fin: fechaHora.nullish(),
  modalidad: z.enum(MODALIDADES),
  lugar: textoOpcional(150),
  link_externo: enlace.nullish(),
  tipo_evento: z.enum(TIPOS_EVENTO),
  costo: dinero.nullish(),
  es_gratuito: z.boolean().optional(),
});

const esquemaFiltros = z.object({
  q: z.string().trim().min(1).max(100).optional(),
  tipo_evento: z.enum(TIPOS_EVENTO).optional(),
  modalidad: z.enum(MODALIDADES).optional(),
  /** Rango de fechas de la vista semanal o mensual: eventos que se cruzan con [desde, hasta]. */
  desde: fecha.optional(),
  hasta: fecha.optional(),
});

export const rutasCalendario = crearRecurso({
  nombre: 'calendario',
  titulo: 'Calendario de eventos institucionales',
  tabla: 'calendario_eventos',
  id: 'id_evento',
  rolGestor: 'obs_gestor_calendario',
  esquema,
  esquemaFiltros,
  aplicarFiltros: (f, v) => {
    if (v.q) f.texto(['t.titulo', 't.descripcion', 't.lugar'], v.q as string);
    if (v.tipo_evento) f.y(`t.tipo_evento = ${f.param(v.tipo_evento)}`);
    if (v.modalidad) f.y(`t.modalidad = ${f.param(v.modalidad)}`);
    if (v.desde) f.y(`coalesce(t.fecha_fin, t.fecha_inicio) >= ${f.param(v.desde)}::date`);
    if (v.hasta) f.y(`t.fecha_inicio < ${f.param(v.hasta)}::date + 1`);
  },
  ordenes: { fecha: 't.fecha_inicio', titulo: 't.titulo' },
  ordenDefecto: 'fecha',
  columnasExportar: [
    { campo: 'id_evento', titulo: 'ID', ancho: 0.4 },
    { campo: 'titulo', titulo: 'Título', ancho: 2 },
    { campo: 'tipo_evento', titulo: 'Tipo', ancho: 0.8 },
    { campo: 'fecha_inicio', titulo: 'Inicio', ancho: 1.1 },
    { campo: 'fecha_fin', titulo: 'Fin', ancho: 1.1 },
    { campo: 'modalidad', titulo: 'Modalidad', ancho: 0.8 },
    { campo: 'lugar', titulo: 'Lugar', ancho: 1.6 },
    { campo: 'costo', titulo: 'Costo', ancho: 0.7 },
    { campo: 'link_externo', titulo: 'Enlace', ancho: 1.2 },
  ],
});
