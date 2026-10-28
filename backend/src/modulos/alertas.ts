import { timingSafeEqual } from 'node:crypto';
import { Router } from 'express';
import { config } from '../config.js';
import { z } from 'zod';
import { verificarFirmaEnvio } from '../auth/tokens.js';
import { requiereSuperAdmin } from '../middlewares/sesion.js';
import { TIPOS_REGISTRO, enlaceRegistro, ejecutarEnvioDiario, ejecutarTarea, marcarAbierto, registrarClicCorreo } from '../servicios/alertas.js';

const TAREAS = ['Inmediata', 'Diaria', 'Cada2Dias', 'Semanal', 'Recordatorios'] as const;

export const rutasAlertas = Router();

/** Imagen transparente de 1x1 que se incluye en los correos de alerta. */
const PIXEL_GIF = Buffer.from('R0lGODlhAQABAIAAAAAAAP///yH5BAEAAAAALAAAAAABAAEAAAIBRAA7', 'base64');

rutasAlertas.get('/abierto/:id/:firma', async (req, res) => {
  const id = Number(req.params.id);
  if (Number.isInteger(id) && id > 0 && verificarFirmaEnvio(id, req.params.firma)) {
    await marcarAbierto(id).catch(() => undefined);
  }
  res.set('Cache-Control', 'no-store').type('image/gif').send(PIXEL_GIF);
});

/**
 * Enlace de un boletín o recordatorio: registra el "Acceder" (cuenta para el top 5) y la
 * apertura del correo, y lleva al registro. Con una firma inválida solo redirige.
 */
rutasAlertas.get('/ir/:id/:firma/:tipo/:registro', async (req, res) => {
  const id = Number(req.params.id);
  const registro = Number(req.params.registro);
  const tipo = TIPOS_REGISTRO.find((t) => t === req.params.tipo);
  if (!tipo || !Number.isInteger(registro) || registro <= 0) {
    res.redirect(302, `${config.frontendUrl}/inicio`);
    return;
  }
  if (Number.isInteger(id) && id > 0 && verificarFirmaEnvio(id, req.params.firma)) {
    await registrarClicCorreo(id, tipo, registro).catch((e) => console.error('No se pudo registrar el clic del correo:', e));
  }
  res.set('Cache-Control', 'no-store').redirect(302, enlaceRegistro(tipo, registro));
});

/**
 * Envío programado en Vercel (Cron Jobs, ver vercel.json): una vez al día, a las 8:00 de
 * Bogotá, ejecuta todas las tareas del día; con ?frecuencia=... ejecuta solo una.
 * Vercel envía la cabecera "Authorization: Bearer <CRON_SECRET>". Sin CRON_SECRET
 * configurado la ruta no existe.
 */
rutasAlertas.get('/cron', async (req, res) => {
  const secreto = config.alertas.secretoCron;
  const recibido = Buffer.from(req.get('authorization') ?? '');
  const esperado = Buffer.from(`Bearer ${secreto ?? ''}`);
  if (!secreto || recibido.length !== esperado.length || !timingSafeEqual(recibido, esperado)) {
    res.status(404).json({ error: 'Ruta no encontrada' });
    return;
  }
  const { frecuencia } = z.object({ frecuencia: z.enum(TAREAS).optional() }).parse(req.query);
  const resultado = frecuencia ? await ejecutarTarea(frecuencia) : await ejecutarEnvioDiario();
  console.info(`[alertas ${frecuencia ?? 'diarias'}]`, JSON.stringify(resultado));
  res.json(resultado);
});

/** Permite al SuperAdmin ejecutar el envío manualmente (útil para pruebas y demostraciones). */
rutasAlertas.post('/ejecutar', requiereSuperAdmin, async (req, res) => {
  const { frecuencia } = z.object({ frecuencia: z.enum(TAREAS) }).parse(req.body);
  res.json(await ejecutarTarea(frecuencia));
});
