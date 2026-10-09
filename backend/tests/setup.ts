import { mkdtempSync } from 'node:fs';
import { tmpdir } from 'node:os';
import path from 'node:path';
import { afterAll } from 'vitest';
import { urlBackend } from './entorno.js';

// Variables de entorno de las pruebas (antes de cargar la aplicación).
process.env.NODE_ENV = 'test';
process.env.DATABASE_URL = urlBackend();
process.env.JWT_SECRETO = 'secreto-de-pruebas-que-tiene-mas-de-32-caracteres';
process.env.BCRYPT_COSTO = '4';
process.env.ALERTAS_ACTIVAS = 'false';
process.env.CRON_SECRET = 'secreto-cron-de-pruebas-1234';
delete process.env.BLOB_READ_WRITE_TOKEN;
delete process.env.BLOB_STORE_ID;
process.env.UPLOADS_DIR = mkdtempSync(path.join(tmpdir(), 'obs-uploads-'));
delete process.env.SMTP_HOST;

afterAll(async () => {
  const { cerrarPool } = await import('../src/db/pool.js');
  const { cerrarAdmin } = await import('./ayudas.js');
  await Promise.all([cerrarPool(), cerrarAdmin()]);
});
