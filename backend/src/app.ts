import { readFileSync } from 'node:fs';
import path from 'node:path';
import cookieParser from 'cookie-parser';
import cors from 'cors';
import express, { type Express } from 'express';
import helmet from 'helmet';
import swaggerUi from 'swagger-ui-express';
import YAML from 'yaml';
import { config } from './config.js';
import { pool } from './db/pool.js';
import { manejadorErrores, rutaNoEncontrada } from './errores.js';
import { identificarSesion } from './middlewares/sesion.js';
import { rutasAlertas } from './modulos/alertas.js';
import { rutasAuth } from './modulos/auth.js';
import { rutasBuscar } from './modulos/buscar.js';
import { rutasCalendario } from './modulos/calendario.js';
import { rutasCategorias, rutasRoles } from './modulos/catalogos.js';
import { rutasEmpresas } from './modulos/empresas.js';
import { rutasActividad, rutasEstadisticas } from './modulos/estadisticas.js';
import { rutasFaro } from './modulos/faro.js';
import { rutasFlash } from './modulos/flash.js';
import { rutasPerfil } from './modulos/perfil.js';
import { rutasTendencias } from './modulos/tendencias.js';
import { rutasUsuarios } from './modulos/usuarios.js';

export function crearApp() {
  const app = express();

  app.disable('x-powered-by');
  app.set('trust proxy', 1);

  // Seguridad básica de cabeceras. Las imágenes se pueden mostrar desde el frontend (otro origen).
  app.use(helmet({ crossOriginResourcePolicy: { policy: 'cross-origin' } }));
  app.use(cors({ origin: config.frontendUrl, credentials: true }));
  app.use(express.json({ limit: '1mb' }));
  app.use(cookieParser());

  // Imágenes subidas.
  app.use('/uploads', express.static(config.uploads.directorio, { fallthrough: false, maxAge: '7d' }));

  // Documentación interactiva de la API.
  const especificacion = YAML.parse(readFileSync(new URL('../docs/openapi.yaml', import.meta.url), 'utf8'));
  app.get('/api/docs.json', (_req, res) => res.json(especificacion));
  app.use('/api/docs', helmet({ contentSecurityPolicy: false }), swaggerUi.serve, swaggerUi.setup(especificacion, {
    customSiteTitle: 'API Observatorio Empresarial',
  }));

  app.get('/api/salud', async (_req, res) => {
    await pool.query('select 1');
    // `correo` dice si hay servidor SMTP configurado (sin él no salen correos de recuperación ni alertas).
    res.json({ estado: 'ok', baseDeDatos: 'ok', correo: config.correo.host ? 'configurado' : 'sin configurar' });
  });

  // A partir de aquí todas las rutas conocen quién hace la petición (req.sesion).
  app.use('/api', identificarSesion);

  app.use('/api/auth', rutasAuth);
  app.use('/api/perfil', rutasPerfil);
  app.use('/api/usuarios', rutasUsuarios);
  app.use('/api/roles', rutasRoles);
  app.use('/api/categorias', rutasCategorias);
  app.use('/api/flash', rutasFlash);
  app.use('/api/faro', rutasFaro);
  app.use('/api/empresas', rutasEmpresas);
  app.use('/api/tendencias', rutasTendencias);
  app.use('/api/calendario', rutasCalendario);
  app.use('/api/actividad', rutasActividad);
  app.use('/api/estadisticas', rutasEstadisticas);
  app.use('/api/alertas', rutasAlertas);
  app.use('/api/buscar', rutasBuscar);

  if (config.frontendDir) servirFrontend(app, config.frontendDir);

  app.use(rutaNoEncontrada);
  app.use(manejadorErrores);

  return app;
}

/**
 * Servidor propio (no Vercel): la misma aplicación entrega la página web compilada.
 * Las rutas que no son de la API devuelven index.html para que React resuelva la pantalla.
 */
function servirFrontend(app: Express, directorio: string) {
  // La página carga el mapa de Google (iframe) y muestra imágenes de enlaces externos.
  const politica = [
    "default-src 'self'",
    "script-src 'self'",
    "style-src 'self' 'unsafe-inline'",
    "img-src 'self' data: blob: https:",
    "font-src 'self' data:",
    "connect-src 'self'",
    'frame-src https://maps.google.com https://www.google.com',
    "object-src 'none'",
    "base-uri 'self'",
    "frame-ancestors 'self'",
  ].join('; ');
  const indice = path.join(directorio, 'index.html');

  app.use((req, res, siguiente) => {
    if (req.path.startsWith('/api/') || req.path === '/api') return siguiente();
    res.setHeader('Content-Security-Policy', politica);
    siguiente();
  });
  // Los archivos de /assets llevan un hash en el nombre: se pueden guardar en caché un año.
  app.use('/assets', express.static(path.join(directorio, 'assets'), { immutable: true, maxAge: '1y', fallthrough: false }));
  app.use(express.static(directorio, { index: false, maxAge: '1h' }));
  app.use((req, res, siguiente) => {
    if ((req.method !== 'GET' && req.method !== 'HEAD') || req.path.startsWith('/api/') || req.path === '/api') return siguiente();
    res.setHeader('Cache-Control', 'no-cache');
    res.sendFile(indice);
  });
}
