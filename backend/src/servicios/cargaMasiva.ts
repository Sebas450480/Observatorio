import ExcelJS from 'exceljs';
import type { Router } from 'express';
import type { z } from 'zod';
import type { RolBD, Sesion } from '../auth/roles.js';
import { conRol, type Cliente } from '../db/contexto.js';
import { ErrorApi } from '../errores.js';
import { requiereRol } from '../middlewares/sesion.js';
import { recibirArchivo } from './archivos.js';
import { normalizarNombre } from '../utilidades/esquemas.js';

/**
 * Carga masiva desde Excel, común a todos los módulos de contenido:
 *
 *   GET  /plantilla             plantilla con instrucciones y listas desplegables
 *   POST /importar?validar=1    revisa el archivo y devuelve la vista previa (no guarda)
 *   POST /importar              guarda todo o nada (si una fila tiene errores, no se guarda ninguna)
 *
 * Cada módulo describe sus columnas, cómo arma los datos de una fila y cómo se guardan;
 * la validación de cada fila usa el mismo esquema de los formularios.
 */
export const MAXIMO_FILAS = 50;

/** Opciones de modalidad: en el Excel se escribe con tilde. */
export const OPCIONES_MODALIDAD: Opcion[] = [
  { texto: 'Presencial' }, { texto: 'Virtual' }, { texto: 'Híbrido', valor: 'Hibrido' },
];

/** Fecha y hora de Bogotá en formato ISO a partir de las columnas de fecha y hora. */
export const fechaHoraBogota = (fecha: unknown, hora: unknown) =>
  typeof fecha === 'string' ? `${fecha}T${typeof hora === 'string' ? hora : '00:00'}:00-05:00` : undefined;

/** Gratuito / costo: si es gratuito no lleva costo. */
export const gratuitoYCosto = (fila: Record<string, unknown>) => ({
  es_gratuito: fila.es_gratuito === true,
  costo: fila.es_gratuito === true ? null : (fila.costo as number | undefined) ?? null,
});

export type TipoColumna = 'texto' | 'fecha' | 'hora' | 'numero' | 'entero' | 'sino' | 'lista' | 'categorias' | 'enlace';

export interface Opcion {
  /** Lo que se escribe en el Excel. */
  texto: string;
  /** Lo que se guarda (si es distinto). */
  valor?: string;
}

export interface ColumnaCarga {
  /** Nombre del dato en la fila leída. */
  clave: string;
  /** Encabezado de la columna en la plantilla. */
  titulo: string;
  tipo?: TipoColumna;
  obligatoria?: boolean;
  /** Valores permitidos (columnas de tipo lista). */
  opciones?: readonly (string | Opcion)[];
  /** Qué escribir, para la hoja de instrucciones. */
  ayuda: string;
  ejemplo?: string;
  /** Campos del esquema que reportan sus errores en esta columna. */
  campos?: string[];
  ancho?: number;
}

export interface ErrorCarga {
  fila: number;
  columna?: string;
  mensaje: string;
}

export interface FilaValida<T> {
  fila: number;
  datos: T;
}

export interface DefinicionCarga<T = Record<string, unknown>> {
  /** Nombre del archivo de la plantilla, sin extensión. */
  archivo: string;
  /** Nombre de la hoja donde se escriben los registros. */
  hoja: string;
  columnas: ColumnaCarga[];
  /** Instrucciones propias del módulo (se suman a las generales). */
  instrucciones?: string[];
  /** Convierte los valores leídos de la fila en los datos del esquema. */
  armar: (fila: Record<string, unknown>) => Record<string, unknown>;
  esquema: z.ZodType<T>;
  /** Texto corto que identifica el registro en la vista previa. */
  resumen: (datos: T) => string;
  /** Clave para detectar registros repetidos dentro del archivo. */
  clave?: (datos: T) => string | null;
  mensajeRepetido?: string;
  /** Revisiones contra la base de datos (p. ej. registros que ya existen). */
  revisar?: (cliente: Cliente, filas: FilaValida<T>[]) => Promise<ErrorCarga[]>;
  /** Guarda todas las filas dentro de la transacción. */
  guardar: (cliente: Cliente, filas: FilaValida<T>[], sesion: Sesion) => Promise<Record<string, unknown> | void>;
  /** Trabajo después de guardar (fuera de la transacción), p. ej. enviar correos. */
  despues?: (resultado: Record<string, unknown> | void) => Promise<Record<string, unknown> | void>;
}

