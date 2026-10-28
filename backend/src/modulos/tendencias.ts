import { z } from 'zod';
import { crearRecurso } from './recurso.js';
import { conRol, type Cliente } from '../db/contexto.js';
import { noEncontrado } from '../errores.js';
import { requiereRol } from '../middlewares/sesion.js';
import { cargaRecurso } from '../servicios/cargaMasiva.js';
import { ESTADOS, enlace, fecha, idPositivo, listaIds, textoObligatorio, textoOpcional, normalizarNombre, formatoOracion } from '../utilidades/esquemas.js';

/** Tendencias: radar de tendencias agrupadas por megatendencia, con fuentes y menciones. */
const esquemaFuente = z.object({
  nombre: textoObligatorio(150),
  link: enlace.nullish(),
});

const esquema = z.object({
  megatendencia: textoObligatorio(60),
  // Siempre en formato de oración, aunque la escriban toda en mayúscula.
  tendencia: textoObligatorio(80).transform(formatoOracion),
  descripcion: textoOpcional(),
  comportamiento_mundo: textoOpcional(),
  comportamiento_colombia: textoOpcional(),
  fecha_publicacion: fecha.optional(),
  estado_te: z.enum(ESTADOS).optional(),
  categorias: listaIds.optional(),
  /** Reemplaza todas las fuentes de la tendencia. */
  fuentes: z.array(esquemaFuente).max(30).optional(),
});

const esquemaFiltros = z.object({
  q: z.string().trim().min(1).max(100).optional(),
  megatendencia: z.string().trim().max(60).optional(),
  /** Publicadas desde esta fecha (filtro "Todas las fechas" del Figma). */
  desde: fecha.optional(),
});

const soloGestor = requiereRol('obs_gestor_tendencias');

async function guardarFuentes(cliente: Cliente, id: number, datos: Record<string, unknown>) {
  const fuentes = datos.fuentes as z.infer<typeof esquemaFuente>[] | undefined;
  if (!fuentes) return;
  await cliente.query('delete from fuente_tendencia where id_te = $1', [id]);
  for (const fuente of fuentes) {
    await cliente.query('insert into fuente_tendencia (id_te, nombre, link) values ($1, $2, $3)', [
      id,
      fuente.nombre,
      fuente.link ?? null,
    ]);
  }
}

// ----------------------------------------------------------------------------------
// Carga masiva desde Excel (RF-22), con las columnas del formato de tendencias de la universidad.
// ----------------------------------------------------------------------------------
const NUMERO_FUENTES = 5;
const columnasFuentes = Array.from({ length: NUMERO_FUENTES }, (_, i) => [
  { clave: `fuente_${i + 1}`, titulo: `Fuente ${i + 1}`, ayuda: 'Nombre de la fuente consultada.', ejemplo: i === 0 ? 'MinTIC — Informe 2026' : undefined, campos: ['fuentes'] },
  { clave: `enlace_${i + 1}`, titulo: `Enlace fuente ${i + 1}`, tipo: 'enlace' as const, ayuda: 'Enlace de la fuente (opcional).', ejemplo: i === 0 ? 'https://www.mintic.gov.co' : undefined },
]).flat();

