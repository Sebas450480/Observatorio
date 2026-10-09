import type { PoolClient } from 'pg';
import { pool } from './pool.js';
import { esRolBd, type RolBD } from '../auth/roles.js';

export type Cliente = PoolClient;

interface ContextoRol {
  idUsuario: number | null;
  rol: RolBD;
}

/**
 * Ejecuta `trabajo` dentro de una transacción con el rol de PostgreSQL de la persona
 * que hace la petición. Es la pieza central de la seguridad:
 *
 *   begin;
 *   set local role obs_gestor_flash;     -- permisos por tabla y políticas por fila
 *   set local app.id_usuario = '15';     -- "solo su perfil" y auditoría (creado_por)
 *   ... consultas ...
 *   commit;
 *
 * Si `trabajo` lanza un error, la transacción se deshace completa.
 */
export async function conRol<T>(contexto: ContextoRol, trabajo: (cliente: Cliente) => Promise<T>): Promise<T> {
  // El nombre del rol se escribe dentro del SQL, así que solo se aceptan los roles conocidos.
  if (!esRolBd(contexto.rol)) {
    throw new Error(`Rol de base de datos no permitido: ${String(contexto.rol)}`);
  }

  const cliente = await pool.connect();
  try {
    await cliente.query('begin');
    await cliente.query(`set local role ${contexto.rol}`);
    await cliente.query("select set_config('app.id_usuario', $1, true)", [
      contexto.idUsuario === null ? '' : String(contexto.idUsuario),
    ]);
    const resultado = await trabajo(cliente);
    await cliente.query('commit');
    return resultado;
  } catch (error) {
    await cliente.query('rollback').catch(() => undefined);
    throw error;
  } finally {
    cliente.release();
  }
}

/** Consultas de inicio de sesión, registro y recuperación de contraseña. */
export function conAutenticacion<T>(trabajo: (cliente: Cliente) => Promise<T>): Promise<T> {
  return conRol({ idUsuario: null, rol: 'obs_autenticacion' }, trabajo);
}

/** Tareas internas del sistema (alertas, scripts). Se ejecutan como SuperAdmin. */
export function comoSistema<T>(trabajo: (cliente: Cliente) => Promise<T>): Promise<T> {
  return conRol({ idUsuario: null, rol: 'obs_superadmin' }, trabajo);
}
