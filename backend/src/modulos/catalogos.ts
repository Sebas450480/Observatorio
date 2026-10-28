import { Router } from 'express';
import { z } from 'zod';
import { conRol, type Cliente } from '../db/contexto.js';
import { ErrorApi, noEncontrado } from '../errores.js';
import { requiereRol, requiereSuperAdmin } from '../middlewares/sesion.js';
import { idPositivo, normalizarNombre, textoObligatorio } from '../utilidades/esquemas.js';

/** Roles y categorías: todos los consultan; los gestores crean categorías y solo el SuperAdmin las modifica o elimina. */
export const rutasRoles = Router();

rutasRoles.get('/', async (req, res) => {
  const roles = await conRol(req.sesion, async (c) =>
    (await c.query('select id_rol, nombre_rol, descripcion_rol, permisos from rol order by id_rol')).rows);
  res.json(roles);
});

/** Sectores económicos (secciones CIIU) para la ficha de la empresa; "Otro" se escribe a mano y no se guarda aquí. */
export const rutasSectores = Router();

rutasSectores.get('/', async (req, res) => {
  const sectores = await conRol(req.sesion, async (c) =>
    (await c.query('select seccion, nombre, foto from sector_economico order by nombre')).rows);
  res.json(sectores);
});

/**
 * Opciones de "Mis intereses" por módulo, de la más usada a la menos usada (las primeras 5 se
 * muestran como fichas y el resto en "Más"): tipos de evento del Flash, categorías de Faro,
 * sectores de empresas y megatendencias registradas (el frontend agrega las del Figma).
 */
export const rutasIntereses = Router();

rutasIntereses.get('/', async (req, res) => {
  const opciones = await conRol(req.sesion, async (c) => {
    const flash = await c.query(
      `select e.tipo::text as valor, count(f.id_fi)::int as usos
         from unnest(enum_range(null::tipo_evento)) e(tipo)
         left join flash_informativo f on f.tipo_evento = e.tipo
        group by e.tipo order by usos desc, valor`,
    );
    const faro = await c.query(
      `select c.id_categoria as id, c.nombre_categoria as valor, count(fc.id_fe)::int as usos
         from categoria c left join faro_empresarial_categoria fc on fc.id_categoria = c.id_categoria
        group by c.id_categoria order by usos desc, c.nombre_categoria`,
    );
    const empresa = await c.query(
      `select s.nombre as valor, count(e.id_ec)::int as usos
         from sector_economico s left join empresa_coformadora e on e.sector_economico = s.nombre
        group by s.nombre order by usos desc, s.nombre`,
    );
    const tendencia = await c.query(
      `select megatendencia as valor, count(*)::int as usos from tendencia_empresarial
        group by megatendencia order by usos desc, megatendencia`,
    );
    return { Flash: flash.rows, Faro: faro.rows, Empresa: empresa.rows, Tendencia: tendencia.rows };
  });
  res.json(opciones);
});

export const rutasCategorias = Router();

rutasCategorias.get('/', async (req, res) => {
  const categorias = await conRol(req.sesion, async (c) =>
    (await c.query('select id_categoria, nombre_categoria from categoria order by nombre_categoria')).rows);
  res.json(categorias);
});

const esquema = z.object({ nombre_categoria: textoObligatorio(50) });

/** Evita categorías repetidas sin importar mayúsculas, minúsculas ni tildes. */
async function verificarNoRepetida(c: Cliente, nombre: string, excepto?: number) {
  const { rows } = await c.query<{ id_categoria: number; nombre_categoria: string }>('select id_categoria, nombre_categoria from categoria');
  const repetida = rows.find((r) => r.id_categoria !== excepto && normalizarNombre(r.nombre_categoria) === normalizarNombre(nombre));
  if (repetida) throw new ErrorApi(409, `Esta categoría ya está creada: «${repetida.nombre_categoria}»`);
}

rutasCategorias.post(
  '/',
  requiereRol('obs_gestor_faro', 'obs_gestor_flash', 'obs_gestor_empresas', 'obs_gestor_tendencias', 'obs_gestor_calendario'),
  async (req, res) => {
    const { nombre_categoria } = esquema.parse(req.body);
    const categoria = await conRol(req.sesion, async (c) => {
      await verificarNoRepetida(c, nombre_categoria);
      return (await c.query('insert into categoria (nombre_categoria) values ($1) returning *', [nombre_categoria])).rows[0];
    });
    res.status(201).json(categoria);
  },
);

rutasCategorias.patch('/:id', requiereSuperAdmin, async (req, res) => {
  const id = idPositivo.parse(req.params.id);
  const { nombre_categoria } = esquema.parse(req.body);
  const categoria = await conRol(req.sesion, async (c) => {
    await verificarNoRepetida(c, nombre_categoria, id);
    return (await c.query('update categoria set nombre_categoria = $1 where id_categoria = $2 returning *', [nombre_categoria, id])).rows[0];
  });
  if (!categoria) throw noEncontrado('Categoría');
  res.json(categoria);
});

rutasCategorias.delete('/:id', requiereSuperAdmin, async (req, res) => {
  const id = idPositivo.parse(req.params.id);
  await conRol(req.sesion, async (c) => {
    const { rowCount } = await c.query('delete from categoria where id_categoria = $1', [id]);
    if (!rowCount) throw noEncontrado('Categoría');
  });
  res.status(204).end();
});
