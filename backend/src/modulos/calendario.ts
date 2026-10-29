import { z } from 'zod';
import { crearRecurso } from './recurso.js';
import { OPCIONES_MODALIDAD, cargaRecurso, fechaHoraBogota, gratuitoYCosto } from '../servicios/cargaMasiva.js';
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
  /** Nombre del tipo cuando tipo_evento es "Otro". */
  tipo_otro: textoOpcional(40),
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
  camposImagen: ['imagen'],
  cargaMasiva: cargaRecurso({
    archivo: 'plantilla-eventos-institucionales',
    hoja: 'Eventos institucionales',
    columnas: [
      { clave: 'titulo', titulo: 'Título', obligatoria: true, ayuda: 'Nombre del evento (máx. 150 caracteres).', ejemplo: 'Feria de emprendimiento Uniempresarial', ancho: 34 },
      { clave: 'tipo_evento', titulo: 'Tipo de evento', tipo: 'lista', obligatoria: true, opciones: TIPOS_EVENTO, ayuda: 'Tipo de evento.', ejemplo: 'Feria' },
      { clave: 'tipo_otro', titulo: 'Otro tipo', ayuda: 'Solo si el tipo es "Otro": escribe cuál (máx. 40 caracteres).', ejemplo: 'Ceremonia de grados' },
      { clave: 'descripcion', titulo: 'Descripción', ayuda: 'De qué se trata.', ejemplo: 'Muestra de proyectos de los estudiantes.', ancho: 50 },
      { clave: 'fecha_inicio', titulo: 'Fecha de inicio', tipo: 'fecha', obligatoria: true, ayuda: 'Día en que empieza.', ejemplo: '20/11/2026', campos: ['fecha_inicio'] },
      { clave: 'hora_inicio', titulo: 'Hora de inicio', tipo: 'hora', ayuda: 'Hora en que empieza. Si no se conoce, déjala vacía (00:00).', ejemplo: '09:00' },
      { clave: 'fecha_fin', titulo: 'Fecha de finalización', tipo: 'fecha', ayuda: 'Día en que termina, si dura varios días.', ejemplo: '20/11/2026', campos: ['fecha_fin'] },
      { clave: 'hora_fin', titulo: 'Hora de finalización', tipo: 'hora', ayuda: 'Hora en que termina.', ejemplo: '13:00' },
      { clave: 'modalidad', titulo: 'Modalidad', tipo: 'lista', obligatoria: true, opciones: OPCIONES_MODALIDAD, ayuda: 'Cómo se asiste.', ejemplo: 'Presencial' },
      { clave: 'lugar', titulo: 'Lugar', ayuda: 'Sede o dirección (máx. 150 caracteres).', ejemplo: 'Sede Salitre, auditorio principal' },
      { clave: 'link_externo', titulo: 'Enlace', tipo: 'enlace', ayuda: 'Página de inscripción o información.', ejemplo: 'https://uniempresarial.edu.co' },
      { clave: 'es_gratuito', titulo: 'Gratuito', tipo: 'sino', ayuda: 'Si la entrada es gratis.', ejemplo: 'Sí' },
      { clave: 'costo', titulo: 'Costo (COP)', tipo: 'numero', ayuda: 'Valor en pesos, si no es gratuito.', ejemplo: '' },
      { clave: 'imagen', titulo: 'Imagen', tipo: 'imagen', campoImagen: 'imagen', ayuda: 'Foto del evento (opcional).', ejemplo: 'feria-emprendimiento.jpg' },
    ],
    armar: (f) => ({
      ...f,
      fecha_inicio: fechaHoraBogota(f.fecha_inicio, f.hora_inicio),
      fecha_fin: fechaHoraBogota(f.fecha_fin, f.hora_fin ?? f.hora_inicio) ?? null,
      ...gratuitoYCosto(f),
    }),
    esquema: esquema.refine((d) => !d.fecha_fin || d.fecha_fin >= d.fecha_inicio, {
      message: 'La finalización no puede ser antes del inicio', path: ['fecha_fin'],
    }),
    resumen: (d) => `${d.titulo} · ${d.fecha_inicio.slice(0, 10)}`,
    clave: (d) => `${d.titulo.toLocaleLowerCase('es')}|${d.fecha_inicio.slice(0, 10)}`,
    mensajeRepetido: 'Evento repetido en el archivo',
  }),
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
