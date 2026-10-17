import { z } from 'zod';
import { crearRecurso } from './recurso.js';
import { OPCIONES_MODALIDAD, cargaRecurso, fechaHoraBogota, gratuitoYCosto } from '../servicios/cargaMasiva.js';
import {
  ESTADOS, MODALIDADES, TIPOS_EVENTO, booleanoConsulta, dinero, enlace, fecha, fechaHora, listaIds,
  textoObligatorio, textoOpcional,
} from '../utilidades/esquemas.js';

/** Flash: eventos y oportunidades del entorno empresarial. */
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
  cargaMasiva: cargaRecurso({
    archivo: 'plantilla-flash-informativo',
    hoja: 'Flash Informativo',
    columnas: [
      { clave: 'titulo', titulo: 'Título', obligatoria: true, ayuda: 'Nombre del evento u oportunidad (máx. 150 caracteres).', ejemplo: 'Hannover Messe 2025', ancho: 34 },
      { clave: 'tipo_evento', titulo: 'Tipo de evento', tipo: 'lista', obligatoria: true, opciones: TIPOS_EVENTO, ayuda: 'Tipo de evento.', ejemplo: 'Feria' },
      { clave: 'tipo_otro', titulo: 'Otro tipo', ayuda: 'Solo si el tipo es "Otro": escribe cuál (máx. 40 caracteres).', ejemplo: 'Rueda de negocios' },
      { clave: 'descripcion', titulo: 'Descripción', ayuda: 'De qué se trata.', ejemplo: 'La feria más grande del mundo dedicada a la automatización y la robótica.', ancho: 50 },
      { clave: 'fecha_inicio', titulo: 'Fecha de inicio', tipo: 'fecha', obligatoria: true, ayuda: 'Día en que empieza.', ejemplo: '07/04/2025', campos: ['fecha_inicio'] },
      { clave: 'hora_inicio', titulo: 'Hora de inicio', tipo: 'hora', ayuda: 'Hora en que empieza. Si no se conoce, déjala vacía (00:00).', ejemplo: '08:00' },
      { clave: 'fecha_fin', titulo: 'Fecha de finalización', tipo: 'fecha', ayuda: 'Día en que termina, si dura varios días.', ejemplo: '11/04/2025', campos: ['fecha_fin'] },
      { clave: 'hora_fin', titulo: 'Hora de finalización', tipo: 'hora', ayuda: 'Hora en que termina.', ejemplo: '18:00' },
      { clave: 'modalidad', titulo: 'Modalidad', tipo: 'lista', obligatoria: true, opciones: OPCIONES_MODALIDAD, ayuda: 'Cómo se asiste.', ejemplo: 'Presencial' },
      { clave: 'lugar', titulo: 'Lugar', ayuda: 'Ciudad, país o sede (máx. 100 caracteres).', ejemplo: 'Hannover, Alemania' },
      { clave: 'departamento', titulo: 'Departamento', ayuda: 'Departamento de Colombia, si aplica.', ejemplo: 'Cundinamarca' },
      { clave: 'link', titulo: 'Enlace', tipo: 'enlace', ayuda: 'Página oficial o de inscripción.', ejemplo: 'https://www.hannovermesse.de' },
      { clave: 'es_gratuito', titulo: 'Gratuito', tipo: 'sino', ayuda: 'Si la entrada es gratis.', ejemplo: 'No' },
      { clave: 'costo', titulo: 'Costo (COP)', tipo: 'numero', ayuda: 'Valor en pesos, si no es gratuito.', ejemplo: '150000' },
      { clave: 'categorias', titulo: 'Categorías', tipo: 'categorias', ayuda: 'Temas o etiquetas del registro.', ejemplo: 'Tecnología, Innovación' },
      { clave: 'info_adicional', titulo: 'Información adicional', ayuda: 'Datos clave en viñetas o líneas.', ejemplo: 'Networking internacional', ancho: 40 },
      { clave: 'imagen', titulo: 'Imagen', tipo: 'imagen', campoImagen: 'imagen', ayuda: 'Imagen del evento.', ejemplo: 'hannover-messe.jpg' },
      { clave: 'estado_fi', titulo: 'Estado', tipo: 'lista', opciones: ESTADOS, ayuda: 'Activo se publica de inmediato; Inactivo queda oculto. Por defecto, Activo.', ejemplo: 'Activo' },
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
