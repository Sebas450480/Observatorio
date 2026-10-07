import { Router } from 'express';
import { rateLimit } from 'express-rate-limit';
import { z } from 'zod';
import { config } from '../config.js';
import { conRol } from '../db/contexto.js';
import { requiereSuperAdmin } from '../middlewares/sesion.js';
import { ACCIONES, TIPOS_CONTENIDO } from '../utilidades/esquemas.js';

/**
 * Actividad: el frontend registra cada vista, clic en "Acceder" o compartir.
 * Cualquier perfil puede registrar (el invitado, sin usuario).
 */
export const rutasActividad = Router();

rutasActividad.post(
  '/',
  rateLimit({ windowMs: 60 * 1000, limit: config.esPrueba ? 10000 : 120, standardHeaders: 'draft-8', legacyHeaders: false }),
  async (req, res) => {
    const datos = z
      .object({
        tipo_contenido: z.enum(TIPOS_CONTENIDO),
        id_contenido: z.number().int().positive(),
        accion: z.enum(ACCIONES),
      })
      .parse(req.body);
    await conRol(req.sesion, (c) =>
      c.query('insert into actividad (id_usuario, tipo_contenido, id_contenido, accion) values ($1, $2, $3, $4)', [
        req.sesion.idUsuario,
        datos.tipo_contenido,
        datos.id_contenido,
        datos.accion,
      ]));
    res.status(201).json({ registrado: true });
  },
);

/** Panel de estadísticas del SuperAdmin (RF-23), a partir de las vistas de la Fase 1. */
export const rutasEstadisticas = Router();
rutasEstadisticas.use(requiereSuperAdmin);

const vistas: Record<string, string> = {
  resumen: 'select * from v_estadisticas_resumen_mes',
  'top-contenidos': 'select * from v_estadisticas_top5_contenidos',
  modulos: 'select * from v_estadisticas_actividad_modulo order by vistas desc',
  ciudades: 'select * from v_estadisticas_usuarios_ciudad order by usuarios desc, ciudad',
  intereses: 'select * from v_estadisticas_intereses order by usuarios desc, nombre_categoria',
};

for (const [ruta, sql] of Object.entries(vistas)) {
  rutasEstadisticas.get(`/${ruta}`, async (req, res) => {
    const filas = await conRol(req.sesion, async (c) => (await c.query(sql)).rows);
    res.json(ruta === 'resumen' ? filas[0] : filas);
  });
}
