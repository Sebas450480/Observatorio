import type { RequestHandler } from 'express';
import { conAutenticacion } from '../db/contexto.js';
import { NOMBRE_COOKIE, verificarToken } from '../auth/tokens.js';
import { ROL_POR_NOMBRE, SESION_INVITADO, type RolBD, type Sesion } from '../auth/roles.js';
import { noAutenticado, prohibido } from '../errores.js';

declare module 'express-serve-static-core' {
  interface Request {
    sesion: Sesion;
  }
}

function leerToken(cookies: Record<string, string> | undefined, autorizacion: string | undefined): string | null {
  const deCookie = cookies?.[NOMBRE_COOKIE];
  if (deCookie) return deCookie;
  if (autorizacion?.startsWith('Bearer ')) return autorizacion.slice(7).trim();
  return null;
}

/**
 * Identifica a quien hace la petición.
 * - Sin token (o con un token inválido): invitado.
 * - Con token: se consulta el usuario en la base de datos en cada petición, así un
 *   cambio de rol, un bloqueo o un cambio de contraseña aplican de inmediato.
 */
export const identificarSesion: RequestHandler = async (req, _res, next) => {
  req.sesion = SESION_INVITADO;

  const token = leerToken(req.cookies, req.headers.authorization);
  if (!token) return next();

  const datos = verificarToken(token);
  if (!datos) return next();

  const usuario = await conAutenticacion(async (c) => {
    const { rows } = await c.query<{ estado_usuario: string; nombre_rol: string; fecha_cambio_contrasena: Date | null }>(
      `select u.estado_usuario, r.nombre_rol, u.fecha_cambio_contrasena
         from usuario u join rol r on r.id_rol = u.id_rol
        where u.id_usuario = $1`,
      [datos.idUsuario],
    );
    return rows[0];
  });

  if (!usuario || usuario.estado_usuario !== 'Activo') return next();

  // Un token emitido antes del último cambio de contraseña ya no es válido.
  // (El token guarda la hora en segundos; se compara al segundo.)
  if (usuario.fecha_cambio_contrasena
      && Math.floor(usuario.fecha_cambio_contrasena.getTime() / 1000) > Math.floor(datos.emitidoEn.getTime() / 1000)) {
    return next();
  }

  const rol = ROL_POR_NOMBRE[usuario.nombre_rol];
  if (!rol) return next();

  req.sesion = { idUsuario: datos.idUsuario, rol, nombreRol: usuario.nombre_rol };
  next();
};

/** Exige haber iniciado sesión. */
export const requiereSesion: RequestHandler = (req, _res, next) => {
  if (req.sesion.idUsuario === null) return next(noAutenticado());
  next();
};

/** Exige uno de los roles indicados (el SuperAdmin siempre pasa). */
export function requiereRol(...roles: RolBD[]): RequestHandler {
  return (req, _res, next) => {
    if (req.sesion.idUsuario === null) return next(noAutenticado());
    if (req.sesion.rol !== 'obs_superadmin' && !roles.includes(req.sesion.rol)) return next(prohibido());
    next();
  };
}

export const requiereSuperAdmin = requiereRol('obs_superadmin');
