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

/** Variación porcentual frente al valor anterior (null si no hay base de comparación). */
function variacion(actual: number, anterior: number): number | null {
  return anterior > 0 ? Math.round(((actual - anterior) / anterior) * 1000) / 10 : null;
}

/**
 * Tarjetas "Resumen del mes" del Panel de estadísticas, con la variación frente al
 * mes anterior: usuarios registrados, contenidos publicados, visitas y suscriptores.
 */
rutasEstadisticas.get('/panel', async (req, res) => {
  const fila = await conRol(req.sesion, async (c) => {
    const { rows } = await c.query<Record<string, number | null>>(
      `with limites as (
         select date_trunc('month', now()) as inicio_mes,
                date_trunc('month', now()) - interval '1 month' as inicio_anterior
       )
       select
         (select count(*) from usuario where estado_usuario = 'Activo')::int as usuarios_total,
         (select count(*) from usuario, limites
           where estado_usuario = 'Activo' and fecha_registro < inicio_mes)::int as usuarios_total_anterior,
         (select count(*) from usuario, limites where fecha_registro >= inicio_mes)::int as usuarios_nuevos_mes,

         (select count(*) from flash_informativo where estado_fi = 'Activo')::int as flash,
         (select count(*) from faro_empresarial where estado_fe = 'Activo')::int as faro,
         (select count(*) from calendario_eventos)::int as eventos,
         (select count(*) from tendencia_empresarial where estado_te = 'Activo')::int as tendencias,
         ((select count(*) from flash_informativo, limites where estado_fi = 'Activo' and fecha_creacion < inicio_mes)
          + (select count(*) from faro_empresarial, limites where estado_fe = 'Activo' and fecha_creacion < inicio_mes)
          + (select count(*) from calendario_eventos, limites where fecha_creacion < inicio_mes)
          + (select count(*) from tendencia_empresarial, limites where estado_te = 'Activo' and fecha_creacion < inicio_mes)
         )::int as contenidos_anterior,

         (select count(*) from actividad, limites where accion = 'Vista' and fecha >= inicio_mes)::int as visitas_mes,
         (select count(*) from actividad, limites
           where accion = 'Vista' and fecha >= inicio_anterior and fecha < inicio_mes)::int as visitas_mes_anterior,
         (select count(*) from actividad, limites where accion = 'Clic_acceder' and fecha >= inicio_mes)::int as clics_acceder_mes,

         (select count(*) from usuario
           where estado_usuario = 'Activo' and frecuencia_alertas <> 'Ninguna')::int as suscriptores,
         (select count(*) from usuario, limites
           where estado_usuario = 'Activo' and frecuencia_alertas <> 'Ninguna' and fecha_registro < inicio_mes)::int as suscriptores_anterior,
         (select round(100.0 * count(*) filter (where fecha_apertura is not null) / nullif(count(*), 0), 1)
            from envio_alerta, limites where fecha_envio >= inicio_mes) as tasa_apertura_mes_pct`,
    );
    return rows[0]!;
  });

  const n = (clave: string) => Number(fila[clave] ?? 0);
  const contenidos = n('flash') + n('faro') + n('eventos') + n('tendencias');
  res.json({
    usuarios: {
      total: n('usuarios_total'),
      nuevos_mes: n('usuarios_nuevos_mes'),
      variacion_pct: variacion(n('usuarios_total'), n('usuarios_total_anterior')),
    },
    contenidos: {
      total: contenidos,
      flash: n('flash'),
      faro: n('faro'),
      eventos: n('eventos'),
      tendencias: n('tendencias'),
      variacion_pct: variacion(contenidos, n('contenidos_anterior')),
    },
    visitas: {
      mes: n('visitas_mes'),
      clics_acceder_mes: n('clics_acceder_mes'),
      variacion_pct: variacion(n('visitas_mes'), n('visitas_mes_anterior')),
    },
    suscriptores: {
      total: n('suscriptores'),
      tasa_apertura_pct: fila.tasa_apertura_mes_pct === null ? null : Number(fila.tasa_apertura_mes_pct),
      variacion_pct: variacion(n('suscriptores'), n('suscriptores_anterior')),
    },
  });
});

for (const [ruta, sql] of Object.entries(vistas)) {
  rutasEstadisticas.get(`/${ruta}`, async (req, res) => {
    const filas = await conRol(req.sesion, async (c) => (await c.query(sql)).rows);
    res.json(ruta === 'resumen' ? filas[0] : filas);
  });
}