/** Carga masiva de un módulo de crearRecurso (el guardado por defecto es el mismo del formulario). */
export type CargaRecurso<T> = Omit<DefinicionCarga<T>, 'guardar'> & Partial<Pick<DefinicionCarga<T>, 'guardar'>>;

/** Ayuda a TypeScript a inferir el tipo de los datos a partir del esquema. */
export const cargaRecurso = <T>(def: CargaRecurso<T>): CargaRecurso<T> => def;

// ------------------------------------------------------------------------------------- Plantilla
const AZUL = 'FF1F3A68';
const ROJO = 'FFC8102E';

const textoOpcion = (o: string | Opcion) => (typeof o === 'string' ? o : o.texto);
const valorOpcion = (o: string | Opcion) => (typeof o === 'string' ? o : (o.valor ?? o.texto));

const letraColumna = (n: number) => {
  let s = '';
  for (let i = n; i > 0; i = Math.floor((i - 1) / 26)) s = String.fromCharCode(65 + ((i - 1) % 26)) + s;
  return s;
};

const encabezado = (c: ColumnaCarga) => (c.obligatoria ? `${c.titulo} *` : c.titulo);

const AYUDA_TIPO: Partial<Record<TipoColumna, string>> = {
  fecha: 'Fecha exacta DD/MM/AAAA.',
  hora: 'Hora HH:MM (24 horas).',
  sino: 'Sí o No.',
  categorias: 'Nombres de categorías existentes separados por coma (ver hoja "Listas").',
  enlace: 'Enlace completo que empiece por https://',
  numero: 'Solo números, sin puntos de miles.',
  entero: 'Número entero.',
};

