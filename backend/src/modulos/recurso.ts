import { Router, type Request, type Response } from 'express';
import { z } from 'zod';
import type { RolBD, Sesion } from '../auth/roles.js';
import { conRol, type Cliente } from '../db/contexto.js';
import { ErrorApi, noEncontrado } from '../errores.js';
import { requiereRol } from '../middlewares/sesion.js';
import { borrarImagen, guardarImagen, recibirArchivo } from '../servicios/archivos.js';
import { generarExcel, generarPdf, type ColumnaExportar } from '../servicios/exportar.js';
import { Filtros, columnasYValores, construirPagina, esquemaPaginacion } from '../utilidades/consulta.js';
import { ESTADOS, idPositivo, listaIdsConsulta } from '../utilidades/esquemas.js';

/**
 * Fábrica de rutas CRUD para los módulos de contenido (Flash, Faro, Empresas,
 * Tendencias y Calendario). Cada módulo describe su tabla, sus campos y sus filtros,
 * y esta función crea las rutas:
 *
 *   GET    /                    listado con filtros y paginación
 *   GET    /exportar            listado en Excel (?formato=xlsx) o PDF (?formato=pdf)
 *   GET    /:id                 detalle
 *   POST   /                    crear              (gestor del módulo o SuperAdmin)
 *   PATCH  /:id                 editar             (gestor del módulo o SuperAdmin)
 *   DELETE /:id                 eliminar           (gestor del módulo o SuperAdmin)
 *   POST   /:id/imagen/:campo   subir imagen       (gestor del módulo o SuperAdmin)
 *   DELETE /:id/imagen/:campo   quitar imagen      (gestor del módulo o SuperAdmin)
 *
 * Los permisos los aplica también la base de datos (roles y políticas de la Fase 1).
 */
export interface OpcionesRecurso {
  /** Nombre corto: carpeta de imágenes y nombre del archivo exportado. */
  nombre: string;
  /** Título de los reportes exportados. */
  titulo: string;
  tabla: string;
  id: string;
  /** Rol de PostgreSQL del gestor de este módulo. */
  rolGestor: RolBD;
  /** Columna de estado (Activo/Inactivo), si el módulo la tiene. */
  columnaEstado?: string;
  /** Campos que se pueden enviar al crear (al editar todos son opcionales). */
  esquema: z.ZodObject;
  /** Campos del esquema que no son columnas de la tabla (se guardan aparte). */
  camposEspeciales?: string[];
  /** Tabla puente con `categoria` (columnas: <id>, id_categoria). */
  tablaCategorias?: string;
  /** Expresiones SQL adicionales para el SELECT, p. ej. "(select ...) as contactos". */
  selectExtra?: string[];
  /** Filtros propios del módulo (se suman a pagina, limite, orden, estado y categoria). */
  esquemaFiltros: z.ZodObject;
  aplicarFiltros: (filtros: Filtros, valores: Record<string, unknown>) => void;
  /** Ordenamientos permitidos: nombre -> expresión SQL. */
  ordenes: Record<string, string>;
  ordenDefecto: string;
  direccionDefecto?: 'asc' | 'desc';
  /** Columnas que guardan rutas de imágenes. */
  camposImagen?: string[];
  columnasExportar: ColumnaExportar[];
  /** Guarda los campos especiales (p. ej. las fuentes de una tendencia). */
  guardarEspeciales?: (cliente: Cliente, id: number, datos: Record<string, unknown>) => Promise<void>;
  /** Rutas adicionales; se registran antes de las rutas con /:id. */
  rutasExtra?: (router: Router) => void;
}

const LIMITE_EXPORTAR = 5000;

