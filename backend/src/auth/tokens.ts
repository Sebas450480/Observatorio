import { createHash, createHmac, randomBytes, timingSafeEqual } from 'node:crypto';
import type { Response } from 'express';
import jwt from 'jsonwebtoken';
import { config } from '../config.js';

export const NOMBRE_COOKIE = 'obs_sesion';

interface ContenidoToken {
  sub: string;
  iat: number;
  /** Rol con el que entró (cuentas con varios roles). */
  rol?: string;
  /** "Recordar sesión" (para conservarlo al cambiar de rol). */
  rec?: boolean;
}

/** Datos opcionales del token: rol elegido al entrar y "Recordar sesión". */
export interface OpcionesToken {
  rol?: string | null;
  recordar?: boolean;
}

/** Segundos de vigencia de la sesión: 30 días con "Recordar sesión", 8 horas sin él. */
export const vigenciaSesion = (recordar: boolean) =>
  Math.round(recordar ? config.jwt.recordarDias * 86400 : config.jwt.expiracionHoras * 3600);

/** Crea el token de sesión de un usuario. */
export function firmarToken(idUsuario: number, { rol, recordar = true }: OpcionesToken = {}): string {
  return jwt.sign({ ...(rol ? { rol } : {}), rec: recordar }, config.jwt.secreto, {
    subject: String(idUsuario),
    expiresIn: vigenciaSesion(recordar),
    algorithm: 'HS256',
  });
}

/**
 * Escribe la cookie de sesión. Con "Recordar sesión" la cookie dura lo mismo que el token
 * (y se renueva en cada visita); sin él es de sesión y el navegador la borra al cerrarse.
 */
export function guardarSesion(res: Response, idUsuario: number, opciones: OpcionesToken = {}) {
  const recordar = opciones.recordar ?? true;
  const { maxAge: _maxAge, ...base } = opcionesCookie();
  res.cookie(NOMBRE_COOKIE, firmarToken(idUsuario, { ...opciones, recordar }), recordar ? { ...base, maxAge: vigenciaSesion(true) * 1000 } : base);
}

/** Devuelve el id del usuario, la fecha de emisión y el rol elegido, o null si el token no es válido o venció. */
export function verificarToken(
  token: string,
): { idUsuario: number; emitidoEn: Date; rolActivo: string | null; recordar: boolean } | null {
  try {
    const datos = jwt.verify(token, config.jwt.secreto, { algorithms: ['HS256'] }) as ContenidoToken;
    const idUsuario = Number(datos.sub);
    if (!Number.isInteger(idUsuario) || idUsuario <= 0) return null;
    return {
      idUsuario,
      emitidoEn: new Date(datos.iat * 1000),
      rolActivo: typeof datos.rol === 'string' ? datos.rol : null,
      recordar: datos.rec !== false,
    };
  } catch {
    return null;
  }
}

export const opcionesCookie = () => ({
  httpOnly: true,
  sameSite: 'lax' as const,
  secure: config.esProduccion,
  maxAge: vigenciaSesion(true) * 1000,
  path: '/',
});

/** Código aleatorio para recuperar la contraseña (va en el enlace del correo). */
export function generarCodigoRecuperacion(): string {
  return randomBytes(32).toString('base64url');
}

/** Huella del código que se guarda en la base de datos (nunca el código en sí). */
export function huellaCodigo(codigo: string): string {
  return createHash('sha256').update(codigo).digest('hex');
}

/** Firma corta para el enlace de "correo abierto" de las alertas. */
export function firmarIdEnvio(idEnvio: number): string {
  return createHmac('sha256', config.jwt.secreto).update(`envio:${idEnvio}`).digest('base64url').slice(0, 22);
}

export function verificarFirmaEnvio(idEnvio: number, firma: string): boolean {
  const esperada = Buffer.from(firmarIdEnvio(idEnvio));
  const recibida = Buffer.from(firma);
  return esperada.length === recibida.length && timingSafeEqual(esperada, recibida);
}