export async function generarPlantilla(def: DefinicionCarga<unknown>, categorias: string[]): Promise<Buffer> {
  const libro = new ExcelJS.Workbook();
  libro.creator = 'Observatorio Empresarial - Uniempresarial';
  libro.created = new Date();

  const hoja = libro.addWorksheet(def.hoja.slice(0, 31), { views: [{ state: 'frozen', ySplit: 1 }] });
  const ayuda = libro.addWorksheet('Instrucciones');
  const listas = libro.addWorksheet('Listas');

  hoja.columns = def.columnas.map((c) => ({ header: encabezado(c), key: c.clave, width: c.ancho ?? Math.max(16, c.titulo.length + 6) }));
  const cabecera = hoja.getRow(1);
  cabecera.height = 30;
  def.columnas.forEach((c, i) => {
    const celda = cabecera.getCell(i + 1);
    celda.font = { bold: true, color: { argb: 'FFFFFFFF' } };
    celda.fill = { type: 'pattern', pattern: 'solid', fgColor: { argb: c.obligatoria ? ROJO : AZUL } };
    celda.alignment = { vertical: 'middle', horizontal: 'center', wrapText: true };
    celda.note = [c.ayuda, AYUDA_TIPO[c.tipo ?? 'texto'], c.ejemplo ? `Ejemplo: ${c.ejemplo}` : ''].filter(Boolean).join('\n');
  });

  // Hoja de listas: opciones de cada columna desplegable y las categorías existentes.
  const columnasLista: { col: ColumnaCarga; rango: string }[] = [];
  let numeroLista = 0;
  const agregarLista = (titulo: string, valores: string[]) => {
    numeroLista++;
    const letra = letraColumna(numeroLista);
    listas.getCell(`${letra}1`).value = titulo;
    listas.getCell(`${letra}1`).font = { bold: true };
    listas.getColumn(numeroLista).width = Math.max(18, titulo.length + 4, ...valores.map((v) => Math.min(v.length + 2, 50)));
    valores.forEach((v, i) => { listas.getCell(`${letra}${i + 2}`).value = v; });
    return `Listas!$${letra}$2:$${letra}$${Math.max(2, valores.length + 1)}`;
  };
  for (const col of def.columnas) {
    if (col.tipo === 'lista' && col.opciones) columnasLista.push({ col, rango: agregarLista(col.titulo, col.opciones.map(textoOpcion)) });
    if (col.tipo === 'sino') columnasLista.push({ col, rango: agregarLista(col.titulo, ['Sí', 'No']) });
  }
  if (def.columnas.some((c) => c.tipo === 'categorias')) agregarLista('Categorías existentes', categorias);

  // Validaciones de las filas de datos (máximo 50 registros).
  def.columnas.forEach((col, i) => {
    const letra = letraColumna(i + 1);
    const lista = columnasLista.find((l) => l.col === col);
    for (let fila = 2; fila <= MAXIMO_FILAS + 1; fila++) {
      const celda = hoja.getCell(`${letra}${fila}`);
      if (lista) {
        celda.dataValidation = {
          type: 'list', allowBlank: !col.obligatoria, formulae: [lista.rango], showErrorMessage: true,
          errorTitle: col.titulo, error: 'Elige un valor de la lista',
        };
      } else if (col.tipo === 'fecha') {
        celda.numFmt = 'dd/mm/yyyy';
      } else if (col.tipo === 'hora') {
        celda.numFmt = 'hh:mm';
      } else if (col.tipo === 'texto' || col.tipo === 'enlace' || col.tipo === 'categorias' || !col.tipo) {
        celda.numFmt = '@';
      }
    }
  });

  // Instrucciones.
  ayuda.columns = [
    { header: 'Columna', key: 'columna', width: 34 },
    { header: 'Obligatoria', key: 'obligatoria', width: 12 },
    { header: 'Qué escribir', key: 'que', width: 70 },
    { header: 'Ejemplo', key: 'ejemplo', width: 40 },
  ];
  ayuda.getRow(1).font = { bold: true, color: { argb: 'FFFFFFFF' } };
  ayuda.getRow(1).fill = { type: 'pattern', pattern: 'solid', fgColor: { argb: AZUL } };
  for (const c of def.columnas) {
    const opciones = c.tipo === 'lista' && c.opciones ? ` Opciones: ${c.opciones.map(textoOpcion).join(', ')}.` : '';
    ayuda.addRow({
      columna: c.titulo,
      obligatoria: c.obligatoria ? 'Sí' : 'No',
      que: `${c.ayuda}${opciones} ${AYUDA_TIPO[c.tipo ?? 'texto'] ?? ''}`.trim(),
      ejemplo: c.ejemplo ?? '',
    });
  }
  ayuda.addRow({});
  const generales = [
    `Escribe un registro por fila en la hoja "${def.hoja}", desde la fila 2. Máximo ${MAXIMO_FILAS} registros por archivo.`,
    'Las columnas en rojo y con * son obligatorias. No cambies los encabezados.',
    'Antes de guardar, la plataforma revisa el archivo y te muestra los errores por fila y columna.',
    'Si alguna fila tiene errores, no se guarda ninguna: corrige el archivo y vuelve a subirlo.',
    'Las imágenes no se cargan por Excel: agrégalas después desde el formulario de edición.',
    ...(def.instrucciones ?? []),
  ];
  for (const texto of generales) {
    const fila = ayuda.addRow({ columna: texto });
    ayuda.mergeCells(`A${fila.number}:D${fila.number}`);
    fila.getCell(1).alignment = { wrapText: true };
  }
  ayuda.getColumn(3).alignment = { wrapText: true, vertical: 'top' };

  return Buffer.from(await libro.xlsx.writeBuffer());
}

// ------------------------------------------------------------------------------------- Lectura
function celdaATexto(valor: ExcelJS.CellValue): string {
  if (valor === null || valor === undefined) return '';
  if (valor instanceof Date) return valor.toISOString();
  if (typeof valor === 'object') {
    if ('richText' in valor) return valor.richText.map((p) => p.text).join('');
    if ('hyperlink' in valor) return String(valor.hyperlink ?? valor.text ?? '');
    if ('text' in valor) return String(valor.text);
    if ('result' in valor) return valor.result === undefined || valor.result === null ? '' : celdaATexto(valor.result as ExcelJS.CellValue);
    if ('error' in valor) return '';
  }
  return String(valor);
}

/** Valor "crudo" de la celda (las fórmulas se reemplazan por su resultado). */
function celdaCruda(valor: ExcelJS.CellValue): unknown {
  if (valor && typeof valor === 'object' && !(valor instanceof Date) && 'result' in valor) return valor.result;
  return valor;
}

const dos = (n: number) => String(n).padStart(2, '0');

