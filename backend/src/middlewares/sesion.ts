import type { RequestHandler } from 'express';
import { conAutenticacion } from '../db/contexto.js';
import { NOMBRE_COOKIE, verificarToken } from '../auth/tokens.js';
import {
  ROL_POR_NOMBRE, SESION_INVITADO, nombreRolCanonico, nombreRolPrincipal, rolPrincipal, type RolBD, type Sesion,
} from '../auth/roles.js';
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
    const { rows } = await c.query<{ estado_usuario: string; fecha_cambio_contrasena: Date | null; roles: string[] }>(
      `select u.estado_usuario, u.fecha_cambio_contrasena,
              array(select r.nombre_rol from usuario_rol ur join rol r on r.id_rol = ur.id_rol
                     where ur.id_usuario = u.id_usuario) as roles
         from usuario u
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

  const nombresRoles = [...new Set(usuario.roles.map(nombreRolCanonico).filter((n) => ROL_POR_NOMBRE[n]))];
  if (!nombresRoles.length) return next();
  const roles = [...new Set(nombresRoles.map((n) => ROL_POR_NOMBRE[n]!))];

  req.sesion = { idUsuario: datos.idUsuario, rol: rolPrincipal(roles), nombreRol: nombreRolPrincipal(nombresRoles), roles, nombresRoles };
  next();
};

/**
 * Si la cuenta tiene el rol indicado, las consultas de la petición se hacen con él.
 * Así una cuenta con varios roles usa en cada módulo el rol que lo gestiona
 * (por ejemplo, Gestor Faro en Faro Empresarial y Empresa Coformadora en Mi empresa).
 * El SuperAdmin conserva su rol: ya puede todo.
 */
export function usarRol(req: { sesion: Sesion }, rol: RolBD): boolean {
  if (req.sesion.rol === 'obs_superadmin') return true;
  if (!req.sesion.roles.includes(rol)) return false;
  req.sesion = { ...req.sesion, rol };
  return true;
}

/** Exige haber iniciado sesión. */
export const requiereSesion: RequestHandler = (req, _res, next) => {
  if (req.sesion.idUsuario === null) return next(noAutenticado());
  next();
};

/** Exige uno de los roles indicados (el SuperAdmin siempre pasa). */
export function requiereRol(...roles: RolBD[]): RequestHandler {
  return (req, _res, next) => {
    if (req.sesion.idUsuario === null) return next(noAutenticado());
    if (req.sesion.rol !== 'obs_superadmin' && !roles.some((r) => usarRol(req, r))) return next(prohibido());
    next();
  };
}

export const requiereSuperAdmin = requiereRol('obs_superadmin');
