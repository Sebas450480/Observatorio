import bcrypt from 'bcryptjs';
import { Router } from 'express';
import { z } from 'zod';
import { SUPER_ADMIN, nombreRolCanonico, nombreRolPrincipal } from '../auth/roles.js';
import { config } from '../config.js';
import { conRol, type Cliente } from '../db/contexto.js';
import { ErrorApi, noEncontrado, prohibido } from '../errores.js';
import { requiereSuperAdmin } from '../middlewares/sesion.js';
import { Filtros, construirPagina, esquemaPaginacion } from '../utilidades/consulta.js';
import {
  ESTADOS, FRECUENCIAS_ALERTA, contrasena, correo, esquemaLote, idPositivo, listaIds, textoObligatorio, textoOpcional,
} from '../utilidades/esquemas.js';
import { COLUMNAS_PERFIL } from './auth.js';

/** Gestión de usuarios y roles (Super Admin y Gestor Observatorio). RF-24. */
export const rutasUsuarios = Router();
rutasUsuarios.use(requiereSuperAdmin);

/**
 * El Super Admin y el Gestor Observatorio administran usuarios, pero solo un
 * Super Admin puede asignar ese rol, cambiar los roles o el estado de quien lo
 * tiene o eliminarlo.
 */
async function rolesDeUsuario(c: Cliente, idUsuario: number): Promise<string[]> {
  const { rows } = await c.query<{ nombre_rol: string }>(
    'select r.nombre_rol from usuario_rol ur join rol r on r.id_rol = ur.id_rol where ur.id_usuario = $1',
    [idUsuario],
  );
  return rows.map((r) => nombreRolCanonico(r.nombre_rol));
}

/** Nombres de los roles indicados; error si alguno no existe. */
async function nombresDeRoles(c: Cliente, ids: number[]): Promise<{ id_rol: number; nombre: string }[]> {
  const { rows } = await c.query<{ id_rol: number; nombre_rol: string }>(
    'select id_rol, nombre_rol from rol where id_rol = any($1::int[])',
    [ids],
  );
  if (rows.length !== new Set(ids).size) throw new ErrorApi(400, 'Uno de los roles no existe');
  return rows.map((r) => ({ id_rol: r.id_rol, nombre: nombreRolCanonico(r.nombre_rol) }));
}

const esSuperAdmin = (sesion: { nombresRoles: string[] }) => sesion.nombresRoles.includes(SUPER_ADMIN);

/**
 * Deja la cuenta exactamente con estos roles. El principal (usuario.id_rol) es el
 * de más alcance; el trigger de la base lo mantiene también en usuario_rol.
 */
async function asignarRoles(c: Cliente, idUsuario: number, roles: { id_rol: number; nombre: string }[]) {
  const principal = nombreRolPrincipal(roles.map((r) => r.nombre));
  const idPrincipal = roles.find((r) => r.nombre === principal)?.id_rol ?? roles[0]!.id_rol;
  await c.query('update usuario set id_rol = $2 where id_usuario = $1', [idUsuario, idPrincipal]);
  await c.query('delete from usuario_rol where id_usuario = $1 and id_rol <> all($2::int[])', [idUsuario, roles.map((r) => r.id_rol)]);
  await c.query(
    'insert into usuario_rol (id_usuario, id_rol) select $1, unnest($2::int[]) on conflict do nothing',
    [idUsuario, roles.map((r) => r.id_rol)],
  );
}

/** Lista de roles nueva: `roles` (varios) o `id_rol` (uno, como antes). */
const listaRoles = z.array(z.number().int().positive()).min(1, 'Elige al menos un rol').max(12);
const rolesPedidos = (d: { roles?: number[]; id_rol?: number }) => d.roles ?? (d.id_rol !== undefined ? [d.id_rol] : undefined);

/** Columnas de la tabla de usuarios por las que se puede ordenar. */
const ORDENES: Record<string, string> = {
  id: 'u.id_usuario',
  apodo: 'lower(u.apodo_usuario)',
  nombre: 'lower(u.nombre_usuario)',
  apellido: 'lower(u.apellido_usuario)',
  correo: 'lower(u.correo)',
  ciudad: 'lower(u.ciudad)',
  rol: 'lower(r.nombre_rol)',
  estado: 'u.estado_usuario',
  registro: 'u.fecha_registro',
};