function interpretarFecha(valor: unknown): string | null {
  if (valor instanceof Date) return `${valor.getUTCFullYear()}-${dos(valor.getUTCMonth() + 1)}-${dos(valor.getUTCDate())}`;
  if (typeof valor === 'number' && valor > 20000 && valor < 80000) {
    const d = new Date(Math.round((valor - 25569) * 86400000));
    return `${d.getUTCFullYear()}-${dos(d.getUTCMonth() + 1)}-${dos(d.getUTCDate())}`;
  }
  const texto = celdaATexto(valor as ExcelJS.CellValue).trim();
  let m = /^(\d{4})-(\d{1,2})-(\d{1,2})(T.*)?$/.exec(texto);
  let partes: [number, number, number] | null = m ? [Number(m[1]), Number(m[2]), Number(m[3])] : null;
  m = /^(\d{1,2})[/.-](\d{1,2})[/.-](\d{4})$/.exec(texto);
  if (m) partes = [Number(m[3]), Number(m[2]), Number(m[1])];
  if (!partes) return null;
  const [a, mes, dia] = partes;
  const fecha = new Date(Date.UTC(a, mes - 1, dia));
  if (fecha.getUTCFullYear() !== a || fecha.getUTCMonth() !== mes - 1 || fecha.getUTCDate() !== dia) return null;
  return `${a}-${dos(mes)}-${dos(dia)}`;
}

function interpretarHora(valor: unknown): string | null {
  if (valor instanceof Date) return `${dos(valor.getUTCHours())}:${dos(valor.getUTCMinutes())}`;
  if (typeof valor === 'number' && valor >= 0 && valor < 1) {
    const minutos = Math.round(valor * 24 * 60);
    return `${dos(Math.floor(minutos / 60) % 24)}:${dos(minutos % 60)}`;
  }
  const texto = celdaATexto(valor as ExcelJS.CellValue).trim().toLowerCase().replace(/\s+/g, ' ');
  const m = /^(\d{1,2})(?::(\d{2}))?(?::\d{2})?\s*(a\.?\s?m\.?|p\.?\s?m\.?)?$/.exec(texto);
  if (!m) return null;
  let horas = Number(m[1]);
  const minutos = Number(m[2] ?? 0);
  const sufijo = m[3]?.replace(/[.\s]/g, '');
  if (sufijo === 'pm' && horas < 12) horas += 12;
  if (sufijo === 'am' && horas === 12) horas = 0;
  if (horas > 23 || minutos > 59) return null;
  return `${dos(horas)}:${dos(minutos)}`;
}

function interpretarNumero(valor: unknown): number | null {
  if (typeof valor === 'number') return valor;
  let texto = celdaATexto(valor as ExcelJS.CellValue).replace(/[$\s]/g, '').replace(/cop$/i, '');
  if (/^\d{1,3}(\.\d{3})+(,\d+)?$/.test(texto)) texto = texto.replace(/\./g, '').replace(',', '.');
  else if (/^\d{1,3}(,\d{3})+(\.\d+)?$/.test(texto)) texto = texto.replace(/,/g, '');
  else texto = texto.replace(',', '.');
  if (!/^-?\d+(\.\d+)?$/.test(texto)) return null;
  return Number(texto);
}

function interpretarSiNo(texto: string): boolean | null {
  const t = normalizarNombre(texto);
  if (['si', 's', 'x', 'true', 'verdadero', '1'].includes(t)) return true;
  if (['no', 'n', 'false', 'falso', '0'].includes(t)) return false;
  return null;
}

interface ArchivoLeido {
  /** Valores leídos por fila (número de fila del Excel -> clave -> valor). */
  filas: { fila: number; valores: Record<string, unknown> }[];
  errores: ErrorCarga[];
}

