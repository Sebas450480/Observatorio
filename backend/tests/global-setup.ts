/**
 * Prepara una base de datos de pruebas desde cero antes de ejecutar las pruebas:
 *   1. crea la base `obs_pruebas_backend`,
 *   2. ejecuta supabase/schema.sql (estructura de la Fase 1) y supabase/seed.sql,
 *   3. define una contraseña de prueba para el usuario obs_backend.
 *
 * Necesita un PostgreSQL 15+ con un usuario administrador. Por defecto:
 *   TEST_ADMIN_URL=postgresql://postgres@localhost:55432/postgres
 */
import { readFileSync } from 'node:fs';
import pg from 'pg';
import { BASE_PRUEBAS, CONTRASENA_BACKEND_PRUEBAS, urlAdmin } from './entorno.js';

export default async function prepararBase() {
  const admin = new pg.Client({ connectionString: urlAdmin() });
  await admin.connect();
  await admin.query(`drop database if exists ${BASE_PRUEBAS} with (force)`);
  await admin.query(`create database ${BASE_PRUEBAS}`);
  await admin.end();

  const url = new URL(urlAdmin());
  url.pathname = `/${BASE_PRUEBAS}`;
  const base = new pg.Client({ connectionString: url.toString() });
  await base.connect();
  // Los avisos de "ya existe" (roles creados en ejecuciones anteriores) no son errores.
  base.on('notice', () => undefined);
  await base.query(readFileSync(new URL('../../supabase/schema.sql', import.meta.url), 'utf8'));
  await base.query(readFileSync(new URL('../../supabase/seed.sql', import.meta.url), 'utf8'));
  await base.query(`alter role obs_backend with login password '${CONTRASENA_BACKEND_PRUEBAS}'`);
  await base.end();
}