const cargaTendencias = cargaRecurso({
  archivo: 'plantilla-tendencias',
  hoja: 'Tendencias',
  columnas: [
    { clave: 'megatendencia', titulo: 'Megatendencia', obligatoria: true, ayuda: 'Gran tema que agrupa la tendencia (máx. 60 caracteres). Si ya existe, escríbela igual.', ejemplo: 'Tecnología y sociedad', ancho: 26 },
    { clave: 'tendencia', titulo: 'Tendencia', obligatoria: true, ayuda: 'Nombre de la tendencia o subtendencia (máx. 80 caracteres).', ejemplo: 'IA generativa', ancho: 26 },
    { clave: 'categorias', titulo: 'Sector / categorías', tipo: 'categorias', ayuda: 'Sectores o categorías relacionadas.', ejemplo: 'Tecnología, Innovación', ancho: 24 },
    { clave: 'descripcion', titulo: 'Descripción', ayuda: 'En qué consiste.', ejemplo: 'Herramientas que crean textos, imágenes y código.', ancho: 50 },
    { clave: 'comportamiento_mundo', titulo: 'Comportamiento en el mundo', ayuda: 'Cómo se comporta en el mundo.', ejemplo: 'La adopción crece más del 30 % anual.', ancho: 40 },
    { clave: 'comportamiento_colombia', titulo: 'Comportamiento en Colombia', ayuda: 'Cómo se comporta en Colombia.', ejemplo: 'Las pymes la usan en marketing digital.', ancho: 40 },
    { clave: 'fecha_publicacion', titulo: 'Fecha de publicación', tipo: 'fecha', ayuda: 'Vacía = hoy.', ejemplo: '29/09/2026' },
    ...columnasFuentes,
    { clave: 'estado_te', titulo: 'Estado', tipo: 'lista', opciones: ESTADOS, ayuda: 'Activo se publica de inmediato; Inactivo queda oculto. Por defecto, Activo.', ejemplo: 'Activo' },
  ],
  armar: (f) => ({
    ...f,
    fuentes: Array.from({ length: NUMERO_FUENTES }, (_, i) => ({ nombre: f[`fuente_${i + 1}`], link: f[`enlace_${i + 1}`] ?? null }))
      .filter((x) => x.nombre !== undefined || x.link !== null)
      .map((x) => ({ nombre: x.nombre ?? '', link: x.link })),
  }),
  esquema,
  resumen: (d) => `${d.megatendencia} · ${d.tendencia}`,
  clave: (d) => `${normalizarNombre(d.megatendencia)}|${normalizarNombre(d.tendencia)}`,
  mensajeRepetido: 'Tendencia repetida en el archivo',
  revisar: async (c, filas) => {
    // Una megatendencia escrita con otras mayúsculas o sin tildes se une a la que ya existe
    // (o a la primera forma en que aparece en el archivo), en vez de crear otra distinta.
    const megas = await c.query<{ megatendencia: string }>('select distinct megatendencia from tendencia_empresarial');
    const nombreMega = new Map(megas.rows.map((m) => [normalizarNombre(m.megatendencia), m.megatendencia]));
    for (const { datos } of filas) {
      const clave = normalizarNombre(datos.megatendencia);
      if (!nombreMega.has(clave)) nombreMega.set(clave, datos.megatendencia);
      datos.megatendencia = nombreMega.get(clave)!;
    }
    // Tendencias que ya existen en la misma megatendencia (RF-15).
    const existentes = await c.query<{ megatendencia: string; tendencia: string }>('select megatendencia, tendencia from tendencia_empresarial');
    const ya = new Set(existentes.rows.map((e) => `${normalizarNombre(e.megatendencia)}|${normalizarNombre(e.tendencia)}`));
    return filas
      .filter((f) => ya.has(`${normalizarNombre(f.datos.megatendencia)}|${normalizarNombre(f.datos.tendencia)}`))
      .map((f) => ({ fila: f.fila, columna: 'Tendencia', mensaje: 'La tendencia ya existe en el Observatorio' }));
  },
});

const periodo = z.enum(['semana', 'mes', 'anio', 'total']).default('mes');
const columnaPeriodo = { semana: 'menciones_semana', mes: 'menciones_mes', anio: 'menciones_anio', total: 'menciones_total' };

