import { timingSafeEqual } from 'node:crypto';
import { Router } from 'express';
import { config } from '../config.js';
import { z } from 'zod';
import { verificarFirmaEnvio } from '../auth/tokens.js';
import { requiereSuperAdmin } from '../middlewares/sesion.js';
import { ejecutarAlertas, marcarAbierto } from '../servicios/alertas.js';

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
 * Envío programado en Vercel (Cron Jobs, ver vercel.json). Vercel envía la cabecera
 * "Authorization: Bearer <CRON_SECRET>". Sin CRON_SECRET configurado la ruta no existe.
 */
rutasAlertas.get('/cron', async (req, res) => {
  const secreto = config.alertas.secretoCron;
  const recibido = Buffer.from(req.get('authorization') ?? '');
  const esperado = Buffer.from(`Bearer ${secreto ?? ''}`);
  if (!secreto || recibido.length !== esperado.length || !timingSafeEqual(recibido, esperado)) {
    res.status(404).json({ error: 'Ruta no encontrada' });
    return;
  }
  const { frecuencia } = z.object({ frecuencia: z.enum(['Inmediata', 'Semanal']) }).parse(req.query);
  const resultado = await ejecutarAlertas(frecuencia);
  console.info(`[alertas ${frecuencia}] enviados: ${resultado.enviados}, errores: ${resultado.errores}`);
  res.json(resultado);
});

/** Permite al SuperAdmin ejecutar el envío manualmente (útil para pruebas y demostraciones). */
rutasAlertas.post('/ejecutar', requiereSuperAdmin, async (req, res) => {
  const { frecuencia } = z.object({ frecuencia: z.enum(['Inmediata', 'Semanal']) }).parse(req.body);
  res.json(await ejecutarAlertas(frecuencia));
});
