import { Router } from 'express';
import { z } from 'zod';
import { conRol } from '../db/contexto.js';

/**
 * Búsqueda global de la barra superior: busca a la vez en Flash, Faro, Empresas,
 * Tendencias y Eventos. Respeta lo que cada perfil puede ver (un invitado solo
 * encuentra registros activos).
 */
export const rutasBuscar = Router();

const esquema = z.object({
  q: z.string().trim().min(2, 'Escribe al menos 2 caracteres').max(100),
  limite: z.coerce.number().int().min(1).max(20).default(5),
});

interface Resultado {
  tipo: 'Flash' | 'Faro' | 'Empresa' | 'Tendencia' | 'Evento';
  id: number;
  titulo: string;
  detalle: string | null;
  fecha: string | null;
}

rutasBuscar.get('/', async (req, res) => {
  const { q, limite } = esquema.parse(req.query);
  const patron = `%${q.replace(/[\\%_]/g, (c) => `\\${c}`)}%`;

  const resultados = await conRol(req.sesion, async (c) => {
    const { rows } = await c.query<Resultado>(
      `(select 'Flash' as tipo, id_fi as id, titulo, coalesce(tipo_otro, tipo_evento::text) as detalle, fecha_inicio::date::text as fecha
          from flash_informativo
         where titulo ilike $1 or descripcion ilike $1 or lugar ilike $1
         order by fecha_inicio desc limit $2)
       union all
       (select 'Faro', id_fe, titulo, tipo::text, coalesce(fecha_cierre, fecha_publicacion)::text
          from faro_empresarial
         where titulo ilike $1 or descripcion ilike $1 or entidad ilike $1
         order by fecha_publicacion desc limit $2)
       union all
       (select 'Empresa', id_ec, coalesce(nombre_comercial, razon_social), sector_economico, null
          from empresa_coformadora
         where razon_social ilike $1 or nombre_comercial ilike $1 or nit ilike $1 or sector_economico ilike $1
         order by razon_social limit $2)
       union all
       (select 'Tendencia', id_te, tendencia, megatendencia, fecha_publicacion::text
          from tendencia_empresarial
         where tendencia ilike $1 or megatendencia ilike $1 or descripcion ilike $1
         order by fecha_publicacion desc limit $2)
       union all
       (select 'Evento', id_evento, titulo, coalesce(tipo_otro, tipo_evento::text), fecha_inicio::date::text
          from calendario_eventos
         where titulo ilike $1 or descripcion ilike $1 or lugar ilike $1
         order by fecha_inicio desc limit $2)`,
      [patron, limite],
    );
    return rows;
  });

  res.json({ q, total: resultados.length, resultados });
});
