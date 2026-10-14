import { z } from 'zod';
import { conRol } from '../db/contexto.js';
import { crearRecurso } from './recurso.js';
import { ESTADOS, textoObligatorio, textoOpcional } from '../utilidades/esquemas.js';

/**
 * Glosario: términos y conceptos clave del Observatorio. Lo administran el Super Admin,
 * el Gestor Observatorio y las cuentas con el rol delegado "Gestor Glosario".
 */
const esquema = z.object({
  termino: textoObligatorio(120),
  definicion: textoObligatorio(5000),
  fuente: textoOpcional(300),
  estado_gt: z.enum(ESTADOS).optional(),
});

const esquemaFiltros = z.object({
  q: z.string().trim().min(1).max(100).optional(),
  /** Inicial del término (A-Z o Ñ); los que empiezan por número o símbolo, con "#". */
  letra: z.string().regex(/^([A-ZÑ]|#)$/i, 'Letra inválida').optional(),
});

/** Inicial sin tilde, en mayúscula ("Ética" -> "E"). */
const INICIAL = `upper(left(translate(trim(t.termino), 'áéíóúüÁÉÍÓÚÜ', 'aeiouuAEIOUU'), 1))`;

export const rutasGlosario = crearRecurso({
  nombre: 'glosario',
  titulo: 'Glosario',
  tabla: 'glosario_termino',
  id: 'id_termino',
  rolGestor: 'obs_gestor_glosario',
  columnaEstado: 'estado_gt',
  esquema,
  esquemaFiltros,
  aplicarFiltros: (f, v) => {
    if (v.q) f.texto(['t.termino', 't.definicion'], v.q as string);
    if (v.letra === '#') f.y(`${INICIAL} !~ '^[A-ZÑ]'`);
    else if (v.letra) f.y(`${INICIAL} = ${f.param((v.letra as string).toUpperCase())}`);
  },
  ordenes: { termino: 'lower(t.termino)', creacion: 't.fecha_creacion', id: 't.id_termino' },
  ordenDefecto: 'termino',
  columnasExportar: [
    { campo: 'id_termino', titulo: 'ID', ancho: 0.4 },
    { campo: 'termino', titulo: 'Término', ancho: 1.2 },
    { campo: 'definicion', titulo: 'Definición', ancho: 3 },
    { campo: 'fuente', titulo: 'Fuente', ancho: 1.2 },
    { campo: 'estado_gt', titulo: 'Estado', ancho: 0.6 },
  ],
  rutasExtra: (router) => {
    // Letras que tienen términos (para el índice A-Z), según lo que cada perfil puede ver.
    router.get('/letras', async (req, res) => {
      const { rows } = await conRol(req.sesion, (c) =>
        c.query<{ letra: string }>(
          `select distinct case when ${INICIAL} ~ '^[A-ZÑ]' then ${INICIAL} else '#' end as letra
             from glosario_termino t order by 1`,
        ));
      res.json(rows.map((r) => r.letra));
    });
  },
});
