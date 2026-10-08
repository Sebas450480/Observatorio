import 'dotenv/config';
import path from 'node:path';
import { z } from 'zod';

/**
 * Configuración del backend, leída de las variables de entorno (archivo .env).
 * Si falta una variable obligatoria o tiene un valor inválido, el servidor no arranca
 * y muestra qué está mal.
 */
const booleano = z
  .enum(['true', 'false', '1', '0'])
  .transform((v) => v === 'true' || v === '1');

const esquemaEntorno = z.object({
  NODE_ENV: z.enum(['development', 'test', 'production']).default('development'),
  PUERTO: z.coerce.number().int().positive().default(3000),

  // Conexión a PostgreSQL con el usuario obs_backend.
  DATABASE_URL: z.string().min(1, 'DATABASE_URL es obligatoria'),
  DATABASE_SSL: booleano.default(false),

  // Sesiones (JWT). El secreto debe ser largo y aleatorio.
  JWT_SECRETO: z.string().min(32, 'JWT_SECRETO debe tener al menos 32 caracteres'),
  JWT_EXPIRACION_HORAS: z.coerce.number().positive().default(8),
  BCRYPT_COSTO: z.coerce.number().int().min(4).max(15).default(12),

  // URL del frontend (CORS y enlaces de los correos) y URL pública de esta API.
  FRONTEND_URL: z.string().url().default('http://localhost:5173'),
  API_URL_PUBLICA: z.string().url().default('http://localhost:3000'),

  // Imágenes subidas.
  UPLOADS_DIR: z.string().default('uploads'),
  // En Vercel una petición puede pesar como máximo 4,5 MB.
  UPLOADS_MAX_MB: z.coerce.number().positive().default(4),
  // Vercel Blob: si está, las imágenes se guardan ahí en lugar de UPLOADS_DIR.
  BLOB_READ_WRITE_TOKEN: z.string().optional(),

  // Correo. Sin SMTP_HOST los correos se muestran en la consola en lugar de enviarse.
  SMTP_HOST: z.string().optional(),
  SMTP_PUERTO: z.coerce.number().int().positive().default(1025),
  SMTP_SEGURO: booleano.default(false),
  SMTP_USUARIO: z.string().optional(),
  SMTP_CONTRASENA: z.string().optional(),
  CORREO_REMITENTE: z.string().default('Observatorio Empresarial <no-responder@uniempresarial.edu.co>'),

  // Envío automático de alertas por correo (tareas programadas).
  ALERTAS_ACTIVAS: booleano.default(true),
  // Vercel Cron llama a GET /api/alertas/cron con "Authorization: Bearer <CRON_SECRET>".
  CRON_SECRET: z.string().min(16, 'CRON_SECRET debe tener al menos 16 caracteres').optional(),
  ZONA_HORARIA: z.string().default('America/Bogota'),
});

const resultado = esquemaEntorno.safeParse(process.env);
if (!resultado.success) {
  const errores = resultado.error.issues.map((i) => `  - ${i.path.join('.')}: ${i.message}`).join('\n');
  throw new Error(`Configuración inválida. Revisa el archivo .env:\n${errores}`);
}

const env = resultado.data;

export const config = {
  entorno: env.NODE_ENV,
  esProduccion: env.NODE_ENV === 'production',
  esPrueba: env.NODE_ENV === 'test',
  puerto: env.PUERTO,
  baseDatos: {
    url: env.DATABASE_URL,
    ssl: env.DATABASE_SSL,
  },
  jwt: {
    secreto: env.JWT_SECRETO,
    expiracionHoras: env.JWT_EXPIRACION_HORAS,
  },
  bcryptCosto: env.BCRYPT_COSTO,
  frontendUrl: env.FRONTEND_URL.replace(/\/$/, ''),
  apiUrlPublica: env.API_URL_PUBLICA.replace(/\/$/, ''),
  uploads: {
    directorio: path.resolve(env.UPLOADS_DIR),
    maxBytes: Math.round(env.UPLOADS_MAX_MB * 1024 * 1024),
    tokenBlob: env.BLOB_READ_WRITE_TOKEN || undefined,
  },
  correo: {
    host: env.SMTP_HOST,
    puerto: env.SMTP_PUERTO,
    seguro: env.SMTP_SEGURO,
    usuario: env.SMTP_USUARIO,
    contrasena: env.SMTP_CONTRASENA,
    remitente: env.CORREO_REMITENTE,
  },
  alertas: {
    activas: env.ALERTAS_ACTIVAS,
    zonaHoraria: env.ZONA_HORARIA,
    secretoCron: env.CRON_SECRET || undefined,
  },
} as const;
