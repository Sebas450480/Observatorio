import { randomUUID } from 'node:crypto';
import bcrypt from 'bcryptjs';
import pg from 'pg';
import request from 'supertest';
import type { Response } from 'superagent';
import { crearApp } from '../src/app.js';
import { urlAdminPruebas } from './entorno.js';

export const app = crearApp();

let admin: pg.Pool | null = null;

/** Conexión de administrador para preparar datos de prueba directamente en la base. */
export function db(): pg.Pool {
  admin ??= new pg.Pool({ connectionString: urlAdminPruebas(), max: 2 });
  return admin;
}

export async function cerrarAdmin() {
  await admin?.end();
  admin = null;
}

export const CONTRASENA = 'Clave-segura-123';

export type NombreRol =
  | 'SuperAdmin'
  | 'Usuario'
  | 'Gestor Faro Empresarial'
  | 'Gestor Flash Informativo'
  | 'Gestor Empresas Coformadoras'
  | 'Gestor Tendencias'
  | 'Gestor Calendario';

/** Crea un usuario con el rol indicado y devuelve sus datos. */
export async function crearUsuario(rol: NombreRol, extra: { ciudad?: string; frecuencia?: string } = {}) {
  const correo = `prueba.${randomUUID().slice(0, 8)}@test.co`;
  const hash = await bcrypt.hash(CONTRASENA, 4);
  const { rows } = await db().query<{ id_usuario: number }>(
    `insert into usuario (nombre_usuario, apellido_usuario, correo, contrasena_hash, ciudad, frecuencia_alertas,
                          acepta_tratamiento_datos, fecha_aceptacion_datos, id_rol)
     values ('Prueba', $1::text, $2, $3, $4, coalesce($5::frecuencia_alertas, 'Ninguna'), true, now(),
             (select id_rol from rol where nombre_rol = $1::text))
     returning id_usuario`,
    [rol, correo, hash, extra.ciudad ?? null, extra.frecuencia ?? null],
  );
  return { id: rows[0]!.id_usuario, correo };
}

/** Devuelve un agente HTTP con la sesión iniciada (cookie) para el rol indicado. */
export async function sesion(rol: NombreRol) {
  const usuario = await crearUsuario(rol);
  const agente = request.agent(app);
  const respuesta = await agente.post('/api/auth/login').send({ correo: usuario.correo, contrasena: CONTRASENA });
  if (respuesta.status !== 200) throw new Error(`No se pudo iniciar sesión como ${rol}: ${respuesta.text}`);
  return { agente, usuario };
}

/** Invitado: sin sesión. */
export const invitado = () => request(app);

/** Imagen PNG mínima válida (1x1). */
export const PNG_1X1 = Buffer.from(
  'iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAYAAAAfFcSJAAAADUlEQVR42mP8z8BQDwAEhQGAhKmMIQAAAABJRU5ErkJggg==',
  'base64',
);

/** Lee una respuesta binaria (Excel, PDF) como Buffer: `.buffer(true).parse(binario)`. */
export function binario(res: Response, cb: (error: Error | null, cuerpo: Buffer) => void) {
  const partes: Buffer[] = [];
  const flujo = res as unknown as NodeJS.ReadableStream;
  flujo.on('data', (d: Buffer) => partes.push(d));
  flujo.on('end', () => cb(null, Buffer.concat(partes)));
}
