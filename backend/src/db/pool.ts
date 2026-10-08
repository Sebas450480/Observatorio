import pg from 'pg';
import { config } from '../config.js';

// Tipos de PostgreSQL que se convierten a tipos de JavaScript.
// numeric (costos) -> number; bigint (conteos) -> number; date -> texto 'AAAA-MM-DD'.
pg.types.setTypeParser(1700, (v) => (v === null ? null : Number(v)));
pg.types.setTypeParser(20, (v) => (v === null ? null : Number(v)));
pg.types.setTypeParser(1082, (v) => v);

/** Conjunto de conexiones a la base de datos, compartido por toda la aplicación. */
export const pool = new pg.Pool({
  connectionString: config.baseDatos.url,
  ssl: config.baseDatos.ssl ? { rejectUnauthorized: false } : undefined,
  // En Vercel cada instancia de la función atiende pocas peticiones a la vez: pocas conexiones.
  max: process.env.VERCEL ? 3 : 10,
  idleTimeoutMillis: process.env.VERCEL ? 5_000 : 10_000,
});

pool.on('error', (error) => {
  console.error('Error inesperado en una conexión inactiva de PostgreSQL:', error);
});

export async function cerrarPool(): Promise<void> {
  await pool.end();
}
