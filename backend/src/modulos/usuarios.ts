import bcrypt from 'bcryptjs';
import { Router } from 'express';
import { z } from 'zod';
import { config } from '../config.js';
import { conRol } from '../db/contexto.js';
import { ErrorApi, noEncontrado } from '../errores.js';
import { requiereSuperAdmin } from '../middlewares/sesion.js';
import { Filtros, construirPagina, esquemaPaginacion } from '../utilidades/consulta.js';
import {
  ESTADOS, FRECUENCIAS_ALERTA, contrasena, correo, idPositivo, listaIds, textoObligatorio, textoOpcional,
} from '../utilidades/esquemas.js';
import { COLUMNAS_PERFIL } from './auth.js';

/** Gestión de usuarios y roles (solo SuperAdmin). RF-24. */
export const rutasUsuarios = Router();
rutasUsuarios.use(requiereSuperAdmin);

const esquemaFiltros = esquemaPaginacion.extend({
  q: z.string().trim().min(1).max(100).optional(),
  id_rol: idPositivo.optional(),
  estado: z.enum(ESTADOS).optional(),
  ciudad: z.string().trim().max(60).optional(),
});

rutasUsuarios.get('/', async (req, res) => {
  const v = esquemaFiltros.parse(req.query);
  const f = new Filtros();
  if (v.q) f.texto(['u.nombre_usuario', 'u.apellido_usuario', 'u.apodo_usuario', 'u.correo'], v.q);
  if (v.id_rol) f.y(`u.id_rol = ${f.param(v.id_rol)}`);
  if (v.estado) f.y(`u.estado_usuario = ${f.param(v.estado)}`);
  if (v.ciudad) f.y(`u.ciudad ilike ${f.param(v.ciudad)}`);

  const resultado = await conRol(req.sesion, async (c) => {
    const total = await c.query<{ total: number }>(`select count(*)::int as total from usuario u ${f.where()}`, f.valores);
    const filas = await c.query(
      `select ${COLUMNAS_PERFIL} from usuario u join rol r on r.id_rol = u.id_rol ${f.where()}
        order by u.fecha_registro desc, u.id_usuario desc
        limit ${f.param(v.limite)} offset ${f.param((v.pagina - 1) * v.limite)}`,
      f.valores,
    );
    return { total: total.rows[0]?.total ?? 0, filas: filas.rows };
  });
  res.json(construirPagina(resultado.filas, resultado.total, v.pagina, v.limite));
});

async function obtenerUsuario(sesion: Parameters<typeof conRol>[0], id: number) {
  return conRol(sesion, async (c) => {
    const { rows } = await c.query(
      `select ${COLUMNAS_PERFIL} from usuario u join rol r on r.id_rol = u.id_rol where u.id_usuario = $1`,
      [id],
    );
    return rows[0];
  });
}

rutasUsuarios.get('/:id', async (req, res) => {
  const usuario = await obtenerUsuario(req.sesion, idPositivo.parse(req.params.id));
  if (!usuario) throw noEncontrado('Usuario');
  res.json(usuario);
});

/** El SuperAdmin crea cuentas, por ejemplo las de los gestores de cada módulo. */
const esquemaCrear = z.object({
  nombre_usuario: textoObligatorio(50),
  apellido_usuario: textoObligatorio(50),
  apodo_usuario: textoOpcional(20),
  correo,
  contrasena,
  ciudad: textoOpcional(60),
  id_rol: z.number().int().positive(),
  frecuencia_alertas: z.enum(FRECUENCIAS_ALERTA).optional(),
  intereses: listaIds.default([]),
  acepta_tratamiento_datos: z.literal(true, {
    message: 'Confirma que la persona autorizó el tratamiento de sus datos (Ley 1581 de 2012)',
  }),
});

rutasUsuarios.post('/', async (req, res) => {
  const datos = esquemaCrear.parse(req.body);
  const hash = await bcrypt.hash(datos.contrasena, config.bcryptCosto);
  const id = await conRol(req.sesion, async (c) => {
    const { rows } = await c.query<{ id_usuario: number }>(
      `insert into usuario (nombre_usuario, apellido_usuario, apodo_usuario, correo, contrasena_hash, ciudad,
                            frecuencia_alertas, acepta_tratamiento_datos, fecha_aceptacion_datos, id_rol)
       values ($1, $2, $3, $4, $5, $6, coalesce($7::frecuencia_alertas, 'Semanal'), true, now(), $8)
       returning id_usuario`,
      [
        datos.nombre_usuario, datos.apellido_usuario, datos.apodo_usuario ?? null, datos.correo, hash,
        datos.ciudad ?? null, datos.frecuencia_alertas ?? null, datos.id_rol,
      ],
    );
    const nuevo = rows[0]!.id_usuario;
    if (datos.intereses.length) {
      await c.query(
        `insert into usuario_interes (id_usuario, id_categoria)
         select $1, id_categoria from categoria where id_categoria = any($2::int[])`,
        [nuevo, datos.intereses],
      );
    }
    return nuevo;
  });
  res.status(201).json(await obtenerUsuario(req.sesion, id));
});

/** Cambiar rol, estado (activar/bloquear) o datos básicos de un usuario. */
const esquemaEditar = z.object({
  id_rol: z.number().int().positive(),
  estado_usuario: z.enum(ESTADOS),
  nombre_usuario: textoObligatorio(50),
  apellido_usuario: textoObligatorio(50),
  apodo_usuario: textoOpcional(20),
  ciudad: textoOpcional(60),
}).partial();

rutasUsuarios.patch('/:id', async (req, res) => {
  const id = idPositivo.parse(req.params.id);
  const datos = esquemaEditar.parse(req.body);
  const entradas = Object.entries(datos).filter(([, v]) => v !== undefined);
  if (!entradas.length) throw new ErrorApi(400, 'No se enviaron cambios');
  if (id === req.sesion.idUsuario && (datos.id_rol !== undefined || datos.estado_usuario !== undefined)) {
    throw new ErrorApi(400, 'No puedes cambiar tu propio rol ni tu estado');
  }
  await conRol(req.sesion, async (c) => {
    const { rowCount } = await c.query(
      `update usuario set ${entradas.map(([col], i) => `${col} = $${i + 2}`).join(', ')} where id_usuario = $1`,
      [id, ...entradas.map(([, v]) => v)],
    );
    if (!rowCount) throw noEncontrado('Usuario');
  });
  res.json(await obtenerUsuario(req.sesion, id));
});

rutasUsuarios.delete('/:id', async (req, res) => {
  const id = idPositivo.parse(req.params.id);
  if (id === req.sesion.idUsuario) throw new ErrorApi(400, 'No puedes eliminar tu propia cuenta');
  await conRol(req.sesion, async (c) => {
    const { rowCount } = await c.query('delete from usuario where id_usuario = $1', [id]);
    if (!rowCount) throw noEncontrado('Usuario');
  });
  res.status(204).end();
});