async function leerArchivo(def: DefinicionCarga<unknown>, archivo: Buffer, categorias: Map<string, number>): Promise<ArchivoLeido> {
  const libro = new ExcelJS.Workbook();
  try {
    await libro.xlsx.load(archivo as unknown as ArrayBuffer);
  } catch {
    throw new ErrorApi(400, 'El archivo no es un Excel (.xlsx) válido');
  }
  const hoja = libro.getWorksheet(def.hoja.slice(0, 31)) ?? libro.worksheets[0];
  if (!hoja) throw new ErrorApi(400, 'El archivo no tiene hojas');

  // Las columnas se reconocen por su encabezado (sin importar el orden, el * ni las tildes).
  const limpio = (t: string) => normalizarNombre(t.replace(/\*/g, ''));
  const posicion = new Map<string, number>();
  hoja.getRow(1).eachCell((celda, numero) => {
    const titulo = limpio(celdaATexto(celda.value));
    const col = def.columnas.find((c) => limpio(c.titulo) === titulo);
    if (col && !posicion.has(col.clave)) posicion.set(col.clave, numero);
  });
  const faltantes = def.columnas.filter((c) => c.obligatoria && !posicion.has(c.clave));
  if (!posicion.size || faltantes.length) {
    throw new ErrorApi(422, 'El archivo no tiene la estructura de la plantilla. Descarga la plantilla y úsala sin cambiar los encabezados.', {
      columnas_faltantes: (posicion.size ? faltantes : def.columnas.filter((c) => c.obligatoria)).map((c) => c.titulo),
    });
  }

  const filas: ArchivoLeido['filas'] = [];
  const errores: ErrorCarga[] = [];
  for (let numero = 2; numero <= hoja.rowCount; numero++) {
    const fila = hoja.getRow(numero);
    const crudos = new Map(def.columnas.map((c) => {
      const pos = posicion.get(c.clave);
      return [c.clave, pos ? celdaCruda(fila.getCell(pos).value) : null] as const;
    }));
    const textos = new Map([...crudos].map(([k, v]) => [k, celdaATexto(v as ExcelJS.CellValue).trim()]));
    if ([...textos.values()].every((t) => t === '')) continue;
    if (filas.length >= MAXIMO_FILAS) {
      throw new ErrorApi(422, `El archivo tiene más de ${MAXIMO_FILAS} registros. Divídelo en varios archivos de máximo ${MAXIMO_FILAS}.`);
    }

    const valores: Record<string, unknown> = {};
    const error = (col: ColumnaCarga, mensaje: string) => errores.push({ fila: numero, columna: col.titulo, mensaje });
    for (const col of def.columnas) {
      const texto = textos.get(col.clave) ?? '';
      const crudo = crudos.get(col.clave);
      if (texto === '') {
        if (col.obligatoria) error(col, 'Es obligatorio');
        continue;
      }
      switch (col.tipo ?? 'texto') {
        case 'fecha': {
          const f = interpretarFecha(crudo);
          if (f) valores[col.clave] = f;
          else error(col, 'Fecha inválida. Escribe la fecha exacta como DD/MM/AAAA');
          break;
        }
        case 'hora': {
          const h = interpretarHora(crudo);
          if (h) valores[col.clave] = h;
          else error(col, 'Hora inválida. Escríbela como HH:MM, p. ej. 08:30 o 14:00');
          break;
        }
        case 'numero':
        case 'entero': {
          const n = interpretarNumero(crudo);
          if (n === null || (col.tipo === 'entero' && !Number.isInteger(n))) error(col, col.tipo === 'entero' ? 'Debe ser un número entero' : 'Debe ser un número');
          else valores[col.clave] = n;
          break;
        }
        case 'sino': {
          const b = interpretarSiNo(texto);
          if (b === null) error(col, 'Escribe Sí o No');
          else valores[col.clave] = b;
          break;
        }
        case 'lista': {
          const opcion = col.opciones?.find((o) => normalizarNombre(textoOpcion(o)) === normalizarNombre(texto)
            || normalizarNombre(valorOpcion(o)) === normalizarNombre(texto));
          if (opcion) valores[col.clave] = valorOpcion(opcion);
          else error(col, `Valor no permitido. Usa: ${(col.opciones ?? []).map(textoOpcion).join(', ')}`);
          break;
        }
        case 'categorias': {
          const nombres = texto.split(/[,;\n]/).map((s) => s.trim()).filter(Boolean);
          const desconocidas = nombres.filter((n) => !categorias.has(normalizarNombre(n)));
          if (desconocidas.length) error(col, `Categorías que no existen: ${desconocidas.join(', ')}. Usa las de la hoja "Listas".`);
          else valores[col.clave] = [...new Set(nombres.map((n) => categorias.get(normalizarNombre(n))!))];
          break;
        }
        default:
          valores[col.clave] = texto;
      }
    }
    filas.push({ fila: numero, valores });
  }
  return { filas, errores };
}

// ------------------------------------------------------------------------------------- Proceso
export interface ResultadoRevision<T> {
  validas: FilaValida<T>[];
  errores: ErrorCarga[];
  total: number;
}

