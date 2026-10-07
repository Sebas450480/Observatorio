import ExcelJS from 'exceljs';
import { z } from 'zod';
import { crearRecurso } from './recurso.js';
import { conRol, type Cliente } from '../db/contexto.js';
import { ErrorApi, noEncontrado } from '../errores.js';
import { requiereRol } from '../middlewares/sesion.js';
import { recibirArchivo } from '../servicios/archivos.js';
import { ESTADOS, enlace, fecha, idPositivo, listaIds, textoObligatorio, textoOpcional } from '../utilidades/esquemas.js';

/** Tendencias: radar de tendencias agrupadas por megatendencia, con fuentes y menciones. */
const esquemaFuente = z.object({
  nombre: textoObligatorio(150),
  link: enlace.nullish(),
});

const esquema = z.object({
  megatendencia: textoObligatorio(60),
  tendencia: textoObligatorio(80),
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
// Importación masiva desde Excel (RF-22). Columnas de la plantilla:
// ----------------------------------------------------------------------------------
const COLUMNAS_PLANTILLA = [
  { clave: 'megatendencia', titulo: 'Megatendencia', ejemplo: 'Tecnología y sociedad' },
  { clave: 'tendencia', titulo: 'Tendencia', ejemplo: 'IA generativa' },
  { clave: 'descripcion', titulo: 'Descripción', ejemplo: 'Herramientas que crean textos, imágenes y código.' },
  { clave: 'comportamiento_mundo', titulo: 'Comportamiento en el mundo', ejemplo: 'La adopción crece más del 30 % anual.' },
  { clave: 'comportamiento_colombia', titulo: 'Comportamiento en Colombia', ejemplo: 'Las pymes la usan en marketing digital.' },
  { clave: 'fecha_publicacion', titulo: 'Fecha de publicación (AAAA-MM-DD)', ejemplo: '2026-09-29' },
  { clave: 'fuentes', titulo: 'Fuentes (Nombre | enlace; separadas por punto y coma)', ejemplo: 'MinTIC — Informe 2026 | https://www.mintic.gov.co; Foro Económico Mundial' },
  { clave: 'categorias', titulo: 'Categorías (separadas por coma)', ejemplo: 'Tecnología, Innovación' },
] as const;

const MAX_FILAS_IMPORTAR = 2000;

interface ErrorFila {
  fila: number;
  mensaje: string;
}

function textoCelda(valor: ExcelJS.CellValue): string {
  if (valor === null || valor === undefined) return '';
  if (valor instanceof Date) return valor.toISOString().slice(0, 10);
  if (typeof valor === 'object') {
    if ('richText' in valor) return valor.richText.map((p) => p.text).join('');
    if ('text' in valor) return String(valor.text);
    if ('result' in valor) return valor.result === undefined ? '' : String(valor.result);
  }
  return String(valor);
}

function interpretarFuentes(texto: string): { nombre: string; link: string | null }[] {
  return texto
    .split(/[;\n]/)
    .map((parte) => parte.trim())
    .filter(Boolean)
    .map((parte) => {
      const [nombre, link] = parte.split('|').map((s) => s.trim());
      return { nombre: nombre ?? '', link: link || null };
    });
}

async function generarPlantilla(): Promise<Buffer> {
  const libro = new ExcelJS.Workbook();
  const hoja = libro.addWorksheet('Tendencias');
  hoja.columns = COLUMNAS_PLANTILLA.map((c) => ({ header: c.titulo, key: c.clave, width: Math.max(22, c.titulo.length + 2) }));
  hoja.getRow(1).font = { bold: true, color: { argb: 'FFFFFFFF' } };
  hoja.getRow(1).fill = { type: 'pattern', pattern: 'solid', fgColor: { argb: 'FF1F3A68' } };
  hoja.addRow(Object.fromEntries(COLUMNAS_PLANTILLA.map((c) => [c.clave, c.ejemplo])));
  const ayuda = libro.addWorksheet('Instrucciones');
  ayuda.columns = [{ header: 'Instrucciones', key: 'texto', width: 110 }];
  [
    'Cada fila de la hoja "Tendencias" es una tendencia. Borra la fila de ejemplo antes de importar.',
    'Megatendencia y Tendencia son obligatorias. No se aceptan tendencias repetidas en la misma megatendencia.',
    'Fecha de publicación: AAAA-MM-DD. Si se deja vacía, se usa la fecha de hoy.',
    'Fuentes: "Nombre | enlace" separadas por punto y coma. El enlace es opcional.',
    'Categorías: nombres de categorías existentes, separados por coma.',
    'Si alguna fila tiene errores, no se importa ninguna y se indica qué corregir.',
  ].forEach((texto) => ayuda.addRow({ texto }));
  return Buffer.from(await libro.xlsx.writeBuffer());
}

async function importarExcel(cliente: Cliente, archivo: Buffer) {
  const libro = new ExcelJS.Workbook();
  try {
    await libro.xlsx.load(archivo as unknown as ArrayBuffer);
  } catch {
    throw new ErrorApi(400, 'El archivo no es un Excel (.xlsx) válido');
  }
  const hoja = libro.getWorksheet('Tendencias') ?? libro.worksheets[0];
  if (!hoja) throw new ErrorApi(400, 'El archivo no tiene hojas');

  // Validar encabezados.
  const encabezados = COLUMNAS_PLANTILLA.map((_, i) => textoCelda(hoja.getRow(1).getCell(i + 1).value).trim());
  const faltantes = COLUMNAS_PLANTILLA.filter((c, i) => encabezados[i] !== c.titulo).map((c) => c.titulo);
  if (faltantes.length) {
    throw new ErrorApi(422, 'El archivo no tiene la estructura de la plantilla', {
      columnas_esperadas: COLUMNAS_PLANTILLA.map((c) => c.titulo),
      columnas_con_problema: faltantes,
    });
  }

  const categorias = await cliente.query<{ id_categoria: number; nombre_categoria: string }>(
    'select id_categoria, nombre_categoria from categoria',
  );
  const idCategoria = new Map(categorias.rows.map((c) => [c.nombre_categoria.toLocaleLowerCase('es'), c.id_categoria]));

  const errores: ErrorFila[] = [];
  const validas: { fila: number; datos: z.infer<typeof esquema> }[] = [];
  const vistas = new Set<string>();

  for (let numero = 2; numero <= hoja.rowCount; numero++) {
    const fila = hoja.getRow(numero);
    const celdas = COLUMNAS_PLANTILLA.map((_, i) => textoCelda(fila.getCell(i + 1).value).trim());
    if (celdas.every((c) => c === '')) continue;
    if (validas.length + errores.length >= MAX_FILAS_IMPORTAR) {
      throw new ErrorApi(422, `El archivo supera el máximo de ${MAX_FILAS_IMPORTAR} filas`);
    }

    const valor = (clave: (typeof COLUMNAS_PLANTILLA)[number]['clave']) =>
      celdas[COLUMNAS_PLANTILLA.findIndex((c) => c.clave === clave)] ?? '';

    const nombresCategorias = valor('categorias').split(',').map((s) => s.trim()).filter(Boolean);
    const desconocidas = nombresCategorias.filter((n) => !idCategoria.has(n.toLocaleLowerCase('es')));
    if (desconocidas.length) {
      errores.push({ fila: numero, mensaje: `Categorías que no existen: ${desconocidas.join(', ')}` });
      continue;
    }

    const resultado = esquema.safeParse({
      megatendencia: valor('megatendencia'),
      tendencia: valor('tendencia'),
      descripcion: valor('descripcion'),
      comportamiento_mundo: valor('comportamiento_mundo'),
      comportamiento_colombia: valor('comportamiento_colombia'),
      fecha_publicacion: valor('fecha_publicacion') || undefined,
      fuentes: interpretarFuentes(valor('fuentes')),
      categorias: nombresCategorias.map((n) => idCategoria.get(n.toLocaleLowerCase('es'))!),
    });
    if (!resultado.success) {
      errores.push({
        fila: numero,
        mensaje: resultado.error.issues.map((i) => `${i.path.join('.') || 'fila'}: ${i.message}`).join('; '),
      });
      continue;
    }

    const clave = `${resultado.data.megatendencia}|${resultado.data.tendencia}`.toLocaleLowerCase('es');
    if (vistas.has(clave)) {
      errores.push({ fila: numero, mensaje: 'Tendencia repetida dentro del archivo' });
      continue;
    }
    vistas.add(clave);
    validas.push({ fila: numero, datos: resultado.data });
  }

  // Posibles duplicados con lo que ya existe (RF-15).
  if (validas.length) {
    const existentes = await cliente.query<{ megatendencia: string; tendencia: string }>(
      `select megatendencia, tendencia from tendencia_empresarial
        where lower(megatendencia || '|' || tendencia) = any($1::text[])`,
      [validas.map((v) => `${v.datos.megatendencia}|${v.datos.tendencia}`.toLocaleLowerCase('es'))],
    );
    const yaExisten = new Set(existentes.rows.map((e) => `${e.megatendencia}|${e.tendencia}`.toLocaleLowerCase('es')));
    for (const v of validas) {
      if (yaExisten.has(`${v.datos.megatendencia}|${v.datos.tendencia}`.toLocaleLowerCase('es'))) {
        errores.push({ fila: v.fila, mensaje: 'La tendencia ya existe en el Observatorio' });
      }
    }
  }

  if (!validas.length && !errores.length) throw new ErrorApi(422, 'El archivo no tiene filas con datos');
  if (errores.length) {
    errores.sort((a, b) => a.fila - b.fila);
    throw new ErrorApi(422, 'El archivo tiene errores. No se importó ninguna fila.', { errores });
  }

  for (const { datos } of validas) {
    const { rows } = await cliente.query<{ id_te: number }>(
      `insert into tendencia_empresarial
         (megatendencia, tendencia, descripcion, comportamiento_mundo, comportamiento_colombia, fecha_publicacion)
       values ($1, $2, $3, $4, $5, coalesce($6::date, current_date)) returning id_te`,
      [
        datos.megatendencia,
        datos.tendencia,
        datos.descripcion ?? null,
        datos.comportamiento_mundo ?? null,
        datos.comportamiento_colombia ?? null,
        datos.fecha_publicacion ?? null,
      ],
    );
    const id = rows[0]!.id_te;
    await guardarFuentes(cliente, id, datos);
    if (datos.categorias?.length) {
      await cliente.query(
        'insert into tendencia_categoria (id_te, id_categoria) select $1, unnest($2::int[]) on conflict do nothing',
        [id, [...new Set(datos.categorias)]],
      );
    }
  }
  return { importadas: validas.length };
}

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
  esquemaFiltros,
  aplicarFiltros: (f, v) => {
    if (v.q) {
      f.texto(['t.tendencia', 't.megatendencia', 't.descripcion', 't.comportamiento_mundo', 't.comportamiento_colombia'], v.q as string);
    }
    if (v.megatendencia) f.y(`t.megatendencia ilike ${f.param(v.megatendencia)}`);
    if (v.desde) f.y(`t.fecha_publicacion >= ${f.param(v.desde)}::date`);
  },
  ordenes: { publicacion: 't.fecha_publicacion', tendencia: 't.tendencia', megatendencia: 't.megatendencia' },
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

    router.get('/plantilla', soloGestor, async (_req, res) => {
      res
        .type('application/vnd.openxmlformats-officedocument.spreadsheetml.sheet')
        .attachment('plantilla-tendencias.xlsx')
        .send(await generarPlantilla());
    });

    router.post('/importar', soloGestor, recibirArchivo('archivo'), async (req, res) => {
      if (!req.file) throw new ErrorApi(400, 'Adjunta el archivo Excel en el campo "archivo"');
      const zip = [0x50, 0x4b, 0x03, 0x04];
      if (!zip.every((b, i) => req.file!.buffer[i] === b)) throw new ErrorApi(415, 'El archivo debe ser un Excel (.xlsx)');
      const resultado = await conRol(req.sesion, (c) => importarExcel(c, req.file!.buffer));
      res.status(201).json(resultado);
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