const esquemaFiltros = esquemaPaginacion.extend({
  orden: z.enum(Object.keys(ORDENES) as [string, ...string[]]).optional(),
  direccion: z.enum(['asc', 'desc']).optional(),
  q: z.string().trim().min(1).max(100).optional(),
  id_rol: idPositivo.optional(),
  estado: z.enum(ESTADOS).optional(),
  ciudad: z.string().trim().max(60).optional(),
});

rutasUsuarios.get('/', async (req, res) => {
  const v = esquemaFiltros.parse(req.query);
  const f = new Filtros();
  if (v.q) f.texto(['u.nombre_usuario', 'u.apellido_usuario', 'u.apodo_usuario', 'u.correo'], v.q);
  if (v.id_rol) f.y(`exists (select 1 from usuario_rol ur where ur.id_usuario = u.id_usuario and ur.id_rol = ${f.param(v.id_rol)})`);
  if (v.estado) f.y(`u.estado_usuario = ${f.param(v.estado)}`);
  if (v.ciudad) f.y(`u.ciudad ilike ${f.param(v.ciudad)}`);

  const resultado = await conRol(req.sesion, async (c) => {
    const total = await c.query<{ total: number }>(`select count(*)::int as total from usuario u ${f.where()}`, f.valores);
    const filas = await c.query(
      `select ${COLUMNAS_PERFIL} from usuario u join rol r on r.id_rol = u.id_rol ${f.where()}
        order by ${v.orden ? `${ORDENES[v.orden]} ${v.direccion ?? 'asc'} nulls last, u.id_usuario ${v.direccion ?? 'asc'}` : 'u.fecha_registro desc, u.id_usuario desc'}
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

/** Se crean cuentas, por ejemplo las de los gestores de cada módulo, con uno o varios roles. */
const esquemaCrear = z.object({
  nombre_usuario: textoObligatorio(50),
  apellido_usuario: textoObligatorio(50),
  apodo_usuario: textoOpcional(20),
  correo,
  contrasena,
  ciudad: textoOpcional(60),
  id_rol: z.number().int().positive().optional(),
  roles: listaRoles.optional(),
  frecuencia_alertas: z.enum(FRECUENCIAS_ALERTA).optional(),
  intereses: listaIds.default([]),
  acepta_tratamiento_datos: z.literal(true, {
    message: 'Confirma que la persona autorizó el tratamiento de sus datos (Ley 1581 de 2012)',
  }),
}).refine((d) => rolesPedidos(d), { message: 'Elige al menos un rol', path: ['roles'] });

rutasUsuarios.post('/', async (req, res) => {
  const datos = esquemaCrear.parse(req.body);
  const hash = await bcrypt.hash(datos.contrasena, config.bcryptCosto);
  const id = await conRol(req.sesion, async (c) => {
    const roles = await nombresDeRoles(c, rolesPedidos(datos)!);
    if (!esSuperAdmin(req.sesion) && roles.some((r) => r.nombre === SUPER_ADMIN)) {
      throw prohibido('Solo un Super Admin puede asignar ese rol');
    }
    const { rows } = await c.query<{ id_usuario: number }>(
      `insert into usuario (nombre_usuario, apellido_usuario, apodo_usuario, correo, contrasena_hash, ciudad,
                            frecuencia_alertas, acepta_tratamiento_datos, fecha_aceptacion_datos, id_rol)
       values ($1, $2, $3, $4, $5, $6, coalesce($7::frecuencia_alertas, 'Semanal'), true, now(), $8)
       returning id_usuario`,
      [
        datos.nombre_usuario, datos.apellido_usuario, datos.apodo_usuario ?? null, datos.correo, hash,
        datos.ciudad ?? null, datos.frecuencia_alertas ?? null, roles[0]!.id_rol,
      ],
    );
    const nuevo = rows[0]!.id_usuario;
    await asignarRoles(c, nuevo, roles);
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

/** Cambiar roles, estado (activar/bloquear) o datos básicos de un usuario. */
const esquemaEditar = z.object({
  id_rol: z.number().int().positive(),
  roles: listaRoles,
  estado_usuario: z.enum(ESTADOS),
  nombre_usuario: textoObligatorio(50),
  apellido_usuario: textoObligatorio(50),
  apodo_usuario: textoOpcional(20),
  ciudad: textoOpcional(60),
}).partial();

rutasUsuarios.patch('/:id', async (req, res) => {
  const id = idPositivo.parse(req.params.id);
  const { roles: _roles, id_rol: _idRol, ...datos } = esquemaEditar.parse(req.body);
  const pedidos = rolesPedidos({ roles: _roles, id_rol: _idRol });
  const entradas = Object.entries(datos).filter(([, v]) => v !== undefined);
  if (!entradas.length && !pedidos) throw new ErrorApi(400, 'No se enviaron cambios');
  if (id === req.sesion.idUsuario && (pedidos || datos.estado_usuario !== undefined)) {
    throw new ErrorApi(400, 'No puedes cambiar tus propios roles ni tu estado');
  }
  await conRol(req.sesion, async (c) => {
    const actuales = await rolesDeUsuario(c, id);
    const roles = pedidos && (await nombresDeRoles(c, pedidos));
    if (!esSuperAdmin(req.sesion)) {
      if (actuales.includes(SUPER_ADMIN) && (roles || datos.estado_usuario !== undefined)) {
        throw prohibido('No puedes cambiar los roles ni el estado de un Super Admin');
      }
      if (roles?.some((r) => r.nombre === SUPER_ADMIN)) throw prohibido('Solo un Super Admin puede asignar ese rol');
    }
    if (entradas.length) {
      const { rowCount } = await c.query(
        `update usuario set ${entradas.map(([col], i) => `${col} = $${i + 2}`).join(', ')} where id_usuario = $1`,
        [id, ...entradas.map(([, v]) => v)],
      );
      if (!rowCount) throw noEncontrado('Usuario');
    } else if (!actuales.length) {
      const existe = await c.query('select 1 from usuario where id_usuario = $1', [id]);
      if (!existe.rowCount) throw noEncontrado('Usuario');
    }
    if (roles) await asignarRoles(c, id, roles);
  });
  res.json(await obtenerUsuario(req.sesion, id));
});

/** Eliminar, activar o desactivar varios usuarios a la vez. Todo o nada. */
rutasUsuarios.post('/lote', async (req, res) => {
  const { ids, accion } = esquemaLote.parse(req.body);
  const unicos = [...new Set(ids)];
  if (unicos.includes(req.sesion.idUsuario!)) {
    throw new ErrorApi(400, accion === 'eliminar' ? 'No puedes eliminar tu propia cuenta' : 'No puedes cambiar tu propio estado');
  }
  const afectados = await conRol(req.sesion, async (c) => {
    if (!esSuperAdmin(req.sesion)) {
      for (const id of unicos) {
        if ((await rolesDeUsuario(c, id)).includes(SUPER_ADMIN)) {
          throw prohibido(accion === 'eliminar' ? 'No puedes eliminar a un Super Admin' : 'No puedes cambiar el estado de un Super Admin');
        }
      }
    }
    const { rowCount } = accion === 'eliminar'
      ? await c.query('delete from usuario where id_usuario = any($1::int[])', [unicos])
      : await c.query('update usuario set estado_usuario = $1 where id_usuario = any($2::int[])', [accion === 'activar' ? 'Activo' : 'Inactivo', unicos]);
    return rowCount ?? 0;
  });
  res.json({ afectados });
});

rutasUsuarios.delete('/:id', async (req, res) => {
  const id = idPositivo.parse(req.params.id);
  if (id === req.sesion.idUsuario) throw new ErrorApi(400, 'No puedes eliminar tu propia cuenta');
  await conRol(req.sesion, async (c) => {
    if (!esSuperAdmin(req.sesion) && (await rolesDeUsuario(c, id)).includes(SUPER_ADMIN)) {
      throw prohibido('No puedes eliminar a un Super Admin');
    }
    const { rowCount } = await c.query('delete from usuario where id_usuario = $1', [id]);
    if (!rowCount) throw noEncontrado('Usuario');
  });
  res.status(204).end();
});
