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
