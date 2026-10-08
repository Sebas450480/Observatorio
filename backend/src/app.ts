import { readFileSync } from 'node:fs';
import cookieParser from 'cookie-parser';
import cors from 'cors';
import express from 'express';
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
    res.json({ estado: 'ok', baseDeDatos: 'ok' });
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

  app.use(rutaNoEncontrada);
  app.use(manejadorErrores);

  return app;
}
