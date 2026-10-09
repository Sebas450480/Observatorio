/**
 * Crea desde cero la base de datos de las pruebas E2E:
 * estructura (supabase/schema.sql), datos de ejemplo (supabase/seed.sql) y una cuenta por perfil.
 * Usa las dependencias del backend (pg y bcryptjs) para no duplicarlas en el frontend.
 */
import { readFileSync } from 'node:fs';
import { createRequire } from 'node:module';
import { BASE_E2E, CONTRASENA, CONTRASENA_BACKEND_E2E, CUENTAS, urlAdmin } from './entorno.mjs';

const requerir = createRequire(new URL('../../backend/package.json', import.meta.url));
const pg = requerir('pg');
const bcrypt = requerir('bcryptjs');

const admin = new pg.Client({ connectionString: urlAdmin() });
await admin.connect();
await admin.query(`drop database if exists ${BASE_E2E} with (force)`);
await admin.query(`create database ${BASE_E2E}`);
await admin.end();

const url = new URL(urlAdmin());
url.pathname = `/${BASE_E2E}`;
const base = new pg.Client({ connectionString: url.toString() });
await base.connect();
base.on('notice', () => undefined);
await base.query(readFileSync(new URL('../../supabase/schema.sql', import.meta.url), 'utf8'));
await base.query(readFileSync(new URL('../../supabase/seed.sql', import.meta.url), 'utf8'));
await base.query(`alter role obs_backend with login password '${CONTRASENA_BACKEND_E2E}'`);

const hash = await bcrypt.hash(CONTRASENA, 4);
for (const c of Object.values(CUENTAS)) {
  await base.query(
    `insert into usuario (nombre_usuario, apellido_usuario, correo, contrasena_hash, ciudad, acepta_tratamiento_datos,
                          fecha_aceptacion_datos, id_rol)
     select $1, $2, $3, $4, 'Bogotá', true, now(), id_rol from rol where nombre_rol = $5`,
    [c.nombre, c.apellido, c.correo, hash, c.rol],
  );
}
await base.end();
console.log(`Base de datos ${BASE_E2E} lista.`);