export function crearRecurso(op: OpcionesRecurso): Router {
  const router = Router();
  const especiales = new Set(['categorias', ...(op.camposEspeciales ?? [])]);
  const camposImagen = op.camposImagen ?? [];
  const puedeGestionar = (sesion: Sesion) => sesion.rol === op.rolGestor || sesion.rol === 'obs_superadmin';
  const soloGestor = requiereRol(op.rolGestor);

  const nombresOrden = Object.keys(op.ordenes) as [string, ...string[]];
  const esquemaListado = esquemaPaginacion
    .extend({
      orden: z.enum(nombresOrden).optional(),
      direccion: z.enum(['asc', 'desc']).optional(),
      estado: z.enum(ESTADOS).optional(),
      categoria: listaIdsConsulta.optional(),
    })
    .extend(op.esquemaFiltros.shape);

  const columnasSelect = [
    't.*',
    ...(op.tablaCategorias
      ? [`coalesce((select json_agg(json_build_object('id_categoria', c.id_categoria, 'nombre', c.nombre_categoria)
                                    order by c.nombre_categoria)
                      from ${op.tablaCategorias} p join categoria c on c.id_categoria = p.id_categoria
                     where p.${op.id} = t.${op.id}), '[]'::json) as categorias`]
      : []),
    ...(op.selectExtra ?? []),
  ].join(',\n       ');

  /** Quita los datos internos que solo ven el gestor del módulo y el SuperAdmin. */
  const limpiar = (fila: Record<string, unknown>, sesion: Sesion) => {
    if (!puedeGestionar(sesion)) {
      if (op.columnaEstado) delete fila[op.columnaEstado];
      delete fila.creado_por;
    }
    return fila;
  };

  const construirFiltros = (valores: Record<string, unknown>, sesion: Sesion) => {
    const filtros = new Filtros();
    if (op.columnaEstado && valores.estado && puedeGestionar(sesion)) {
      filtros.y(`t.${op.columnaEstado} = ${filtros.param(valores.estado)}`);
    }
    if (op.tablaCategorias && Array.isArray(valores.categoria) && valores.categoria.length) {
      filtros.y(`exists (select 1 from ${op.tablaCategorias} p
                          where p.${op.id} = t.${op.id} and p.id_categoria = any(${filtros.param(valores.categoria)}::int[]))`);
    }
    op.aplicarFiltros(filtros, valores);
    return filtros;
  };

  const ordenSql = (valores: Record<string, unknown>) => {
    const expresion = op.ordenes[(valores.orden as string | undefined) ?? op.ordenDefecto] ?? op.ordenes[op.ordenDefecto];
    const direccion = (valores.direccion as string | undefined) ?? op.direccionDefecto ?? 'asc';
    return `order by ${expresion} ${direccion}, t.${op.id} ${direccion}`;
  };

  async function obtener(cliente: Cliente, id: number): Promise<Record<string, unknown> | undefined> {
    const { rows } = await cliente.query(`select ${columnasSelect} from ${op.tabla} t where t.${op.id} = $1`, [id]);
    return rows[0];
  }

  async function guardarCategorias(cliente: Cliente, id: number, categorias: unknown) {
    if (!op.tablaCategorias || !Array.isArray(categorias)) return;
    await cliente.query(`delete from ${op.tablaCategorias} where ${op.id} = $1`, [id]);
    if (categorias.length) {
      await cliente.query(
        `insert into ${op.tablaCategorias} (${op.id}, id_categoria)
         select $1, unnest($2::int[]) on conflict do nothing`,
        [id, [...new Set(categorias as number[])]],
      );
    }
  }

  const separar = (datos: Record<string, unknown>) => {
    const columnas: Record<string, unknown> = {};
    for (const [clave, valor] of Object.entries(datos)) if (!especiales.has(clave)) columnas[clave] = valor;
    return columnas;
  };

  op.rutasExtra?.(router);

  // ---------------------------------------------------------------- Listado
  router.get('/', async (req: Request, res: Response) => {
    const valores = esquemaListado.parse(req.query) as Record<string, unknown> & { pagina: number; limite: number };
    const filtros = construirFiltros(valores, req.sesion);
    const resultado = await conRol(req.sesion, async (c) => {
      const total = await c.query<{ total: number }>(
        `select count(*)::int as total from ${op.tabla} t ${filtros.where()}`,
        filtros.valores,
      );
      const desplazamiento = (valores.pagina - 1) * valores.limite;
      const filas = await c.query(
        `select ${columnasSelect} from ${op.tabla} t ${filtros.where()} ${ordenSql(valores)}
         limit ${filtros.param(valores.limite)} offset ${filtros.param(desplazamiento)}`,
        filtros.valores,
      );
      return { total: total.rows[0]?.total ?? 0, filas: filas.rows };
    });
    res.json(
      construirPagina(resultado.filas.map((f) => limpiar(f, req.sesion)), resultado.total, valores.pagina, valores.limite),
    );
  });

  // ---------------------------------------------------------------- Exportar
  router.get('/exportar', async (req, res) => {
    const formato = z.enum(['xlsx', 'pdf']).default('xlsx').parse(req.query.formato);
    const valores = esquemaListado.parse({ ...req.query, pagina: 1, limite: 1 }) as Record<string, unknown>;
    const filtros = construirFiltros(valores, req.sesion);
    const filas = await conRol(req.sesion, async (c) => {
      const { rows } = await c.query(
        `select ${columnasSelect} from ${op.tabla} t ${filtros.where()} ${ordenSql(valores)} limit ${LIMITE_EXPORTAR}`,
        filtros.valores,
      );
      return rows.map((f) => limpiar(f, req.sesion));
    });
    const columnas = op.columnasExportar.filter((c) => puedeGestionar(req.sesion) || c.campo !== op.columnaEstado);
    const nombreArchivo = `${op.nombre}-${new Date().toISOString().slice(0, 10)}.${formato}`;
    const contenido = formato === 'pdf'
      ? await generarPdf(op.titulo, columnas, filas)
      : await generarExcel(op.titulo, columnas, filas);
    res
      .type(formato === 'pdf' ? 'application/pdf' : 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet')
      .attachment(nombreArchivo)
      .send(contenido);
  });

  // ---------------------------------------------------------------- Detalle
  router.get('/:id', async (req, res) => {
    const id = idPositivo.parse(req.params.id);
    const fila = await conRol(req.sesion, (c) => obtener(c, id));
    if (!fila) throw noEncontrado();
    res.json(limpiar(fila, req.sesion));
  });

  // ---------------------------------------------------------------- Crear
  router.post('/', soloGestor, async (req, res) => {
    const datos = op.esquema.parse(req.body) as Record<string, unknown>;
    const fila = await conRol(req.sesion, async (c) => {
      const { columnas, valores } = columnasYValores(separar(datos));
      if (!columnas.length) throw new ErrorApi(400, 'No se enviaron datos');
      const { rows } = await c.query<Record<string, number>>(
        `insert into ${op.tabla} (${columnas.join(', ')})
         values (${columnas.map((_, i) => `$${i + 1}`).join(', ')}) returning ${op.id}`,
        valores,
      );
      const id = rows[0]![op.id]!;
      await guardarCategorias(c, id, datos.categorias);
      await op.guardarEspeciales?.(c, id, datos);
      return obtener(c, id);
    });
    res.status(201).json(fila);
  });

  // ---------------------------------------------------------------- Editar
  router.patch('/:id', soloGestor, async (req, res) => {
    const id = idPositivo.parse(req.params.id);
    const datos = op.esquema.partial().parse(req.body) as Record<string, unknown>;
    const { columnas, valores } = columnasYValores(separar(datos));
    const hayEspeciales = Object.keys(datos).some((k) => especiales.has(k) && datos[k] !== undefined);
    if (!columnas.length && !hayEspeciales) throw new ErrorApi(400, 'No se enviaron cambios');

    const fila = await conRol(req.sesion, async (c) => {
      if (columnas.length) {
        const { rowCount } = await c.query(
          `update ${op.tabla} set ${columnas.map((col, i) => `${col} = $${i + 1}`).join(', ')}
           where ${op.id} = $${columnas.length + 1}`,
          [...valores, id],
        );
        if (!rowCount) throw noEncontrado();
      } else if (!(await obtener(c, id))) {
        throw noEncontrado();
      } else {
        // Solo cambian categorías o campos especiales: se actualiza la fecha de modificación.
        await c.query(`update ${op.tabla} set fecha_actualizacion = now() where ${op.id} = $1`, [id]);
      }
      await guardarCategorias(c, id, datos.categorias);
      await op.guardarEspeciales?.(c, id, datos);
      return obtener(c, id);
    });
    res.json(fila);
  });

  // ---------------------------------------------------------------- Eliminar
  router.delete('/:id', soloGestor, async (req, res) => {
    const id = idPositivo.parse(req.params.id);
    const imagenes = await conRol(req.sesion, async (c) => {
      const { rows } = await c.query<Record<string, string | null>>(
        `delete from ${op.tabla} where ${op.id} = $1 returning ${['1 as borrado', ...camposImagen].join(', ')}`,
        [id],
      );
      if (!rows[0]) throw noEncontrado();
      return camposImagen.map((campo) => rows[0]![campo]);
    });
    await Promise.all(imagenes.map((ruta) => borrarImagen(ruta)));
    res.status(204).end();
  });

  // ---------------------------------------------------------------- Imágenes
  if (camposImagen.length) {
    const campoValido = (campo: string | undefined) => {
      if (!campo || !camposImagen.includes(campo)) {
        throw new ErrorApi(400, `Campo de imagen inválido. Usa: ${camposImagen.join(', ')}`);
      }
      return campo;
    };

    router.post('/:id/imagen/:campo', soloGestor, recibirArchivo('imagen'), async (req, res) => {
      const id = idPositivo.parse(req.params.id);
      const campo = campoValido(req.params.campo as string);
      const nueva = await guardarImagen(req.file, op.nombre);
      try {
        const anterior = await conRol(req.sesion, async (c) => {
          const actual = await c.query<Record<string, string | null>>(
            `select ${campo} from ${op.tabla} where ${op.id} = $1 for update`,
            [id],
          );
          if (!actual.rows[0]) throw noEncontrado();
          await c.query(`update ${op.tabla} set ${campo} = $1 where ${op.id} = $2`, [nueva, id]);
          return actual.rows[0][campo];
        });
        await borrarImagen(anterior);
      } catch (error) {
        await borrarImagen(nueva);
        throw error;
      }
      res.status(201).json({ [campo]: nueva });
    });

    router.delete('/:id/imagen/:campo', soloGestor, async (req, res) => {
      const id = idPositivo.parse(req.params.id);
      const campo = campoValido(req.params.campo as string);
      const anterior = await conRol(req.sesion, async (c) => {
        const actual = await c.query<Record<string, string | null>>(
          `select ${campo} from ${op.tabla} where ${op.id} = $1 for update`,
          [id],
        );
        if (!actual.rows[0]) throw noEncontrado();
        await c.query(`update ${op.tabla} set ${campo} = null where ${op.id} = $1`, [id]);
        return actual.rows[0][campo];
      });
      await borrarImagen(anterior);
      res.status(204).end();
    });
  }

  return router;
}
