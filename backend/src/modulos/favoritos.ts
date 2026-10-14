import { Router } from 'express';
import { z } from 'zod';
import { conRol } from '../db/contexto.js';
import { noEncontrado } from '../errores.js';
import { requiereSesion } from '../middlewares/sesion.js';
import { TIPOS_CONTENIDO, idPositivo, type TipoContenido } from '../utilidades/esquemas.js';

/**
 * Favoritos: cada usuario registrado marca elementos de los módulos con la
 * banderita y los consulta en Mi perfil. Las políticas de la base de datos
 * limitan cada consulta a los favoritos propios.
 *
 *   GET    /                  favoritos con sus datos, categorías y si coinciden con los intereses
 *   GET    /claves            solo "Tipo:id" de cada favorito (para pintar las banderitas)
 *   PUT    /:tipo/:id         guardar
 *   DELETE /:tipo/:id         quitar
 */
export const rutasFavoritos = Router();
rutasFavoritos.use(requiereSesion);

/** Tabla y columna id de cada tipo de contenido (para comprobar que el elemento existe). */
const TABLA: Record<TipoContenido, { tabla: string; id: string }> = {
  Flash: { tabla: 'flash_informativo', id: 'id_fi' },
  Faro: { tabla: 'faro_empresarial', id: 'id_fe' },
  Empresa: { tabla: 'empresa_coformadora', id: 'id_ec' },
  Tendencia: { tabla: 'tendencia_empresarial', id: 'id_te' },
  Evento: { tabla: 'calendario_eventos', id: 'id_evento' },
};

const categoriasDe = (tablaPuente: string, id: string, alias: string) =>
  `coalesce((select json_agg(json_build_object('id_categoria', c.id_categoria, 'nombre', c.nombre_categoria)
                             order by c.nombre_categoria)
               from ${tablaPuente} p join categoria c on c.id_categoria = p.id_categoria
              where p.${id} = ${alias}.${id}), '[]'::json)`;

/**
 * Datos comunes de cada favorito. Las empresas no tienen categorías: se usa la
 * categoría con el mismo nombre de su sector económico (p. ej. "Comercio").
 */
const CONSULTA_FAVORITOS = `
  with f as (select * from favorito where id_usuario = $1)
  select f.tipo_contenido, f.id_contenido, f.fecha_guardado, x.titulo, x.detalle, x.fecha, x.imagen, x.categorias
    from f
    join lateral (
      select t.titulo, t.lugar as detalle, to_json(t.fecha_inicio) #>> '{}' as fecha, t.imagen,
             ${categoriasDe('flash_informativo_categoria', 'id_fi', 't')} as categorias
        from flash_informativo t where f.tipo_contenido = 'Flash' and t.id_fi = f.id_contenido
      union all
      select t.titulo, concat_ws(' · ', t.tipo::text, t.entidad), to_json(t.fecha_cierre) #>> '{}', t.imagen,
             ${categoriasDe('faro_empresarial_categoria', 'id_fe', 't')}
        from faro_empresarial t where f.tipo_contenido = 'Faro' and t.id_fe = f.id_contenido
      union all
      select coalesce(t.nombre_comercial, t.razon_social), t.sector_economico, null, t.logo_ec,
             coalesce((select json_agg(json_build_object('id_categoria', c.id_categoria, 'nombre', c.nombre_categoria))
                         from categoria c where lower(c.nombre_categoria) = lower(t.sector_economico)), '[]'::json)
        from empresa_coformadora t where f.tipo_contenido = 'Empresa' and t.id_ec = f.id_contenido
      union all
      select t.tendencia, t.megatendencia, to_json(t.fecha_publicacion) #>> '{}', null,
             ${categoriasDe('tendencia_categoria', 'id_te', 't')}
        from tendencia_empresarial t where f.tipo_contenido = 'Tendencia' and t.id_te = f.id_contenido
      union all
      select t.titulo, t.lugar, to_json(t.fecha_inicio) #>> '{}', null, '[]'::json
        from calendario_eventos t where f.tipo_contenido = 'Evento' and t.id_evento = f.id_contenido
    ) x on true
   order by f.fecha_guardado desc, f.id_favorito desc`;

interface FilaFavorito {
  tipo_contenido: TipoContenido;
  id_contenido: number;
  fecha_guardado: Date;
  titulo: string;
  detalle: string | null;
  fecha: string | null;
  imagen: string | null;
  categorias: { id_categoria: number; nombre: string }[];
}

rutasFavoritos.get('/', async (req, res) => {
  const { filas, intereses } = await conRol(req.sesion, async (c) => {
    const filas = (await c.query<FilaFavorito>(CONSULTA_FAVORITOS, [req.sesion.idUsuario])).rows;
    const intereses = (await c.query<{ id_categoria: number }>(
      'select id_categoria from usuario_interes where id_usuario = $1',
      [req.sesion.idUsuario],
    )).rows.map((r) => r.id_categoria);
    return { filas, intereses: new Set(intereses) };
  });
  res.json(filas.map((f) => ({ ...f, en_intereses: f.categorias.some((cat) => intereses.has(cat.id_categoria)) })));
});

rutasFavoritos.get('/claves', async (req, res) => {
  const filas = await conRol(req.sesion, async (c) =>
    (await c.query<{ clave: string }>(
      "select tipo_contenido || ':' || id_contenido as clave from favorito where id_usuario = $1",
      [req.sesion.idUsuario],
    )).rows);
  res.json(filas.map((f) => f.clave));
});

const esquemaRuta = z.object({ tipo: z.enum(TIPOS_CONTENIDO), id: idPositivo });

rutasFavoritos.put('/:tipo/:id', async (req, res) => {
  const { tipo, id } = esquemaRuta.parse(req.params);
  const { tabla, id: columna } = TABLA[tipo];
  await conRol(req.sesion, async (c) => {
    // Solo se puede guardar lo que la persona puede ver (las políticas ocultan los inactivos).
    const existe = await c.query(`select 1 from ${tabla} where ${columna} = $1`, [id]);
    if (!existe.rowCount) throw noEncontrado('Elemento');
    await c.query(
      `insert into favorito (id_usuario, tipo_contenido, id_contenido) values ($1, $2, $3)
       on conflict (id_usuario, tipo_contenido, id_contenido) do nothing`,
      [req.sesion.idUsuario, tipo, id],
    );
  });
  res.json({ favorito: true });
});

rutasFavoritos.delete('/:tipo/:id', async (req, res) => {
  const { tipo, id } = esquemaRuta.parse(req.params);
  await conRol(req.sesion, (c) =>
    c.query('delete from favorito where id_usuario = $1 and tipo_contenido = $2 and id_contenido = $3', [
      req.sesion.idUsuario,
      tipo,
      id,
    ]));
  res.json({ favorito: false });
});
