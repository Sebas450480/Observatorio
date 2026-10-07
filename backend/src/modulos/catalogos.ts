import { Router } from 'express';
import { z } from 'zod';
import { conRol } from '../db/contexto.js';
import { noEncontrado } from '../errores.js';
import { requiereSuperAdmin } from '../middlewares/sesion.js';
import { idPositivo, textoObligatorio } from '../utilidades/esquemas.js';

/** Roles y categorías: todos los consultan; solo el SuperAdmin modifica las categorías. */
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

rutasCategorias.post('/', requiereSuperAdmin, async (req, res) => {
  const { nombre_categoria } = esquema.parse(req.body);
  const categoria = await conRol(req.sesion, async (c) =>
    (await c.query('insert into categoria (nombre_categoria) values ($1) returning *', [nombre_categoria])).rows[0]);
  res.status(201).json(categoria);
});

rutasCategorias.patch('/:id', requiereSuperAdmin, async (req, res) => {
  const id = idPositivo.parse(req.params.id);
  const { nombre_categoria } = esquema.parse(req.body);
  const categoria = await conRol(req.sesion, async (c) =>
    (await c.query('update categoria set nombre_categoria = $1 where id_categoria = $2 returning *', [nombre_categoria, id])).rows[0]);
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