export const rutasTendencias = crearRecurso({
  nombre: 'tendencias',
  titulo: 'Tendencias Empresariales',
  tabla: 'tendencia_empresarial',
  id: 'id_te',
  rolGestor: 'obs_gestor_tendencias',
  columnaEstado: 'estado_te',
  esquema,
  camposEspeciales: ['fuentes'],
  tablaCategorias: 'tendencia_categoria',
  selectExtra: [
    `coalesce((select json_agg(json_build_object('id_fuente', f.id_fuente, 'nombre', f.nombre, 'link', f.link)
                                order by f.id_fuente)
                 from fuente_tendencia f where f.id_te = t.id_te), '[]'::json) as fuentes`,
    '(select count(*)::int from mencion_tendencia m where m.id_te = t.id_te) as menciones',
  ],
  guardarEspeciales: guardarFuentes,
  cargaMasiva: cargaTendencias,
  esquemaFiltros,
  aplicarFiltros: (f, v) => {
    if (v.q) {
      f.texto(['t.tendencia', 't.megatendencia', 't.descripcion', 't.comportamiento_mundo', 't.comportamiento_colombia'], v.q as string);
    }
    if (v.megatendencia) f.y(`t.megatendencia ilike ${f.param(v.megatendencia)}`);
    if (v.desde) f.y(`t.fecha_publicacion >= ${f.param(v.desde)}::date`);
  },
  ordenes: {
    publicacion: 't.fecha_publicacion',
    id: 't.id_te',
    tendencia: 'lower(t.tendencia)',
    megatendencia: 'lower(t.megatendencia)',
    descripcion: 'lower(t.descripcion)',
    mundo: 'lower(t.comportamiento_mundo)',
    colombia: 'lower(t.comportamiento_colombia)',
  },
  ordenDefecto: 'publicacion',
  direccionDefecto: 'desc',
  columnasExportar: [
    { campo: 'id_te', titulo: 'ID', ancho: 0.4 },
    { campo: 'megatendencia', titulo: 'Megatendencia', ancho: 1.1 },
    { campo: 'tendencia', titulo: 'Tendencia', ancho: 1.1 },
    { campo: 'descripcion', titulo: 'Descripción', ancho: 2 },
    { campo: 'comportamiento_mundo', titulo: 'Mundo', ancho: 1.8 },
    { campo: 'comportamiento_colombia', titulo: 'Colombia', ancho: 1.8 },
    { campo: 'fuentes', titulo: 'Fuentes', ancho: 1.4 },
    { campo: 'fecha_publicacion', titulo: 'Publicación', ancho: 0.7 },
    { campo: 'estado_te', titulo: 'Estado', ancho: 0.6 },
  ],
  rutasExtra: (router) => {
    // Mapa de tendencias: tamaño de cada bloque según las menciones del periodo.
    router.get('/mapa', async (req, res) => {
      const p = periodo.parse(req.query.periodo);
      const columna = columnaPeriodo[p];
      const datos = await conRol(req.sesion, async (c) => {
        const tendencias = await c.query(
          `select id_te, megatendencia, tendencia, ${columna} as menciones
             from v_tendencia_menciones order by megatendencia, ${columna} desc, tendencia`,
        );
        const megatendencias = await c.query(
          `select megatendencia, tendencias, ${columna} as menciones
             from v_megatendencia_menciones order by ${columna} desc, megatendencia`,
        );
        return { periodo: p, megatendencias: megatendencias.rows, tendencias: tendencias.rows };
      });
      res.json(datos);
    });

    router.get('/top5', async (req, res) => {
      const filas = await conRol(req.sesion, async (c) => (await c.query('select * from v_tendencia_top5_crecimiento')).rows);
      res.json(filas);
    });

    router.get('/megatendencias', async (req, res) => {
      const filas = await conRol(req.sesion, async (c) =>
        (await c.query('select distinct megatendencia from tendencia_empresarial order by megatendencia')).rows.map(
          (r: { megatendencia: string }) => r.megatendencia,
        ));
      res.json(filas);
    });


    // Registrar una nueva mención de una tendencia.
    router.post('/:id/menciones', soloGestor, async (req, res) => {
      const id = idPositivo.parse(req.params.id);
      const datos = z.object({ fuente: textoOpcional(150), fecha: fecha.optional() }).parse(req.body ?? {});
      const mencion = await conRol(req.sesion, async (c) => {
        const existe = await c.query('select 1 from tendencia_empresarial where id_te = $1', [id]);
        if (!existe.rowCount) throw noEncontrado('Tendencia');
        const { rows } = await c.query(
          'insert into mencion_tendencia (id_te, fuente, fecha) values ($1, $2, coalesce($3::date, current_date)) returning *',
          [id, datos.fuente ?? null, datos.fecha ?? null],
        );
        return rows[0];
      });
      res.status(201).json(mencion);
    });
  },
});
