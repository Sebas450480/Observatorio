import { Router } from 'express';
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

/** Permite al SuperAdmin ejecutar el envío manualmente (útil para pruebas y demostraciones). */
rutasAlertas.post('/ejecutar', requiereSuperAdmin, async (req, res) => {
  const { frecuencia } = z.object({ frecuencia: z.enum(['Inmediata', 'Semanal']) }).parse(req.body);
  res.json(await ejecutarAlertas(frecuencia));
});