async function revisarArchivo<T>(def: DefinicionCarga<T>, cliente: Cliente, archivo: Buffer): Promise<ResultadoRevision<T>> {
  const cats = await cliente.query<{ id_categoria: number; nombre_categoria: string }>('select id_categoria, nombre_categoria from categoria');
  const categorias = new Map(cats.rows.map((c) => [normalizarNombre(c.nombre_categoria), c.id_categoria]));
  const leido = await leerArchivo(def as DefinicionCarga<unknown>, archivo, categorias);
  if (!leido.filas.length) throw new ErrorApi(422, 'El archivo no tiene registros. Escribe los datos desde la fila 2.');

  const errores = [...leido.errores];
  const conErrorDeLectura = new Set(leido.errores.map((e) => e.fila));
  const columnaDeCampo = (campo: string) =>
    def.columnas.find((c) => c.campos?.includes(campo) || c.clave === campo)?.titulo;

  const validas: FilaValida<T>[] = [];
  const vistas = new Map<string, number>();
  for (const { fila, valores } of leido.filas) {
    if (conErrorDeLectura.has(fila)) continue;
    const resultado = def.esquema.safeParse(def.armar(valores));
    if (!resultado.success) {
      for (const issue of resultado.error.issues) {
        const campo = String(issue.path[0] ?? '');
        errores.push({ fila, columna: columnaDeCampo(campo), mensaje: issue.message });
      }
      continue;
    }
    const clave = def.clave?.(resultado.data);
    if (clave) {
      const anterior = vistas.get(clave);
      if (anterior) {
        errores.push({ fila, mensaje: `${def.mensajeRepetido ?? 'Registro repetido'} (igual a la fila ${anterior})` });
        continue;
      }
      vistas.set(clave, fila);
    }
    validas.push({ fila, datos: resultado.data });
  }
  if (def.revisar && validas.length) errores.push(...(await def.revisar(cliente, validas)));
  errores.sort((a, b) => a.fila - b.fila);
  return { validas, errores, total: leido.filas.length };
}

const ZIP = [0x50, 0x4b, 0x03, 0x04];

/** Registra las rutas de plantilla e importación en el router del módulo. */
export function rutasCargaMasiva<T>(router: Router, def: DefinicionCarga<T>, rolGestor: RolBD) {
  const soloGestor = requiereRol(rolGestor);

  router.get('/plantilla', soloGestor, async (req, res) => {
    const categorias = def.columnas.some((c) => c.tipo === 'categorias')
      ? (await conRol(req.sesion, (c) => c.query<{ nombre_categoria: string }>('select nombre_categoria from categoria order by nombre_categoria')))
        .rows.map((r) => r.nombre_categoria)
      : [];
    res
      .type('application/vnd.openxmlformats-officedocument.spreadsheetml.sheet')
      .attachment(`${def.archivo}.xlsx`)
      .send(await generarPlantilla(def as DefinicionCarga<unknown>, categorias));
  });

  router.post('/importar', soloGestor, recibirArchivo('archivo'), async (req, res) => {
    if (!req.file) throw new ErrorApi(400, 'Adjunta el archivo Excel en el campo "archivo"');
    if (!ZIP.every((b, i) => req.file!.buffer[i] === b)) throw new ErrorApi(415, 'El archivo debe ser un Excel (.xlsx)');
    const soloValidar = req.query.validar === '1' || req.query.validar === 'true';

    const resultado = await conRol(req.sesion, async (c) => {
      const revision = await revisarArchivo(def, c, req.file!.buffer);
      if (soloValidar) return { revision };
      if (revision.errores.length) {
        throw new ErrorApi(422, 'El archivo tiene errores. No se guardó ningún registro.', { errores: revision.errores });
      }
      return { revision, guardado: await def.guardar(c, revision.validas, req.sesion) };
    });

    if (soloValidar) {
      const { revision } = resultado;
      res.json({
        total: revision.total,
        validos: revision.total - new Set(revision.errores.map((e) => e.fila)).size,
        errores: revision.errores,
        registros: revision.validas.map((v) => ({ fila: v.fila, resumen: def.resumen(v.datos) })),
      });
      return;
    }
    const extra = (await def.despues?.(resultado.guardado)) ?? resultado.guardado ?? {};
    res.status(201).json({ importados: resultado.revision.validas.length, ...extra });
  });
}
