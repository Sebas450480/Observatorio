/**
 * Crea el primer SuperAdmin (o convierte en SuperAdmin una cuenta existente).
 *
 * Uso:
 *   npm run crear-superadmin -- --correo admin@uniempresarial.edu.co --nombre Ana --apellido Pérez
 *
 * La contraseña se pide por consola (o se toma de la variable SUPERADMIN_CONTRASENA)
 * y se guarda cifrada. Nunca se escribe en el repositorio.
 */
import { parseArgs } from 'node:util';
import { createInterface } from 'node:readline/promises';
import bcrypt from 'bcryptjs';
import { config } from '../config.js';
import { comoSistema } from '../db/contexto.js';
import { cerrarPool } from '../db/pool.js';
import { contrasena as reglaContrasena, correo as reglaCorreo } from '../utilidades/esquemas.js';

async function pedirContrasena(): Promise<string> {
  if (process.env.SUPERADMIN_CONTRASENA) return process.env.SUPERADMIN_CONTRASENA;
  const rl = createInterface({ input: process.stdin, output: process.stdout });
  const valor = await rl.question('Contraseña del SuperAdmin (mínimo 8 caracteres): ');
  rl.close();
  return valor;
}

async function principal() {
  const { values } = parseArgs({
    options: {
      correo: { type: 'string' },
      nombre: { type: 'string', default: 'Administrador' },
      apellido: { type: 'string', default: 'Observatorio' },
    },
  });
  if (!values.correo) throw new Error('Indica el correo con --correo');

  const correo = reglaCorreo.parse(values.correo);
  const contrasena = reglaContrasena.parse(await pedirContrasena());
  const hash = await bcrypt.hash(contrasena, config.bcryptCosto);

  const accion = await comoSistema(async (c) => {
    const rol = await c.query<{ id_rol: number }>("select id_rol from rol where nombre_rol = 'SuperAdmin'");
    if (!rol.rows[0]) throw new Error('No existe el rol SuperAdmin. Carga primero supabase/seed.sql');
    const existente = await c.query('select 1 from usuario where correo = $1', [correo]);
    if (existente.rowCount) {
      await c.query(
        `update usuario set id_rol = $1, estado_usuario = 'Activo', contrasena_hash = $2, fecha_cambio_contrasena = now()
          where correo = $3`,
        [rol.rows[0].id_rol, hash, correo],
      );
      return 'actualizado';
    }
    await c.query(
      `insert into usuario (nombre_usuario, apellido_usuario, correo, contrasena_hash,
                            acepta_tratamiento_datos, fecha_aceptacion_datos, id_rol)
       values ($1, $2, $3, $4, true, now(), $5)`,
      [values.nombre, values.apellido, correo, hash, rol.rows[0].id_rol],
    );
    return 'creado';
  });
  console.info(`SuperAdmin ${accion}: ${correo}`);
}

principal()
  .catch((error) => {
    console.error(error instanceof Error ? error.message : error);
    process.exitCode = 1;
  })
  .finally(() => cerrarPool());
