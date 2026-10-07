import { createHash, createHmac, randomBytes, timingSafeEqual } from 'node:crypto';
import jwt from 'jsonwebtoken';
import { config } from '../config.js';

export const NOMBRE_COOKIE = 'obs_sesion';

interface ContenidoToken {
  sub: string;
  iat: number;
}

/** Crea el token de sesión de un usuario. */
export function firmarToken(idUsuario: number): string {
  return jwt.sign({}, config.jwt.secreto, {
    subject: String(idUsuario),
    expiresIn: Math.round(config.jwt.expiracionHoras * 3600),
    algorithm: 'HS256',
  });
}

/** Devuelve el id del usuario y la fecha de emisión, o null si el token no es válido o venció. */
export function verificarToken(token: string): { idUsuario: number; emitidoEn: Date } | null {
  try {
    const datos = jwt.verify(token, config.jwt.secreto, { algorithms: ['HS256'] }) as ContenidoToken;
    const idUsuario = Number(datos.sub);
    if (!Number.isInteger(idUsuario) || idUsuario <= 0) return null;
    return { idUsuario, emitidoEn: new Date(datos.iat * 1000) };
  } catch {
    return null;
  }
}

export const opcionesCookie = () => ({
  httpOnly: true,
  sameSite: 'lax' as const,
  secure: config.esProduccion,
  maxAge: Math.round(config.jwt.expiracionHoras * 3600 * 1000),
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
